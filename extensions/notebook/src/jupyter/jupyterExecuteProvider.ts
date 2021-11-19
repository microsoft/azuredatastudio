/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as path from 'path';
const localize = nls.loadMessageBundle();

import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { JupyterExecuteManager } from './jupyterExecuteManager';
import { LocalJupyterServerManager } from './jupyterServerManager';
import { JupyterSessionManager } from './jupyterSessionManager';

export type ServerManagerFactory = (documentUri: vscode.Uri) => LocalJupyterServerManager;

export class JupyterExecuteProvider implements nb.NotebookExecuteProvider {
	readonly providerId: string = constants.jupyterNotebookProviderId;
	private executeManagerTracker = new Map<string, JupyterExecuteManager>();

	constructor(private createServerManager: ServerManagerFactory) {
	}

	public getExecuteManager(notebookUri: vscode.Uri): Thenable<nb.ExecuteManager> {
		if (!notebookUri) {
			return Promise.reject(localize('errNotebookUriMissing', "A notebook path is required"));
		}
		return Promise.resolve(this.doGetExecuteManager(notebookUri));
	}

	public get executeManagerCount(): number {
		return this.executeManagerTracker.size;
	}

	private doGetExecuteManager(notebookUri: vscode.Uri): nb.ExecuteManager {
		let baseFolder = this.transformToBaseFolder(notebookUri?.fsPath?.toString());
		let manager = this.executeManagerTracker.get(baseFolder);
		if (!manager) {
			let baseFolderUri = vscode.Uri.file(baseFolder);
			if (!baseFolderUri) {
				baseFolderUri = notebookUri;
			}
			let serverManager = this.createServerManager(baseFolderUri);
			manager = new JupyterExecuteManager(serverManager);
			this.executeManagerTracker.set(baseFolder, manager);
		}
		return manager;
	}

	handleNotebookClosed(notebookUri: vscode.Uri): void {
		if (!notebookUri) {
			// As this is a notification method, will skip throwing an error here
			return;
		}
		let baseFolder = this.transformToBaseFolder(notebookUri.fsPath.toString());
		let manager = this.executeManagerTracker.get(baseFolder);
		if (manager) {
			let sessionManager = (manager.sessionManager as JupyterSessionManager);
			let session = sessionManager.listRunning().find(e => e.path === notebookUri.fsPath);
			if (session) {
				manager.sessionManager.shutdown(session.id).then(undefined, err => console.error('Error shutting down session after notebook closed ', err));
			}
			if (sessionManager.listRunning().length === 0) {
				let notebookConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
				let timeoutInMinutes: number = notebookConfig.get(constants.jupyterServerShutdownTimeoutConfigKey);
				if (timeoutInMinutes > 0) {
					const timeoutInMs = timeoutInMinutes * 60 * 1000;
					setTimeout(() => {
						if (sessionManager.listRunning().length === 0) {
							this.executeManagerTracker.delete(baseFolder);
							manager.dispose();
						}
					}, timeoutInMs);
				}
			}
		}
	}

	private transformToBaseFolder(notebookPath: string): string {
		let parsedPath = path.parse(notebookPath);
		let userHome = utils.getUserHome();
		let relativePathStrUserHome = path.relative(notebookPath, userHome);
		if (notebookPath === '.' || relativePathStrUserHome.endsWith('..') || relativePathStrUserHome === '') {
			// If you don't match the notebookPath's casing for drive letters,
			// a 404 will result when trying to create a new session on Windows
			if (notebookPath && userHome && notebookPath[0].toLowerCase() === userHome[0].toLowerCase()) {
				userHome = notebookPath[0] + userHome.substr(1);
			}
			// If the user is using a system version of python, then
			// '.' will try to create a notebook in a system directory.
			// Since this will fail due to permissions issues, use the user's
			// home folder instead.
			return userHome;
		} else {
			let splitDirName: string[] = path.dirname(notebookPath).split(path.sep);
			if (splitDirName.length > 1) {
				return path.join(parsedPath.root, splitDirName[1]);
			} else {
				return userHome;
			}
		}
	}
}
