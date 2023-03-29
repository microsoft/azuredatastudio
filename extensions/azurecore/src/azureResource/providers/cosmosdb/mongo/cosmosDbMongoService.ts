/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ResourceServiceBase } from '../../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';
import { cosmosMongoDbQuery } from '../../queryStringConstants';
import { DbServerGraphData } from '../../../interfaces';
import { COSMOSDB_MONGO_PROVIDER_ID } from '../../../../constants';

export interface AzureResourceMongoDatabaseServer extends azureResource.AzureResourceDatabaseServer {
	isServer: boolean;
}

export class CosmosDbMongoService extends ResourceServiceBase<DbServerGraphData> {
	public override queryFilter: string = cosmosMongoDbQuery;

	public convertServerResource(resource: DbServerGraphData): AzureResourceMongoDatabaseServer | undefined {
		return {
			id: resource.id,
			name: resource.name,
			provider: COSMOSDB_MONGO_PROVIDER_ID,
			isServer: resource.type === azureResource.AzureResourceType.cosmosDbCluster,
			fullName: resource.properties.fullyQualifiedDomainName,
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
