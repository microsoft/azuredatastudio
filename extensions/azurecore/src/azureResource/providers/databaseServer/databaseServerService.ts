/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';

export interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
		connectivityEndpoints?: { sql: string };
		managedResourceGroupName?: string;
	};
}

export const synapseQuery = `where type == "microsoft.synapse/workspaces"`;

export const serversQuery = `where type == "${azureResource.AzureResourceType.sqlServer}" and kind != "v12.0,analytics"`;

export class AzureResourceDatabaseServerService extends ResourceServiceBase<DbServerGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return serversQuery;
	}

	protected convertResource(resource: DbServerGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.connectivityEndpoints?.sql || resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: 'master',
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName
			},
			tenant: resource.tenantId,
			resourceGroup: resource.resourceGroup
		};
	}
}
