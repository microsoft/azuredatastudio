/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';
import { postgresServerQuery } from '../queryStringConstants';

interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

export class PostgresServerService extends ResourceServiceBase<DbServerGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return postgresServerQuery;
	}

	protected convertResource(resource: DbServerGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: 'postgres',
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName || ''
			},
			tenant: resource.tenantId,
			resourceGroup: resource.resourceGroup
		};
	}
}
