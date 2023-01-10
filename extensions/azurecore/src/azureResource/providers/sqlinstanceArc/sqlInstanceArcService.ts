/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';
import { sqlInstanceArcQuery } from '../queryStringConstants';

export interface SqlInstanceArcGraphData extends GraphData {
	properties: {
		admin: string;
		hybridDataManager: string;
	};
}

export class SqlInstanceArcResourceService extends ResourceServiceBase<SqlInstanceArcGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return sqlInstanceArcQuery;
	}

	protected convertResource(resource: SqlInstanceArcGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.name,
			loginName: resource.properties.admin,
			defaultDatabaseName: 'master',
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName || ''
			},
			tenant: resource.tenantId,
			resourceGroup: resource.resourceGroup
		};
	}
}
