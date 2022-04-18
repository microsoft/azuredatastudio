/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DbServerGraphData } from '../databaseServer/databaseServerService';
import { azureResource } from 'azurecore';
import { ResourceServiceBase } from '../resourceTreeDataProviderBase';

export class AzureResourceGroupService extends ResourceServiceBase<DbServerGraphData, azureResource.AzureResourceResourceGroup> {

	protected get query(): string {
		return `ResourceContainers | where type=="${azureResource.AzureResourceType.resourceGroup}"`;
	}

	protected convertResource(resource: DbServerGraphData): azureResource.AzureResourceResourceGroup {
		return {
			id: resource.id,
			name: resource.name,
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName
			},
			tenant: resource.tenantId
		};
	}
}
