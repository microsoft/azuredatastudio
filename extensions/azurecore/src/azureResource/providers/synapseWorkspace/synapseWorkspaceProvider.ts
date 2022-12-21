/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';

import { azureResource } from 'azurecore';
import { AzureResourceSynapseWorkspaceTreeDataProvider } from './synapseWorkspaceTreeDataProvider';
import { IAzureResourceService } from '../../interfaces';

export class AzureResourceSynapseWorkspaceProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _synapseWorkspaceService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceSynapseWorkspaceTreeDataProvider(this._synapseWorkspaceService, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.synapseWorkspace';
	}
}
