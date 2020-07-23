/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, ServerInfo, connection, IConnectionProfile } from 'azdata';
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

const KNOX_ENDPOINT_SERVER = 'host';
const KNOX_ENDPOINT_PORT = 'knoxport';
const KNOX_ENDPOINT_GATEWAY = 'gateway';
const CONTROLLER_ENDPOINT = 'controller';
const SQL_PROVIDER = 'MSSQL';
const USER = 'user';
const AUTHTYPE = 'authenticationType';
const INTEGRATED_AUTH = 'integrated';

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

	constructor(private sessionImpl: Session.ISession, private _installation: JupyterServerInstallation, skipSettingEnvironmentVars?: boolean, private _pythonEnvVarPath?: string) {
		this.setEnvironmentVars(skipSettingEnvironmentVars).catch(error => {
			console.error(`Unexpected exception setting Jupyter Session variables : ${error}`);
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
				if (this._installation.previewFeaturesEnabled) {
					await this._installation.promptForPythonInstall(kernelInfo.display_name);
				} else {
					await this._installation.promptForPackageUpgrade(kernelInfo.display_name);
				}
			} catch (err) {
				// Have to swallow the error here to prevent hangs when changing back to the old kernel.
				console.error(err.toString());
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
		if (connectionProfile && connectionProfile.providerName && this.isSparkKernel(this.sessionImpl.kernel.name)) {
			// %_do_not_call_change_endpoint is a SparkMagic command that lets users change endpoint options,
			// such as user/profile/host name/auth type

			let credentials;
			if (!this.isIntegratedAuth(connectionProfile)) {
				credentials = await connection.getCredentials(connectionProfile.id);
			}
			//Update server info with bigdata endpoint - Unified Connection
			if (connectionProfile.providerName === SQL_PROVIDER) {
				const endpoints = await this.getClusterEndpoints(connectionProfile.id);
				const gatewayEndpoint: utils.IEndpoint = endpoints?.find(ep => ep.serviceName.toLowerCase() === KNOX_ENDPOINT_GATEWAY);
				if (!gatewayEndpoint) {
					return Promise.reject(new Error(localize('connectionNotValid', "Spark kernels require a connection to a SQL Server Big Data Cluster master instance.")));
				}
				let gatewayHostAndPort = utils.getHostAndPortFromEndpoint(gatewayEndpoint.endpoint);
				connectionProfile.options[KNOX_ENDPOINT_SERVER] = gatewayHostAndPort.host;
				connectionProfile.options[KNOX_ENDPOINT_PORT] = gatewayHostAndPort.port;
				// root is the default username for pre-CU5 instances, so while we prefer to use the connection username
				// as a default now we'll still fall back to root if it's empty for some reason. (but the calls below should
				// get the actual correct value regardless)
				connectionProfile.options[USER] = connectionProfile.userName || 'root';
				if (!this.isIntegratedAuth(connectionProfile)) {
					try {
						const bdcApi = <bdc.IExtension>await vscode.extensions.getExtension(bdc.constants.extensionName).activate();
						const controllerEndpoint = endpoints.find(ep => ep.serviceName.toLowerCase() === CONTROLLER_ENDPOINT);
						const controller = bdcApi.getClusterController(controllerEndpoint.endpoint, 'basic', connectionProfile.userName, credentials.password);
						connectionProfile.options[USER] = await controller.getKnoxUsername(connectionProfile.userName);
					} catch (err) {
						console.log(`Unexpected error getting Knox username for Spark kernel: ${err}`);
					}
				}
			}
			else {
				connectionProfile.options[KNOX_ENDPOINT_PORT] = this.getKnoxPortOrDefault(connectionProfile);
			}
			this.setHostAndPort(':', connectionProfile);
			this.setHostAndPort(',', connectionProfile);

			let server = vscode.Uri.parse(utils.getLivyUrl(connectionProfile.options[KNOX_ENDPOINT_SERVER], connectionProfile.options[KNOX_ENDPOINT_PORT])).toString();
			let doNotCallChangeEndpointParams: string;
			if (this.isIntegratedAuth(connectionProfile)) {
				doNotCallChangeEndpointParams = `%_do_not_call_change_endpoint --server=${server} --auth=Kerberos`;
			} else {

				doNotCallChangeEndpointParams = `%_do_not_call_change_endpoint --username=${connectionProfile.options[USER]} --password=${credentials.password} --server=${server} --auth=Basic_Access`;
			}
			let future = this.sessionImpl.kernel.requestExecute({
				code: doNotCallChangeEndpointParams
			}, true);
			await future.done;
		}
	}

	private isIntegratedAuth(connection: IConnectionProfile): boolean {
		return connection.options[AUTHTYPE] && connection.options[AUTHTYPE].toLowerCase() === INTEGRATED_AUTH.toLowerCase();
	}

	private isSparkKernel(kernelName: string): boolean {
		return kernelName && kernelName.toLowerCase().indexOf('spark') > -1;
	}

	private setHostAndPort(delimeter: string, connection: IConnectionProfile): void {
		let originalHost = connection.options[KNOX_ENDPOINT_SERVER];
		if (!originalHost) {
			return;
		}
		let index = originalHost.indexOf(delimeter);
		if (index > -1) {
			connection.options[KNOX_ENDPOINT_SERVER] = originalHost.slice(0, index);
			connection.options[KNOX_ENDPOINT_PORT] = originalHost.slice(index + 1);
		}
	}

	private updateConfig(config: ISparkMagicConfig, creds: ICredentials, homePath: string): void {
		config.kernel_python_credentials = creds;
		config.kernel_scala_credentials = creds;
		config.kernel_r_credentials = creds;
		config.logging_config.handlers.magicsHandler.home_path = homePath;
		config.ignore_ssl_errors = utils.getIgnoreSslVerificationConfigSetting();
	}

	private getKnoxPortOrDefault(connectionProfile: IConnectionProfile): string {
		let port = connectionProfile.options[KNOX_ENDPOINT_PORT];
		if (!port) {
			port = '30443';
		}
		return port;
	}

	private async getClusterEndpoints(profileId: string): Promise<utils.IEndpoint[]> {
		let serverInfo: ServerInfo = await connection.getServerInfo(profileId);
		if (!serverInfo || !serverInfo.options) {
			return [];
		}
		return utils.getClusterEndpoints(serverInfo);
	}

	private async setEnvironmentVars(skip: boolean = false): Promise<void> {
		// The PowerShell kernel doesn't define the %cd and %set_env magics; no need to run those here then
		if (!skip && this.sessionImpl?.kernel?.name !== 'powershell') {
			let allCode: string = '';
			// Ensure cwd matches notebook path (this follows Jupyter behavior)
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
