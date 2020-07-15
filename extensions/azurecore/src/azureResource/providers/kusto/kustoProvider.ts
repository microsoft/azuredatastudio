/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';

import { azureResource } from '../../azure-resource';
import { IAzureResourceService } from '../../interfaces';
import { KustoTreeDataProvider as KustoTreeDataProvider } from './kustoTreeDataProvider';

export class KustoProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _service: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new KustoTreeDataProvider(this._service, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.azureDataExplorer';
	}
}
