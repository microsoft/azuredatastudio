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

export type ServerManagerFactory = (documentUri: vscode.Uri) => LocalJupyterServerManager;

export class JupyterServerProvider implements nb.NotebookServerProvider {
	readonly providerId: string = constants.jupyterNotebookProviderId;
	private managerTracker = new Map<string, LocalJupyterServerManager>();

	constructor(private createServerManager: ServerManagerFactory) {
	}

	public getServerManager(notebookUri: vscode.Uri): Thenable<nb.ServerManager> {
		if (!notebookUri) {
			return Promise.reject(localize('errServerUriMissing', "A notebook path is required to retrieve a server manager."));
		}
		return Promise.resolve(this.doGetServerManager(notebookUri));
	}

	public get notebookManagerCount(): number {
		return this.managerTracker.size;
	}

	private doGetServerManager(notebookUri: vscode.Uri): nb.ServerManager {
		let baseFolder = utils.transformPathToBaseFolder(notebookUri?.fsPath?.toString());
		let manager = this.managerTracker.get(baseFolder);
		if (!manager) {
			let baseFolderUri = vscode.Uri.file(baseFolder);
			if (!baseFolderUri) {
				baseFolderUri = notebookUri;
			}
			manager = this.createServerManager(baseFolderUri);
			this.managerTracker.set(baseFolder, manager);
		}
		return manager;
	}
}
