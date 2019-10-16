/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import { ServerConnection } from '@jupyterlab/services';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ApiWrapper } from '../common/apiWrapper';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as utils from '../common/utils';
import { IServerInstance } from './common';
import { PerDriveServerInstance, IInstanceOptions } from './serverInstance';
import { CommandContext } from '../common/constants';

export interface IServerManagerOptions {
	documentPath: string;
	jupyterInstallation: JupyterServerInstallation;
	extensionContext: vscode.ExtensionContext;
	apiWrapper?: ApiWrapper;
	factory?: ServerInstanceFactory;
}
export class LocalJupyterServerManager implements nb.ServerManager, vscode.Disposable {
	private _serverSettings: Partial<ServerConnection.ISettings>;
	private _onServerStarted = new vscode.EventEmitter<void>();
	private _instanceOptions: IInstanceOptions;
	private _apiWrapper: ApiWrapper;
	private _jupyterServer: IServerInstance;
	factory: ServerInstanceFactory;
	constructor(private options: IServerManagerOptions) {
		this._apiWrapper = options.apiWrapper || new ApiWrapper();
		this.factory = options.factory || new ServerInstanceFactory();
	}

	public get serverSettings(): Partial<ServerConnection.ISettings> {
		return this._serverSettings;
	}

	public get isStarted(): boolean {
		return !!this._jupyterServer;
	}

	public get instanceOptions(): IInstanceOptions {
		return this._instanceOptions;
	}

	public get onServerStarted(): vscode.Event<void> {
		return this._onServerStarted.event;
	}

	public async startServer(): Promise<void> {
		try {
			this._jupyterServer = await this.doStartServer();
			this.options.extensionContext.subscriptions.push(this);
			let partialSettings = LocalJupyterServerManager.getLocalConnectionSettings(this._jupyterServer.uri);
			this._serverSettings = partialSettings;
			this._onServerStarted.fire();

		} catch (error) {
			// this is caught and notified up the stack, no longer showing a message here
			throw error;
		}
	}

	public dispose(): void {
		this.stopServer().catch(err => {
			let msg = utils.getErrorMessage(err);
			this._apiWrapper.showErrorMessage(localize('shutdownError', 'Shutdown of Notebook server failed: {0}', msg));
		});
	}

	public async stopServer(): Promise<void> {
		if (this._jupyterServer) {
			await this._jupyterServer.stop();
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

	private async doStartServer(): Promise<IServerInstance> { // We can't find or create servers until the installation is complete
		let installation = this.options.jupyterInstallation;
		await installation.promptForPythonInstall();
		await installation.promptForPackageUpgrade();
		this._apiWrapper.setCommandContext(CommandContext.NotebookPythonInstalled, true);

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
		let notebookDir = this._apiWrapper.getWorkspacePathFromUri(vscode.Uri.file(this.documentPath));
		let docDir;
		if (notebookDir) {
			docDir = path.dirname(notebookDir);
		} else {
			docDir = path.dirname(this.documentPath);
		}
		let parsedPath = path.parse(docDir);
		let userHome = utils.getUserHome();
		// If you don't match the docDir's casing for drive letters, a 404 will result
		// when trying to create a new session on Windows
		if (docDir && docDir[0] !== userHome[0] && docDir[0].toLowerCase() === userHome[0].toLowerCase()) {
			userHome = docDir[0] + userHome.substr(1);
		}
		let relativePathDocDirUserHome = path.relative(docDir, userHome);
		if (!docDir || docDir === '.' || docDir === parsedPath.root || relativePathDocDirUserHome.includes('..') || relativePathDocDirUserHome === '') {
			// If the user is using a system version of python, then
			// '.' will try to create a notebook in a system directory.
			// Since this will fail due to permissions, use the user's
			// home folder instead.
			notebookDir = userHome;
		} else {
			let splitDirName: string[] = [];
			if (docDir && docDir !== '.' && parsedPath) {
				splitDirName = path.dirname(this.documentPath).split(path.sep);
			}
			if (splitDirName.length > 1) {
				notebookDir = path.join(parsedPath.root, splitDirName[1]);
			} else {
				notebookDir = userHome;
			}
		}

		// TODO handle notification of start/stop status
		// notebookContext.updateLoadingMessage(localizedConstants.msgJupyterStarting);

		// TODO refactor server instance so it doesn't need the kernel. Likely need to reimplement this
		// for notebook version
		let serverInstanceOptions: IInstanceOptions = {
			documentPath: this.documentPath,
			notebookDirectory: notebookDir,
			install: installation
		};

		let existingInstance = this.factory.checkIfInstanceExists(serverInstanceOptions);
		if (existingInstance) {
			return existingInstance;
		}

		this._instanceOptions = serverInstanceOptions;

		let server = this.factory.createInstance(serverInstanceOptions);
		await server.configure();
		await server.start();

		return server;
	}
}

export class ServerInstanceFactory {
	private _instances: PerDriveServerInstance[] = [];

	public checkIfInstanceExists(options: IInstanceOptions): IServerInstance | undefined {
		let index = this._instances.findIndex(e => e.getNotebookDirectory() === options.notebookDirectory);
		if (index > -1) {
			if (this._instances[index] && this._instances[index].isStarted) {
				this._instances[index].incrementAttachedEditorCount();
				return this._instances[index];
			} else {
				this._instances.splice(index);
			}
		}
		return undefined;
	}

	public createInstance(options: IInstanceOptions): IServerInstance {
		let instance = new PerDriveServerInstance(options);
		this._instances.push(instance);
		return instance;
	}
}

