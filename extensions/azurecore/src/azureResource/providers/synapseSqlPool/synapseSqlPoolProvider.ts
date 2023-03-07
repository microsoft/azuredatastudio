/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ExtensionContext } from 'vscode';

import { azureResource } from 'azurecore';
import { AzureResourceSynapseSqlPoolTreeDataProvider as AzureResourceSynapseSqlPoolTreeDataProvider } from './synapseSqlPoolTreeDataProvider';
import { IAzureResourceService } from '../../interfaces';

export class AzureResourceSynapseSqlPoolProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _synapseSqlPoolService: IAzureResourceService<azureResource.AzureResourceDatabase>,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceSynapseSqlPoolTreeDataProvider(this._synapseSqlPoolService, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.synapseSqlPool';
	}
}
