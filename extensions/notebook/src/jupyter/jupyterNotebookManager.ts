/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as vscode from 'vscode';
import { ServerConnection, SessionManager } from '@jupyterlab/services';

import { JupyterSessionManager } from './jupyterSessionManager';
import { LocalJupyterServerManager } from './jupyterServerManager';

export class JupyterNotebookManager implements nb.NotebookManager, vscode.Disposable {
	protected _serverSettings: ServerConnection.ISettings;
	private _sessionManager: JupyterSessionManager;

	constructor(private _serverManager: LocalJupyterServerManager, sessionManager?: JupyterSessionManager) {
		let pythonEnvVarPath = this._serverManager && this._serverManager.jupyterServerInstallation && this._serverManager.jupyterServerInstallation.pythonEnvVarPath;
		this._sessionManager = sessionManager || new JupyterSessionManager(pythonEnvVarPath);
		this._serverManager.onServerStarted(() => {
			this.setServerSettings(this._serverManager.serverSettings);
			this._sessionManager.installation = this._serverManager.instanceOptions.install;
		});
	}
	public get contentManager(): nb.ContentManager {
		return undefined;
	}

	public get sessionManager(): nb.SessionManager {
		return this._sessionManager;
	}

	public get serverManager(): nb.ServerManager {
		return this._serverManager;
	}

	public get serverSettings(): ServerConnection.ISettings {
		return this._serverSettings;
	}

	public setServerSettings(settings: Partial<ServerConnection.ISettings>): void {
		this._serverSettings = ServerConnection.makeSettings(settings);
		this._sessionManager.setJupyterSessionManager(new SessionManager({ serverSettings: this._serverSettings }));
	}

	dispose() {
		if (this._sessionManager) {
			this._sessionManager.shutdownAll().then(() => this._sessionManager.dispose());
		}
		if (this._serverManager) {
			this._serverManager.stopServer().then(success => undefined, error => vscode.window.showErrorMessage(error));
		}
	}
}
