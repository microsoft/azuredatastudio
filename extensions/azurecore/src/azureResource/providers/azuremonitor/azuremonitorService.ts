/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azureResource';
import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';

export interface AzureMonitorGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
		uri: string;
		customerId: string
	};
}

const instanceQuery = `where type == "${azureResource.AzureResourceType.logAnalytics}"`;

export class AzureMonitorResourceService extends ResourceServiceBase<AzureMonitorGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return instanceQuery;
	}

	protected convertResource(resource: AzureMonitorGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.customerId,
			loginName: '',
			defaultDatabaseName: '',
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName
			},
			tenant: resource.tenantId,
			resourceGroup: resource.resourceGroup
		};
	}
}
