/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';

import { ISerializationManager, ISerializationProvider, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { SqlSerializationManager } from 'sql/workbench/services/notebook/browser/sql/sqlSerializationManager';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class SqlSerializationProvider implements ISerializationProvider {
	private _manager: SqlSerializationManager;

	constructor(instantiationService: IInstantiationService) {
		this._manager = new SqlSerializationManager(instantiationService);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	getSerializationManager(notebookUri: URI): Thenable<ISerializationManager> {
		return Promise.resolve(this._manager);
	}
}
