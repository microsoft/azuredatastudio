/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb, ServerInfo, connection, IConnectionProfile } from 'sqlops';
import { Session, Kernel } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
import { Uri } from 'vscode';
import * as path from 'path';
import * as utils from '../common/utils';
const localize = nls.loadMessageBundle();

import { JupyterKernel } from './jupyterKernel';
import { Deferred } from '../common/promise';

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

	'ignore_ssl_errors': true,

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
const KNOX_ENDPOINT = 'knox';
const SQL_PROVIDER = 'MSSQL';
const USER = 'user';
const DEFAULT_CLUSTER_USER_NAME = 'root';

export class JupyterSessionManager implements nb.SessionManager {
	private _ready: Deferred<void>;
	private _isReady: boolean;
	private _sessionManager: Session.IManager;
	private static _sessions: JupyterSession[] = [];

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
		let allKernels: nb.IAllKernels = {
			defaultKernel: specs.default,
			kernels: kernels
		};
		return allKernels;
	}

	public async startNew(options: nb.ISessionOptions): Promise<nb.ISession> {
		if (!this._isReady) {
			// no-op
			return Promise.reject(new Error(localize('errorStartBeforeReady', 'Cannot start a session, the manager is not yet initialized')));
		}
		let sessionImpl = await this._sessionManager.startNew(options);
		let jupyterSession = new JupyterSession(sessionImpl);
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
	}

	public shutdownAll(): Promise<void> {
		return this._sessionManager.shutdownAll();
	}

	public dispose(): void {
		this._sessionManager.dispose();
	}
}

export class JupyterSession implements nb.ISession {
	private _kernel: nb.IKernel;

	constructor(private sessionImpl: Session.ISession) {
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

	public async changeKernel(kernelInfo: nb.IKernelSpec): Promise<nb.IKernel> {
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

	public async configureConnection(connection: IConnectionProfile): Promise<void> {
		if (connection && connection.providerName && this.isSparkKernel(this.sessionImpl.kernel.name)) {
			// TODO may need to reenable a way to get the credential
			// await this._connection.getCredential();
			// %_do_not_call_change_endpoint is a SparkMagic command that lets users change endpoint options,
			// such as user/profile/host name/auth type

			//Update server info with bigdata endpoint - Unified Connection
			if (connection.providerName === SQL_PROVIDER) {
				let clusterEndpoint: IEndpoint = await this.getClusterEndpoint(connection.id, KNOX_ENDPOINT);
				if (!clusterEndpoint) {
					let kernelDisplayName: string = await this.getKernelDisplayName();
					return Promise.reject(new Error(localize('connectionNotValid', 'Spark kernels require a connection to a SQL Server big data cluster master instance.')));
				}
				connection.options[KNOX_ENDPOINT_SERVER] = clusterEndpoint.ipAddress;
				connection.options[KNOX_ENDPOINT_PORT] = clusterEndpoint.port;
				connection.options[USER] = DEFAULT_CLUSTER_USER_NAME;
			}
			else {
				connection.options[KNOX_ENDPOINT_PORT] = this.getKnoxPortOrDefault(connection);
			}
			this.setHostAndPort(':', connection);
			this.setHostAndPort(',', connection);

			let server = Uri.parse(utils.getLivyUrl(connection.options[KNOX_ENDPOINT_SERVER], connection.options[KNOX_ENDPOINT_PORT])).toString();
			let doNotCallChangeEndpointParams =
				`%_do_not_call_change_endpoint --username=${connection.options[USER]} --password=${connection.options['password']} --server=${server} --auth=Basic_Access`;
			let future = this.sessionImpl.kernel.requestExecute({
				code: doNotCallChangeEndpointParams
			}, true);
			await future.done;
		}
	}

	private async getKernelDisplayName(): Promise<string> {
		let spec = await this.kernel.getSpec();
		return spec.display_name;
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
	}

	private getKnoxPortOrDefault(connectionProfile: IConnectionProfile): string {
		let port = connectionProfile.options[KNOX_ENDPOINT_PORT];
		if (!port) {
			port = '30443';
		}
		return port;
	}

	private async getClusterEndpoint(profileId: string, serviceName: string): Promise<IEndpoint> {
		let serverInfo: ServerInfo = await connection.getServerInfo(profileId);
		if (!serverInfo || !serverInfo.options) {
			return undefined;
		}
		let endpoints: IEndpoint[] = serverInfo.options['clusterEndpoints'];
		if (!endpoints || endpoints.length === 0) {
			return undefined;
		}
		return endpoints.find(ep => ep.serviceName.toLowerCase() === serviceName.toLowerCase());
	}
}

interface ICredentials {
	'url': string;
}

interface IEndpoint {
	serviceName: string;
	ipAddress: string;
	port: number;
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