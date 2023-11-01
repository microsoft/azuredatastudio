/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as vscode from 'vscode';
import { ServerConnection, SessionManager } from '@jupyterlab/services';

import { JupyterSessionManager } from './jupyterSessionManager';
import { LocalJupyterServerManager } from './jupyterServerManager';

export class JupyterExecuteManager implements nb.ExecuteManager, vscode.Disposable {
	protected _serverSettings: ServerConnection.ISettings;
	private _sessionManager: JupyterSessionManager;

	constructor(private _serverManager: LocalJupyterServerManager, sessionManager?: JupyterSessionManager) {
		this._sessionManager = sessionManager || new JupyterSessionManager();
		this._serverManager.onServerStarted(() => {
			this.setServerSettings(this._serverManager.serverSettings);
			this._sessionManager.installation = this._serverManager.instanceOptions.install;
		});
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
			void this._sessionManager.shutdownAll().then(() => this._sessionManager.dispose());
		}
		if (this._serverManager) {
			this._serverManager.stopServer().then(success => undefined, error => vscode.window.showErrorMessage(error));
		}
	}
}
