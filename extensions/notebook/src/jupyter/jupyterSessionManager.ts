/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, ServerInfo, connection, IConnectionProfile, credentials } from 'azdata';
import { Session, Kernel } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import { EOL } from 'os';
import * as utils from '../common/utils';
const localize = nls.loadMessageBundle();

import { JupyterKernel } from './jupyterKernel';
import { Deferred } from '../common/promise';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as bdc from 'bdc';
import { noBDCConnectionError, providerNotValidError } from '../common/localizedConstants';
import { SQL_PROVIDER, CONTROLLER_ENDPOINT, KNOX_ENDPOINT_GATEWAY, KNOX_ENDPOINT_SERVER, KNOX_ENDPOINT_PORT } from '../common/constants';
import CodeAdapter from '../prompts/adapter';
import { IQuestion, QuestionTypes } from '../prompts/question';
import { ExtensionContextHelper } from '../common/extensionContextHelper';

const configBase = {
	'kernel_python_credentials': {
		'url': ''
	},
	'kernel_scala_credentials': {
		'url': ''
	},
	'kernel_r_credentials': {
		'url': ''
	},
	'livy_session_startup_timeout_seconds': 100,
	'logging_config': {
		'version': 1,
		'formatters': {
			'magicsFormatter': {
				'format': '%(asctime)s\t%(levelname)s\t%(message)s',
				'datefmt': ''
			}
		},
		'handlers': {
			'magicsHandler': {
				'class': 'hdijupyterutils.filehandler.MagicsFileHandler',
				'formatter': 'magicsFormatter',
				'home_path': ''
			}
		},
		'loggers': {
			'magicsLogger': {
				'handlers': ['magicsHandler'],
				'level': 'DEBUG',
				'propagate': 0
			}
		}
	}
};

export class JupyterSessionManager implements nb.SessionManager {
	private _ready: Deferred<void>;
	private _isReady: boolean;
	private _sessionManager: Session.IManager;
	private static _sessions: JupyterSession[] = [];
	private _installation: JupyterServerInstallation;

	constructor(private _pythonEnvVarPath?: string) {
		this._isReady = false;
		this._ready = new Deferred<void>();
	}

	public setJupyterSessionManager(sessionManager: Session.IManager): void {
		this._sessionManager = sessionManager;
		sessionManager.ready
			.then(() => {
				this._isReady = true;
				this._ready.resolve();
			}).catch((error) => {
				this._isReady = false;
				this._ready.reject(error);
			});
	}

	public set installation(installation: JupyterServerInstallation) {
		this._installation = installation;
		JupyterSessionManager._sessions.forEach(session => {
			session.installation = installation;
		});
	}
	public get isReady(): boolean {
		return this._isReady;
	}
	public get ready(): Promise<void> {
		return this._ready.promise;
	}

	public get specs(): nb.IAllKernels | undefined {
		if (!this._isReady) {
			return undefined;
		}
		let specs = this._sessionManager.specs;
		if (!specs) {
			return undefined;
		}
		let kernels: nb.IKernelSpec[] = Object.keys(specs.kernelspecs).map(k => {
			let value = specs.kernelspecs[k];
			let kernel: nb.IKernelSpec = {
				name: k,
				display_name: value.display_name ? value.display_name : k
			};
			// TODO add more info to kernels
			return kernel;
		});

		// For now, need to remove PySpark3, as it's been deprecated
		// May want to have a formalized deprecated kernels mechanism in the future
		kernels = kernels.filter(k => k.name !== 'pyspark3kernel');

		let allKernels: nb.IAllKernels = {
			defaultKernel: specs.default,
			kernels: kernels
		};
		return allKernels;
	}

	public async startNew(options: nb.ISessionOptions, skipSettingEnvironmentVars?: boolean): Promise<nb.ISession> {
		if (!this._isReady) {
			// no-op
			return Promise.reject(new Error(localize('errorStartBeforeReady', "Cannot start a session, the manager is not yet initialized")));
		}
		let sessionImpl = await this._sessionManager.startNew(options);
		let jupyterSession = new JupyterSession(sessionImpl, this._installation, skipSettingEnvironmentVars, this._pythonEnvVarPath);
		await jupyterSession.messagesComplete;
		let index = JupyterSessionManager._sessions.findIndex(session => session.path === options.path);
		if (index > -1) {
			JupyterSessionManager._sessions.splice(index);
		}
		JupyterSessionManager._sessions.push(jupyterSession);
		return jupyterSession;
	}

