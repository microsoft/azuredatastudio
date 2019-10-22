/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotebookManager, INotebookProvider, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { SqlNotebookManager } from 'sql/workbench/services/notebook/browser/sql/sqlNotebookManager';

export class SqlNotebookProvider implements INotebookProvider {
	private manager: SqlNotebookManager;

	constructor(private _instantiationService: IInstantiationService) {
		this.manager = new SqlNotebookManager(this._instantiationService);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	getNotebookManager(notebookUri: URI): Thenable<INotebookManager> {
		return Promise.resolve(this.manager);
	}

	handleNotebookClosed(notebookUri: URI): void {
		// No-op
	}
}
