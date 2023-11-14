/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceServiceBase } from '../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';
import { postgresArcServerQuery } from '../queryStringConstants';
import { PostgresArcServerGraphData } from '../../interfaces';
import { POSTGRES_ARC_SERVER_PROVIDER_ID } from '../../../constants';

export class PostgresServerArcService extends ResourceServiceBase<PostgresArcServerGraphData> {

	public override queryFilter: string = postgresArcServerQuery;

	public convertServerResource(resource: PostgresArcServerGraphData): azureResource.AzureResourceDatabaseServer | undefined {
		return {
			id: resource.id,
			name: resource.name,
			provider: POSTGRES_ARC_SERVER_PROVIDER_ID,
			fullName: resource.name,
			loginName: resource.properties.admin,
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
