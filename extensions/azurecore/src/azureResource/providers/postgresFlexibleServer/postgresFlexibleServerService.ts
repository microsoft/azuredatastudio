/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ResourceServiceBase } from '../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';
import { postgresFlexibleServerQuery } from '../queryStringConstants';
import { DbServerGraphData } from '../../interfaces';
import { POSTGRES_FLEXIBLE_SERVER_PROVIDER_ID } from '../../../constants';

export class PostgresFlexibleServerService extends ResourceServiceBase<DbServerGraphData> {

	public override queryFilter: string = postgresFlexibleServerQuery;

	public override convertServerResource(resource: DbServerGraphData): azureResource.AzureResourceDatabaseServer | undefined {
		return {
			id: resource.id,
			name: resource.name,
			provider: POSTGRES_FLEXIBLE_SERVER_PROVIDER_ID,
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
