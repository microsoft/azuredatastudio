/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ResourceServiceBase } from '../../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';
import { cosmosPostgresDbQuery } from '../../queryStringConstants';
import { DbServerGraphData } from '../../../interfaces';
import { COSMOSDB_POSTGRES_PROVIDER_ID } from '../../../../constants';

export interface AzureResourcePostgresDatabaseServer extends azureResource.AzureResourceDatabaseServer {
	isServer: boolean;
}

export class CosmosDbPostgresService extends ResourceServiceBase<DbServerGraphData> {
	public override queryFilter: string = cosmosPostgresDbQuery;

	public convertServerResource(resource: DbServerGraphData): AzureResourcePostgresDatabaseServer | undefined {
		let host = resource.name;
		const isServer = resource.type === azureResource.AzureResourceType.cosmosDbPostgresCluster;
		if (isServer) {
			const url = new URL(resource.properties.connectionString);
			host = url.hostname;
		}
		return {
			id: resource.id,
			name: resource.name,
			provider: COSMOSDB_POSTGRES_PROVIDER_ID,
			isServer: isServer,
			fullName: host,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: '',
			tenant: resource.tenantId,
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName || ''
			}
		};
	}
}
