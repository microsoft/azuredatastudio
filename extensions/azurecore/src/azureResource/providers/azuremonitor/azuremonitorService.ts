/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';
import { logAnalyticsQuery } from '../queryStringConstants';
import { ResourceServiceBase } from '../resourceTreeDataProviderBase';
import { AzureMonitorGraphData } from '../../interfaces';
import { AZURE_MONITOR_PROVIDER_ID } from '../../../constants';

export class AzureMonitorResourceService extends ResourceServiceBase<AzureMonitorGraphData> {
	public override queryFilter: string = logAnalyticsQuery;

	public convertServerResource(resource: AzureMonitorGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			provider: AZURE_MONITOR_PROVIDER_ID,
			fullName: resource.properties.customerId,
			loginName: '',
			defaultDatabaseName: '',
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName || ''
			},
			tenant: resource.tenantId,
			resourceGroup: resource.resourceGroup
		};
	}
}
