/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';

import { ISerializationManager, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class SqlSerializationManager implements ISerializationManager {
	private _manager: LocalContentManager;

	constructor(instantiationService: IInstantiationService) {
		this._manager = instantiationService.createInstance(LocalContentManager);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	public get contentManager(): nb.ContentManager {
		return this._manager;
	}
}
