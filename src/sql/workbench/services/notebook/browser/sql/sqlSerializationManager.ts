/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';

export class SqlSerializationManager implements nb.SerializationManager {
	private _contentManager: nb.ContentManager;

	constructor(instantiationService: IInstantiationService) {
		this._contentManager = instantiationService.createInstance(LocalContentManager);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	public get contentManager(): nb.ContentManager {
		return this._contentManager;
	}
}
