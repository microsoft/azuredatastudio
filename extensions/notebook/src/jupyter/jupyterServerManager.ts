/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import { ServerConnection } from '@jupyterlab/services';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as utils from '../common/utils';
import { IServerInstance } from './common';
import { PerFolderServerInstance, IInstanceOptions } from './serverInstance';
import { CommandContext, BuiltInCommands } from '../common/constants';

export interface IServerManagerOptions {
	documentPath: string;
	jupyterInstallation: JupyterServerInstallation;
	extensionContext: vscode.ExtensionContext;
	factory?: ServerInstanceFactory;
}
export class LocalJupyterServerManager implements nb.ServerManager, vscode.Disposable {
	private _serverSettings: Partial<ServerConnection.ISettings>;
	private _onServerStarted = new vscode.EventEmitter<void>();
	private _instanceOptions: IInstanceOptions;
	private _jupyterServer: IServerInstance;
	factory: ServerInstanceFactory;
	constructor(private options: IServerManagerOptions) {
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

	public get jupyterServerInstallation(): JupyterServerInstallation | undefined {
		return this.options && this.options.jupyterInstallation;
	}

	public async startServer(kernelSpec: nb.IKernelSpec): Promise<void> {
		try {
			if (!this._jupyterServer) {
				this._jupyterServer = await this.doStartServer(kernelSpec);
				this.options.extensionContext.subscriptions.push(this);
				let partialSettings = LocalJupyterServerManager.getLocalConnectionSettings(this._jupyterServer.uri);
				this._serverSettings = partialSettings;
				this._onServerStarted.fire();
			}
		} catch (error) {
			// this is caught and notified up the stack, no longer showing a message here
			throw error;
		}
	}

	public dispose(): void {
		this.stopServer().catch(err => {
			let msg = utils.getErrorMessage(err);
			vscode.window.showErrorMessage(localize('shutdownError', "Shutdown of Notebook server failed: {0}", msg));
		});
	}

	public async stopServer(): Promise<void> {
		if (this._jupyterServer) {
			await this._jupyterServer.stop();
			this._jupyterServer = undefined;
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

	private async doStartServer(kernelSpec: nb.IKernelSpec): Promise<IServerInstance> { // We can't find or create servers until the installation is complete
		let installation = this.options.jupyterInstallation;
		await installation.promptForPythonInstall(kernelSpec.display_name);
		if (!installation.previewFeaturesEnabled) {
			await installation.promptForPackageUpgrade(kernelSpec.display_name);
		}
		vscode.commands.executeCommand(BuiltInCommands.SetContext, CommandContext.NotebookPythonInstalled, true);

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
		let notebookDir = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.documentPath))?.uri.fsPath;
		if (!notebookDir) {
			let docDir;
			// If a folder is passed in for documentPath, use the folder instead of calling dirname
			docDir = path.extname(this.documentPath) ? path.dirname(this.documentPath) : this.documentPath;
			if (docDir === '.') {
				// If the user is using a system version of python, then
				// '.' will try to create a notebook in a system directory.
				// Since this will fail due to permissions, use the user's
				// home folder instead.
				notebookDir = utils.getUserHome();
			} else {
				notebookDir = docDir;
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

		this._instanceOptions = serverInstanceOptions;

		let server = this.factory.createInstance(serverInstanceOptions);
		await server.configure();
		await server.start();

		return server;
	}
}

export class ServerInstanceFactory {

	createInstance(options: IInstanceOptions): IServerInstance {
		return new PerFolderServerInstance(options);
	}
}
