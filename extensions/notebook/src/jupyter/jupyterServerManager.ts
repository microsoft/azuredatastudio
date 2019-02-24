/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';
import * as vscode from 'vscode';
import * as path from 'path';
import { ServerConnection } from '@jupyterlab/services';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ApiWrapper } from '../common/apiWrapper';
import JupyterServerInstallation from './jupyterServerInstallation';
import * as utils from '../common/utils';
import { IServerInstance } from './common';
import { PerNotebookServerInstance, IInstanceOptions } from './serverInstance';

export interface IServerManagerOptions {
	documentPath: string;
	jupyterInstallation: Promise<JupyterServerInstallation>;
	extensionContext: vscode.ExtensionContext;
	apiWrapper?: ApiWrapper;
	factory?: ServerInstanceFactory;
}
export class LocalJupyterServerManager implements nb.ServerManager, vscode.Disposable {
	private _serverSettings: Partial<ServerConnection.ISettings>;
	private _onServerStarted = new vscode.EventEmitter<void>();
	private _instanceOptions: IInstanceOptions;
	private apiWrapper: ApiWrapper;
	private jupyterServer: IServerInstance;
	factory: ServerInstanceFactory;
	constructor(private options: IServerManagerOptions) {
		this.apiWrapper = options.apiWrapper || new ApiWrapper();
		this.factory = options.factory || new ServerInstanceFactory();
	}

	public get serverSettings(): Partial<ServerConnection.ISettings> {
		return this._serverSettings;
	}

	public get isStarted(): boolean {
		return !!this.jupyterServer;
	}

	public get instanceOptions(): IInstanceOptions {
		return this._instanceOptions;
	}

	public get onServerStarted(): vscode.Event<void> {
		return this._onServerStarted.event;
	}

	public async startServer(): Promise<void> {
		try {
			this.jupyterServer = await this.doStartServer();
			this.options.extensionContext.subscriptions.push(this);
			let partialSettings = LocalJupyterServerManager.getLocalConnectionSettings(this.jupyterServer.uri);
			this._serverSettings = partialSettings;
			this._onServerStarted.fire();

		} catch (error) {
			this.apiWrapper.showErrorMessage(localize('startServerFailed', 'Starting local Notebook server failed with error {0}', utils.getErrorMessage(error)));
			throw error;
		}
	}

	public dispose(): void {
		this.stopServer().catch(err => {
			let msg = utils.getErrorMessage(err);
			this.apiWrapper.showErrorMessage(localize('shutdownError', 'Shutdown of Notebook server failed: {0}', msg));
		});
	}

	public async stopServer(): Promise<void> {
		if (this.jupyterServer) {
			await this.jupyterServer.stop();
		}
	}

	public static getLocalConnectionSettings(uri: vscode.Uri): Partial<ServerConnection.ISettings> {
		return {
			baseUrl: `${uri.scheme}://${uri.authority}`,
			token: LocalJupyterServerManager.getToken(uri.query)
		};
	}

	private static getToken(query: string): string {
		if (query) {
			let parts = query.split('=');
			if (parts && parts.length >= 2) {
				return parts[1];
			}
		}
		return '';
	}

	private get documentPath(): string {
		return this.options.documentPath;
	}

	private async doStartServer(): Promise<IServerInstance> {        // We can't find or create servers until the installation is complete
		let installation = await this.options.jupyterInstallation;

		// Calculate the path to use as the notebook-dir for Jupyter based on the path of the uri of the
		// notebook to open. This will be the workspace folder if the notebook uri is inside a workspace
		// folder. Otherwise, it will be the folder that the notebook is inside. Ultimately, this means
		// a new notebook server will be started for each folder a notebook is opened from.
		//
		// eg, opening:
		// /path1/nb1.ipynb
		// /path2/nb2.ipynb
		// /path2/nb3.ipynb
		// ... will result in 2 notebook servers being started, one for /path1/ and one for /path2/
		let notebookDir = this.apiWrapper.getWorkspacePathFromUri(vscode.Uri.file(this.documentPath));
		notebookDir = notebookDir || path.dirname(this.documentPath);

		// TODO handle notification of start/stop status
		// notebookContext.updateLoadingMessage(localizedConstants.msgJupyterStarting);

		// TODO refactor server instance so it doesn't need the kernel. Likely need to reimplement this
		// for notebook version
		let serverInstanceOptions: IInstanceOptions = {
			documentPath: this.documentPath,
			notebookDirectory: notebookDir,
			install: installation
		};

		this._instanceOptions = serverInstanceOptions;

		let server = this.factory.createInstance(serverInstanceOptions);
		await server.configure();
		await server.start();

		return server;
	}
}

export class ServerInstanceFactory {

	createInstance(options: IInstanceOptions): IServerInstance {
		return new PerNotebookServerInstance(options);
	}
}

