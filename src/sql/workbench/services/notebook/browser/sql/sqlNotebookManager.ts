/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as vscode from 'vscode';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';
import { SqlSessionManager } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';

export class SqlNotebookManager implements nb.NotebookProvider {
	private _contentManager: nb.ContentManager;
	private _sessionManager: nb.SessionManager;

	constructor(instantiationService: IInstantiationService) {
		this._contentManager = instantiationService.createInstance(LocalContentManager);
		this._sessionManager = new SqlSessionManager(instantiationService);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	public get contentManager(): nb.ContentManager {
		return this._contentManager;
	}

	public get serverManager(): nb.ServerManager {
		return undefined;
	}

	public get sessionManager(): nb.SessionManager {
		return this._sessionManager;
	}

	getNotebookManager(notebookUri: vscode.Uri): Thenable<nb.NotebookManager> {
		throw new Error('Method not implemented.');
	}

	handleNotebookClosed(notebookUri: vscode.Uri): void {
		throw new Error('Method not implemented.');
	}

	public get standardKernels(): nb.IStandardKernel[] {
		return [];
	}
}
