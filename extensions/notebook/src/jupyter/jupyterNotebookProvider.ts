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
import { JupyterNotebookManager } from './jupyterNotebookManager';
import { LocalJupyterServerManager } from './jupyterServerManager';
import { JupyterSessionManager } from './jupyterSessionManager';

export type ServerManagerFactory = (documentUri: vscode.Uri) => LocalJupyterServerManager;

export class JupyterNotebookProvider implements nb.NotebookProvider {
	readonly providerId: string = constants.jupyterNotebookProviderId;
	private managerTracker = new Map<string, JupyterNotebookManager>();

	constructor(private createServerManager: ServerManagerFactory) {
	}

	public getNotebookManager(notebookUri: vscode.Uri): Thenable<nb.NotebookManager> {
		if (!notebookUri) {
			return Promise.reject(localize('errNotebookUriMissing', "A notebook path is required"));
		}
		return Promise.resolve(this.doGetNotebookManager(notebookUri));
	}

	public get notebookManagerCount(): number {
		return this.managerTracker.size;
	}

	private doGetNotebookManager(notebookUri: vscode.Uri): nb.NotebookManager {
		let baseFolder = this.transformToBaseFolder(notebookUri?.fsPath?.toString());
		let manager = this.managerTracker.get(baseFolder);
		if (!manager) {
			let baseFolderUri = vscode.Uri.file(baseFolder);
			if (!baseFolderUri) {
				baseFolderUri = notebookUri;
			}
			let serverManager = this.createServerManager(baseFolderUri);
			manager = new JupyterNotebookManager(serverManager);
			this.managerTracker.set(baseFolder, manager);
		}
		return manager;
	}

	handleNotebookClosed(notebookUri: vscode.Uri): void {
		if (!notebookUri) {
			// As this is a notification method, will skip throwing an error here
			return;
		}
		let baseFolder = this.transformToBaseFolder(notebookUri.fsPath.toString());
		let manager = this.managerTracker.get(baseFolder);
		if (manager) {
			let sessionManager = (manager.sessionManager as JupyterSessionManager);
			let session = sessionManager.listRunning().find(e => e.path === notebookUri.fsPath);
			if (session) {
				manager.sessionManager.shutdown(session.id);
			}
			if (sessionManager.listRunning().length === 0) {
				const FiveMinutesInMs = 5 * 60 * 1000;
				setTimeout(() => {
					if (sessionManager.listRunning().length === 0) {
						this.managerTracker.delete(baseFolder);
						manager.dispose();
					}
				}, FiveMinutesInMs);
			}
		}
	}

	public get standardKernels(): nb.IStandardKernel[] {
		return [];
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
