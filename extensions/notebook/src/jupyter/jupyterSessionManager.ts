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
import Logger from '../common/logger';

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

export class JupyterSessionManager implements nb.SessionManager, vscode.Disposable {
	private _ready: Deferred<void>;
	private _isReady: boolean;
	private _sessionManager: Session.IManager;
	private static _sessions: JupyterSession[] = [];
	private _installation: JupyterServerInstallation;

	constructor() {
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

		// Prompt for Python Install to check that all dependencies are installed.
		// This prevents the kernel from getting stuck if a user deletes a dependency after the server has been started.
		let kernelDisplayName: string = this.specs?.kernels.find(k => k.name === options.kernelName)?.display_name;
		await this._installation?.promptForPythonInstall(kernelDisplayName);

		let sessionImpl = await this._sessionManager.startNew(options);
		let jupyterSession = new JupyterSession(sessionImpl, this._installation, skipSettingEnvironmentVars, this._installation?.pythonEnvVarPath);
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
		await utils.ensureDir(sparkmagicConfDir);

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
			Logger.log(`Configuring Spark connection`);
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

				Logger.log(`Found controller endpoint ${controllerEndpoint.endpoint}`);
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
					Logger.log(`Querying controller for knox gateway endpoint`);
					// User doesn't have permission to see the gateway endpoint from the DMV so we need to query the controller instead
					const allEndpoints = (await clusterController.getEndPoints()).endPoints;
					gatewayEndpoint = allEndpoints?.find(ep => ep.name.toLowerCase() === KNOX_ENDPOINT_GATEWAY);
					if (!gatewayEndpoint) {
						throw new Error(localize('notebook.couldNotFindKnoxGateway', "Could not find Knox gateway endpoint"));
					}
				}
				Logger.log(`Got Knox gateway ${gatewayEndpoint.endpoint}`);
				let gatewayHostAndPort = utils.getHostAndPortFromEndpoint(gatewayEndpoint.endpoint);
				Logger.log(`Parsed knox host and port ${JSON.stringify(gatewayHostAndPort)}`);
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
			let doNotCallChangeEndpointLogMessage: string;
			if (utils.isIntegratedAuth(connectionProfile)) {
				doNotCallChangeEndpointParams = `%_do_not_call_change_endpoint --server=${server} --auth=Kerberos`;
				doNotCallChangeEndpointLogMessage = doNotCallChangeEndpointParams;
			} else {
				doNotCallChangeEndpointParams = `%_do_not_call_change_endpoint --username=${knoxUsername} --server=${server} --auth=Basic_Access`;
				doNotCallChangeEndpointLogMessage = doNotCallChangeEndpointParams + ` --password=${'*'.repeat(knoxPassword.length)}`;
				doNotCallChangeEndpointParams += ` --password=${knoxPassword}`;
			}
			Logger.log(`Change endpoint command '${doNotCallChangeEndpointLogMessage}'`);
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
			if (this.path && path.dirname(this.path)) {
				allCode += `%cd ${path.dirname(this.path)}\n`;
			}
			for (let i = 0; i < Object.keys(process.env).length; i++) {
				let key = Object.keys(process.env)[i];
				if (key.toLowerCase() === 'path' && this._pythonEnvVarPath) {
					allCode += `%set_env ${key}=${this._pythonEnvVarPath}\n`;
				} else {
					// Jupyter doesn't seem to alow for setting multiple variables at once, so doing it with multiple commands
					allCode += `%set_env ${key}=${process.env[key]}\n`;
				}
			}

			let future = this.sessionImpl.kernel.requestExecute({
				code: allCode,
				silent: true,
				store_history: false
			}, true);
			await future.done;
		}
		this._messagesComplete.resolve();
	}
}

async function getClusterController(controllerEndpoint: string, authType: bdc.AuthType, username?: string, password?: string): Promise<bdc.IClusterController | undefined> {
	Logger.log(`Getting cluster controller ${controllerEndpoint}. Auth=${authType} Username=${username} password=${'*'.repeat(password?.length ?? 0)}`);
	const bdcApi = <bdc.IExtension>await vscode.extensions.getExtension(bdc.constants.extensionName).activate();
	const controller = bdcApi.getClusterController(
		controllerEndpoint,
		authType,
		username,
		password);
	try {
		Logger.log(`Fetching endpoints for ${controllerEndpoint} to test connection...`);
		// We just want to test the connection - so using getEndpoints since that is available to all users (not just admin)
		await controller.getEndPoints();
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
				// We just want to test the connection - so using getEndpoints since that is available to all users (not just admin)
				await controller.getEndPoints();
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
