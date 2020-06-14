/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';
import { azureResource } from '../../azure-resource';

export interface PostgresArcServerGraphData extends GraphData {
	properties: {
		admin: string;
	};
}

export const serversQuery = 'where type == "microsoft.azuredata/postgresinstances"';

export class PostgresServerArcService extends ResourceServiceBase<PostgresArcServerGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return serversQuery;
	}

	protected convertResource(resource: PostgresArcServerGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.name,
			loginName: resource.properties.admin,
			defaultDatabaseName: 'postgres',
			tenant: resource.tenantId
		};
	}
}
