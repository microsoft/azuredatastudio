/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotebookManager, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/common/notebookService';
import { LocalContentManager } from 'sql/workbench/services/notebook/node/localContentManager';
import { SqlSessionManager } from 'sql/workbench/services/notebook/sql/sqlSessionManager';

export class SqlNotebookManager implements INotebookManager {
	private _contentManager: nb.ContentManager;
	private _sessionManager: nb.SessionManager;

	constructor(private _instantiationService: IInstantiationService) {
		this._contentManager = new LocalContentManager();
		this._sessionManager = new SqlSessionManager(this._instantiationService);
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
}