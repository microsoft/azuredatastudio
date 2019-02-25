/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../common/constants';
import { JupyterNotebookManager } from './jupyterNotebookManager';
import { LocalJupyterServerManager } from './jupyterServerManager';

export type ServerManagerFactory = (documentUri: vscode.Uri) => LocalJupyterServerManager;

export class JupyterNotebookProvider implements nb.NotebookProvider {
	readonly providerId: string = constants.jupyterNotebookProviderId;
	private managerTracker = new Map<string, JupyterNotebookManager>();

	constructor(private createServerManager: ServerManagerFactory) {
	}

	public getNotebookManager(notebookUri: vscode.Uri): Thenable<nb.NotebookManager> {
		if (!notebookUri) {
			return Promise.reject(localize('errNotebookUriMissing', 'A notebook path is required'));
		}
		return Promise.resolve(this.doGetNotebookManager(notebookUri));
	}

	private doGetNotebookManager(notebookUri: vscode.Uri): nb.NotebookManager {
		let uriString = notebookUri.toString();
		let manager = this.managerTracker.get(uriString);
		if (!manager) {
			let serverManager = this.createServerManager(notebookUri);
			manager = new JupyterNotebookManager(serverManager);
			this.managerTracker.set(uriString, manager);
		}
		return manager;
	}

	handleNotebookClosed(notebookUri: vscode.Uri): void {
		if (!notebookUri) {
			// As this is a notification method, will skip throwing an error here
			return;
		}
		let uriString = notebookUri.toString();
		let manager = this.managerTracker.get(uriString);
		if (manager) {
			this.managerTracker.delete(uriString);
			manager.dispose();
		}
	}

	public get standardKernels(): nb.IStandardKernel[] {
		return [
			{
				"name": "Python 3",
				"connectionProviderIds": []
			},
			{
				"name": "PySpark",
				"connectionProviderIds": ["HADOOP_KNOX"]
			},
			{
				"name": "PySpark3",
				"connectionProviderIds": ["HADOOP_KNOX"]
			},
			{
				"name": "Spark | R",
				"connectionProviderIds": ["HADOOP_KNOX"]
			},
			{
				"name": "Spark | Scala",
				"connectionProviderIds": ["HADOOP_KNOX"]
			}
		];
	}
}

