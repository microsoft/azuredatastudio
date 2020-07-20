/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ExtensionContext } from 'vscode';

import { azureResource } from '../../azure-resource';
import { AzureResourceDatabaseTreeDataProvider } from './databaseTreeDataProvider';
import { IAzureResourceService } from '../../interfaces';

export class AzureResourceDatabaseProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _databaseService: IAzureResourceService<azureResource.AzureResourceDatabase>,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceDatabaseTreeDataProvider(this._databaseService, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.database';
	}
}
