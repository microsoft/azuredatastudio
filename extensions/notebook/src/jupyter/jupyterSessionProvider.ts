/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { LocalJupyterServerManager } from './jupyterServerManager';
import { JupyterSessionManager } from './jupyterSessionManager';

export type ServerManagerFactory = (documentUri: vscode.Uri) => LocalJupyterServerManager;

export class JupyterSessionProvider implements nb.NotebookSessionProvider {
	public readonly providerId: string = constants.jupyterNotebookProviderId;
	private managerTracker = new Map<string, JupyterSessionManager>();

	constructor() {
	}

	public getSessionManager(notebookUri: vscode.Uri): Thenable<nb.SessionManager> {
		if (!notebookUri) {
			return Promise.reject(localize('errSessionUriMissing', "A notebook path is required to retrieve a session manager."));
		}
		return Promise.resolve(this.doGetNotebookManager(notebookUri));
	}

	public get sessionManagerCount(): number {
		return this.managerTracker.size;
	}

	private doGetNotebookManager(notebookUri: vscode.Uri): nb.SessionManager {
		let baseFolder = utils.transformPathToBaseFolder(notebookUri?.fsPath?.toString());
		let manager = this.managerTracker.get(baseFolder);
		if (!manager) {
			let baseFolderUri = vscode.Uri.file(baseFolder);
			if (!baseFolderUri) {
				baseFolderUri = notebookUri;
			}
			manager = new JupyterSessionManager();
			this.managerTracker.set(baseFolder, manager);
		}
		return manager;
	}

	handleNotebookClosed(notebookUri: vscode.Uri): void {
		if (!notebookUri) {
			// As this is a notification method, will skip throwing an error here
			return;
		}
		let baseFolder = utils.transformPathToBaseFolder(notebookUri.fsPath.toString());
		let sessionManager = this.managerTracker.get(baseFolder);
		if (sessionManager) {
			let session = sessionManager.listRunning().find(e => e.path === notebookUri.fsPath);
			if (session) {
				sessionManager.shutdown(session.id).then(undefined, err => console.error('Error shutting down session after notebook closed ', err));
			}
			if (sessionManager.listRunning().length === 0) {
				let notebookConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
				let timeoutInMinutes: number = notebookConfig.get(constants.jupyterServerShutdownTimeoutConfigKey);
				if (timeoutInMinutes > 0) {
					const timeoutInMs = timeoutInMinutes * 60 * 1000;
					setTimeout(() => {
						if (sessionManager.listRunning().length === 0) {
							this.managerTracker.delete(baseFolder);
							sessionManager.dispose();
						}
					}, timeoutInMs);
				}
			}
		}
	}
}
