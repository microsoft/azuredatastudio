/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';
import { sqlInstanceQuery } from '../queryStringConstants';
import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';

interface SqlInstanceGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

export class SqlInstanceResourceService extends ResourceServiceBase<SqlInstanceGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return sqlInstanceQuery;
	}

	protected convertResource(resource: SqlInstanceGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
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
