/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { SqlSessionManager } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';

export class SqlExecuteManager implements nb.ExecuteManager {
	private _sessionManager: nb.SessionManager;

	constructor(instantiationService: IInstantiationService) {
		this._sessionManager = new SqlSessionManager(instantiationService);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	public get serverManager(): nb.ServerManager | undefined {
		return undefined;
	}

	public get sessionManager(): nb.SessionManager {
		return this._sessionManager;
	}
}
