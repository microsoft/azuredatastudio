/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';
import { azureResource } from '../../azure-resource';

export interface SqlInstanceArcGraphData extends GraphData {
	properties: {
		admin: string;
		hybridDataManager: string;
	};
}

const instanceQuery = 'where type == "microsoft.azuredata/sqlinstances"';
export class SqlInstanceArcResourceService extends ResourceServiceBase<SqlInstanceArcGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return instanceQuery;
	}

	protected convertResource(resource: SqlInstanceArcGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.name,
			loginName: resource.properties.admin,
			defaultDatabaseName: 'master',
			tenant: resource.tenantId
		};
	}
}
