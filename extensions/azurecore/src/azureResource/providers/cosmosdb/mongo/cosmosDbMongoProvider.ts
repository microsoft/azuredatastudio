/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';

import { azureResource } from 'azurecore';
import { IAzureResourceService } from '../../../interfaces';
import { CosmosDbMongoTreeDataProvider } from './cosmosDbMongoTreeDataProvider';

export class CosmosDbMongoProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _databaseServerService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new CosmosDbMongoTreeDataProvider(this._databaseServerService, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.cosmosDbMongo';
	}
}