	public listRunning(): JupyterSession[] {
		return JupyterSessionManager._sessions;
	}

	public shutdown(id: string): Promise<void> {
		if (!this._isReady) {
			// no-op
			return Promise.resolve();
		}
		let index = JupyterSessionManager._sessions.findIndex(session => session.id === id);
		if (index > -1) {
			JupyterSessionManager._sessions.splice(index);
		}
		if (this._sessionManager && !this._sessionManager.isDisposed) {
			return this._sessionManager.shutdown(id);
		}
		return undefined;
	}

	public shutdownAll(): Promise<void> {
		if (this._isReady) {
			return this._sessionManager.shutdownAll();
		}
		return Promise.resolve();
	}

	public dispose(): void {
		if (this._isReady) {
			this._sessionManager.dispose();
		}
	}
}

export class JupyterSession implements nb.ISession {
	private _kernel: nb.IKernel;
	private _messagesComplete: Deferred<void> = new Deferred<void>();

	constructor(
		private sessionImpl: Session.ISession,
		private _installation: JupyterServerInstallation,
		skipSettingEnvironmentVars?: boolean,
		private _pythonEnvVarPath?: string) {
		this.setEnvironmentVars(skipSettingEnvironmentVars).catch(error => {
			console.error('Unexpected exception setting Jupyter Session variables : ', error);
			// We don't want callers to hang forever waiting - it's better to continue on even if we weren't
			// able to set environment variables
			this._messagesComplete.resolve();
		});
	}

	public get canChangeKernels(): boolean {
		return true;
	}

	public get id(): string {
		return this.sessionImpl.id;
	}

	public get path(): string {
		return this.sessionImpl.path;
	}

	public get name(): string {
		return this.sessionImpl.name;
	}

	public get type(): string {
		return this.sessionImpl.type;
	}

	public get status(): nb.KernelStatus {
		return this.sessionImpl.status;
	}

	public get kernel(): nb.IKernel {
		if (!this._kernel) {
			let kernelImpl = this.sessionImpl.kernel;
			if (kernelImpl) {
				this._kernel = new JupyterKernel(kernelImpl);
			}
		}
		return this._kernel;
	}

	// Sent when startup messages have been sent
	public get messagesComplete(): Promise<void> {
		return this._messagesComplete.promise;
	}

	public set installation(installation: JupyterServerInstallation) {
		this._installation = installation;
	}

	public async changeKernel(kernelInfo: nb.IKernelSpec): Promise<nb.IKernel> {
		if (this._installation) {
			try {
				await this._installation.promptForPythonInstall(kernelInfo.display_name);
			} catch (err) {
				// Have to swallow the error here to prevent hangs when changing back to the old kernel.
				console.error('Exception encountered prompting for Python install', err);
				return this._kernel;
			}
		}
		// For now, Jupyter implementation handles disposal etc. so we can just
		// null out our kernel and let the changeKernel call handle this
		this._kernel = undefined;
		// For now, just using name. It's unclear how we'd know the ID
		let options: Partial<Kernel.IModel> = {
			name: kernelInfo.name
		};
		return this.sessionImpl.changeKernel(options).then((kernelImpl) => {
			this._kernel = new JupyterKernel(kernelImpl);
			return this._kernel;
		});
	}

	public async configureKernel(): Promise<void> {
		let sparkmagicConfDir = path.join(utils.getUserHome(), '.sparkmagic');
		await utils.mkDir(sparkmagicConfDir);

		// Default to localhost in config file.
		let creds: ICredentials = {
			'url': 'http://localhost:8088'
		};

		let config: ISparkMagicConfig = Object.assign({}, configBase);
		this.updateConfig(config, creds, sparkmagicConfDir);

		let configFilePath = path.join(sparkmagicConfDir, 'config.json');
		await fs.writeFile(configFilePath, JSON.stringify(config));
	}

