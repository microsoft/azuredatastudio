/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ResourceServiceBase, GraphData } from '../../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';


interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

const serversQuery = `where type == "${azureResource.AzureResourceType.cosmosDbAccount}" and kind == "MongoDB"`;

export class CosmosDbMongoService extends ResourceServiceBase<DbServerGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return serversQuery;
	}

	protected convertResource(resource: DbServerGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: '',
			tenant: resource.tenantId,
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName
			}
		};
	}
}
