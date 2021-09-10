/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExecuteManager, IExecuteProvider, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { SqlExecuteManager } from 'sql/workbench/services/notebook/browser/sql/sqlExecuteManager';

export class SqlExecuteProvider implements IExecuteProvider {
	private manager: SqlExecuteManager;

	constructor(private _instantiationService: IInstantiationService) {
		this.manager = new SqlExecuteManager(this._instantiationService);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	getExecuteManager(notebookUri: URI): Thenable<IExecuteManager> {
		return Promise.resolve(this.manager);
	}

	handleNotebookClosed(notebookUri: URI): void {
		// No-op
	}
}