	public async configureConnection(connectionProfile: IConnectionProfile): Promise<void> {
		if (connectionProfile && connectionProfile.providerName && utils.isSparkKernel(this.sessionImpl.kernel.name)) {
			// %_do_not_call_change_endpoint is a SparkMagic command that lets users change endpoint options,
			// such as user/profile/host name/auth type

			let knoxUsername = connectionProfile.userName || 'root';
			let knoxPassword: string = '';

			//Update server info with bigdata endpoint - Unified Connection
			if (connectionProfile.providerName === SQL_PROVIDER) {
				const serverInfo: ServerInfo = await connection.getServerInfo(connectionProfile.id);
				if (!serverInfo?.options['isBigDataCluster']) {
					throw new Error(noBDCConnectionError);
				}
				const endpoints = utils.getClusterEndpoints(serverInfo);
				const controllerEndpoint = endpoints.find(ep => ep.name.toLowerCase() === CONTROLLER_ENDPOINT);

				// root is the default username for pre-CU5 instances, so while we prefer to use the connection username
				// as a default now we'll still fall back to root if it's empty for some reason. (but the calls below should
				// get the actual correct value regardless)
				let clusterController: bdc.IClusterController | undefined = undefined;
				if (!utils.isIntegratedAuth(connectionProfile)) {
					// See if the controller creds have been saved already, otherwise fall back to using
					// SQL creds as a default
					const credentialProvider = await credentials.getProvider('notebook.bdc.password');
					const usernameKey = `notebook.bdc.username::${connectionProfile.id}`;
					const savedUsername = ExtensionContextHelper.extensionContext.globalState.get<string>(usernameKey) || connectionProfile.userName;
					const connectionCreds = await connection.getCredentials(connectionProfile.id);
					const savedPassword = (await credentialProvider.readCredential(connectionProfile.id)).password || connectionCreds.password;
					clusterController = await getClusterController(controllerEndpoint.endpoint, 'basic', savedUsername, savedPassword);
					// Now that we know that the username/password are valid store them for use later on with the same connection
					await credentialProvider.saveCredential(connectionProfile.id, clusterController.password);
					await ExtensionContextHelper.extensionContext.globalState.update(usernameKey, clusterController.username);
					knoxPassword = clusterController.password;
					try {
						knoxUsername = await clusterController.getKnoxUsername(clusterController.username);
					} catch (err) {
						knoxUsername = clusterController.username;
						console.log(`Unexpected error getting Knox username for Spark kernel: ${err}`);
					}
				} else {
					clusterController = await getClusterController(controllerEndpoint.endpoint, 'integrated');
				}

				let gatewayEndpoint: bdc.IEndpointModel = endpoints?.find(ep => ep.name.toLowerCase() === KNOX_ENDPOINT_GATEWAY);
				if (!gatewayEndpoint) {
					// User doesn't have permission to see the gateway endpoint from the DMV so we need to query the controller instead
					const allEndpoints = (await clusterController.getEndPoints()).endPoints;
					gatewayEndpoint = allEndpoints?.find(ep => ep.name.toLowerCase() === KNOX_ENDPOINT_GATEWAY);
					if (!gatewayEndpoint) {
						throw new Error(localize('notebook.couldNotFindKnoxGateway', "Could not find Knox gateway endpoint"));
					}
				}
				let gatewayHostAndPort = utils.getHostAndPortFromEndpoint(gatewayEndpoint.endpoint);
				connectionProfile.options[KNOX_ENDPOINT_SERVER] = gatewayHostAndPort.host;
				connectionProfile.options[KNOX_ENDPOINT_PORT] = gatewayHostAndPort.port;
			}
			else {
				throw new Error(providerNotValidError);
			}
			utils.setHostAndPort(':', connectionProfile);
			utils.setHostAndPort(',', connectionProfile);

			let server = vscode.Uri.parse(utils.getLivyUrl(connectionProfile.options[KNOX_ENDPOINT_SERVER], connectionProfile.options[KNOX_ENDPOINT_PORT])).toString();
			let doNotCallChangeEndpointParams: string;
			if (utils.isIntegratedAuth(connectionProfile)) {
				doNotCallChangeEndpointParams = `%_do_not_call_change_endpoint --server=${server} --auth=Kerberos`;
			} else {
				doNotCallChangeEndpointParams = `%_do_not_call_change_endpoint --username=${knoxUsername} --password=${knoxPassword} --server=${server} --auth=Basic_Access`;
			}
			let future = this.sessionImpl.kernel.requestExecute({
				code: doNotCallChangeEndpointParams
			}, true);
			await future.done;
		}
	}

