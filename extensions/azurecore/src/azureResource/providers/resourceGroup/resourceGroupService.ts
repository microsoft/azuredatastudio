/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DbServerGraphData } from '../databaseServer/databaseServerService';
import { azureResource } from '../../azure-resource';
import { ResourceServiceBase } from '../resourceTreeDataProviderBase';

export class AzureResourceGroupService extends ResourceServiceBase<DbServerGraphData, azureResource.AzureResourceResourceGroup> {

	protected get query(): string {
		return 'ResourceContainers | where type=="microsoft.resources/subscriptions/resourcegroups"';
	}

	protected convertResource(resource: DbServerGraphData): azureResource.AzureResourceResourceGroup {
		return {
			id: resource.id,
			name: resource.name
		};
	}
}
