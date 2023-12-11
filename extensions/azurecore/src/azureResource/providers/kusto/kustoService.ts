/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';
import { kustoClusterQuery } from '../queryStringConstants';
import { ResourceServiceBase } from '../resourceTreeDataProviderBase';
import { KustoGraphData } from '../../interfaces';
import { KUSTO_PROVIDER_ID } from '../../../constants';

export class KustoResourceService extends ResourceServiceBase<KustoGraphData> {
	public override queryFilter: string = kustoClusterQuery;

	public convertServerResource(resource: KustoGraphData): azureResource.AzureResourceDatabaseServer | undefined {
		return {
			id: resource.id,
			name: resource.name,
			provider: KUSTO_PROVIDER_ID,
			fullName: resource.properties.uri.replace('https://', ''),
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