	private updateConfig(config: ISparkMagicConfig, creds: ICredentials, homePath: string): void {
		config.kernel_python_credentials = creds;
		config.kernel_scala_credentials = creds;
		config.kernel_r_credentials = creds;
		config.logging_config.handlers.magicsHandler.home_path = homePath;
		config.ignore_ssl_errors = utils.getIgnoreSslVerificationConfigSetting();
	}

	private async setEnvironmentVars(skip: boolean = false): Promise<void> {
		// The PowerShell kernel doesn't define the %cd and %set_env magics; no need to run those here then
		if (!skip && this.sessionImpl?.kernel?.name !== 'powershell') {
			let allCode: string = '';
			// Ensure cwd matches notebook path (this follows Jupyter behavior)
			console.log('Start creating allCode at: ' + Date.now().toString());
			if (this.path && path.dirname(this.path)) {
				allCode += `%cd ${path.dirname(this.path)}${EOL}`;
			}
			for (let i = 0; i < Object.keys(process.env).length; i++) {
				let key = Object.keys(process.env)[i];
				if (key.toLowerCase() === 'path' && this._pythonEnvVarPath) {
					allCode += `%set_env ${key}=${this._pythonEnvVarPath}${EOL}`;
				} else {
					// Jupyter doesn't seem to alow for setting multiple variables at once, so doing it with multiple commands
					allCode += `%set_env ${key}=${process.env[key]}${EOL}`;
				}
			}
			console.log('Finish creating allCode at: ' + Date.now().toString());

			let future = this.sessionImpl.kernel.requestExecute({
				code: allCode,
				silent: true,
				store_history: false
			}, true);
			console.log('requestExecute at: ' + Date.now().toString());

			future.onReply = (msg) => {
				console.log('Get onReply at: ' + Date.now().toString());
				// {execution_count: 0, paylod: Array(0) [], status: "ok", user_expressions: Objects {}}
			};
			future.onIOPub = (msg) => {
				console.log('Get IOPub at: ' + Date.now().toString());

				// {execution_state: "busy"}

				// {name: "stdout", text: "/Users/lucyzhang
				// env: ELECTRON_RUN_AS_NODE=1
				// env: NVM_INC=/Users/lucyzhang/.nvm/versions/node/v10.16.3/include/node
				// env: VSCODE_CLI=1
				// env: NVM_CD_FLAGS=-q
				// env: SHELL=/bin/zsh
				// env: VSCODE_SKIP_PRELAUNCH=1
				// env: AMD_ENTRYPOINT=vs/workbench/services/extensions/node/extensionHostProcess
				// env: TMPDIR=/var/folders/x_/nd1txd_s35l4syc6c4sm85vc0000gn/T/
				// env: ELECTRON_ENABLE_STACK_DUMPING=1
				// env: OLDPWD=/Users/lucyzhang/GitProjects/azuredatastudio
				// env: ORIGINAL_XDG_CURRENT_DESKTOP=undefined
				// env: NVM_DIR=/Users/lucyzhang/.nvm
				// env: USER=lucyzhang
				// env: SSH_AUTH_SOCK=/private/tmp/com.apple.launchd.NW79FXYL5B/Listeners
				// env: __CF_USER_TEXT_ENCODING=0x1F5:0x0:0x0
				// env: VSCODE_DEV=1
				// env: PATH=/Users/lucyzhang/Library/Python/3.8/bin:/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.8/bin:/Users/lucyzhang/.nvm/versions/node/v10.16.3/bin:/Library/Frameworks/Python.framework/Versions/2.7/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/lucyzhang/.dotnet/tools:/usr/local/share/dotnet:~/.dotnet/tools
				// env: PWD=/Users/lucyzhang/GitProjects/azuredatastudio
				// env: XPC_FLAGS=0x0
				// env: NODE_ENV=development
				// env: XPC_SERVICE_NAME=com.microsoft.VSCode.16048
				// env: SHLVL=0
				// env: HOME=/Users/lucyzhang
				// env: ELECTRON_ENABLE_LOGGING=1
				// env: PIPE_LOGGING=true
				// env: LOGNAME=lucyzhang
				// env: NVM_BIN=/Users/lucyzhang/.nvm/versions/node/v10.16.3/bin
				// env: VERBOSE_LOGGING=true
				// env: VSCODE_NLS_CONFIG={"locale":"en-us","availableLanguages":{},"_languagePackSupport":true}
				// env: VSCODE_NODE_CACHED_DATA_DIR=
				// env: VSCODE_LOGS=/Users/lucyzhang/Library/Application Support/azuredatastudio/logs/20201230T092855
				// env: ADS_LOGS=/Users/lucyzhang/Library/Application Support/azuredatastudio/logs/20201230T092855
				// env: VSCODE_IPC_HOOK=/Users/lucyzhang/Library/Application Support/azuredatastudio/1.26.0-main.sock
				// env: VSCODE_PID=92763
				// env: VSCODE_IPC_HOOK_EXTHOST=/var/folders/x_/nd1txd_s35l4syc6c4sm85vc0000gn/T/vscode-ipc-f795aea0-70d3-4375-b4f4-f13111121750.sock
				// env: VSCODE_HANDLES_UNCAUGHT_ERRORS=true
				// env: VSCODE_LOG_STACK=true
				// env: APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL=true
				// "}

				// {execution_state: "idle"}

			};
			future.onStdin = (msg) => {
				console.log('~~~~~~~~~~~~~~~~~~onStdin: ' + msg.content.toString());
			};
			await future.done;
			console.log('future done at: ' + Date.now().toString());
		}
		this._messagesComplete.resolve();
	}
}

