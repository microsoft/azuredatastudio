/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from '../../azure-resource';
import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';

interface SqlInstanceGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

const instanceQuery = 'where type == "microsoft.sql/managedinstances"';

export class SqlInstanceResourceService extends ResourceServiceBase<SqlInstanceGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return instanceQuery;
	}

	protected convertResource(resource: SqlInstanceGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: 'master',
			tenant: resource.tenantId
		};
	}
}
