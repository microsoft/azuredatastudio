/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../../apiWrapper';

import { azureResource } from '../../azure-resource';
import { AzureResourceDatabaseTreeDataProvider } from './databaseTreeDataProvider';
import { IAzureResourceService, AzureResourceDatabase } from '../../interfaces';

export class AzureResourceDatabaseProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _databaseService: IAzureResourceService<AzureResourceDatabase>,
		private _apiWrapper: ApiWrapper,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceDatabaseTreeDataProvider(this._databaseService, this._apiWrapper, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.database';
	}
}