async function getClusterController(controllerEndpoint: string, authType: bdc.AuthType, username?: string, password?: string): Promise<bdc.IClusterController | undefined> {
	const bdcApi = <bdc.IExtension>await vscode.extensions.getExtension(bdc.constants.extensionName).activate();
	const controller = bdcApi.getClusterController(
		controllerEndpoint,
		authType,
		username,
		password);
	try {
		await controller.getClusterConfig();
		return controller;
	} catch (err) {
		// Initial username/password failed so prompt user for username password until either user
		// cancels out or we successfully connect
		console.log(`Error connecting to cluster controller: ${err}`);
		let errorMessage = '';
		const prompter = new CodeAdapter();
		while (true) {
			const newUsername = await prompter.promptSingle<string>(<IQuestion>{
				type: QuestionTypes.input,
				name: 'inputPrompt',
				message: localize('promptBDCUsername', "{0}Please provide the username to connect to the BDC Controller:", errorMessage),
				default: username
			});
			if (!username) {
				console.log(`User cancelled out of username prompt for BDC Controller`);
				break;
			}
			const newPassword = await prompter.promptSingle<string>(<IQuestion>{
				type: QuestionTypes.password,
				name: 'passwordPrompt',
				message: localize('promptBDCPassword', "Please provide the password to connect to the BDC Controller"),
				default: ''
			});
			if (!password) {
				console.log(`User cancelled out of password prompt for BDC Controller`);
				break;
			}
			const controller = bdcApi.getClusterController(controllerEndpoint, authType, newUsername, newPassword);
			try {
				await controller.getClusterConfig();
				return controller;
			} catch (err) {
				errorMessage = localize('bdcConnectError', "Error: {0}. ", err.message ?? err);
			}
		}
		throw new Error(localize('clusterControllerConnectionRequired', "A connection to the cluster controller is required to run Spark jobs"));
	}
}

interface ICredentials {
	'url': string;
}

interface ISparkMagicConfig {
	kernel_python_credentials: ICredentials;
	kernel_scala_credentials: ICredentials;
	kernel_r_credentials: ICredentials;
	ignore_ssl_errors?: boolean;
	logging_config: {
		handlers: {
			magicsHandler: {
				home_path: string;
				class?: string;
				formatter?: string
			}
		}
	};
}
