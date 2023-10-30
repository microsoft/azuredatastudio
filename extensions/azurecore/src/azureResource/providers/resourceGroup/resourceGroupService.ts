/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';
import { ResourceServiceBase } from '../resourceTreeDataProviderBase';
import { resourceGroupQuery } from '../queryStringConstants';
import { DbServerGraphData } from '../../interfaces';

export class AzureResourceGroupService extends ResourceServiceBase<DbServerGraphData> {

	public override queryFilter: string = resourceGroupQuery;

	public override convertServerResource(resource: DbServerGraphData): azureResource.AzureResourceResourceGroup | undefined {
		return {
			id: resource.id,
			name: resource.name,
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName || ''
			},
			tenant: resource.tenantId
		};
	}
}
