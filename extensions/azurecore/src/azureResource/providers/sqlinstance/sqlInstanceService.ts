/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureResourceDatabaseServer } from '../../interfaces';
import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';

export interface SqlInstanceGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

const instanceQuery = 'where type == "microsoft.sql/managedinstances"';

export class SqlInstanceResourceService extends ResourceServiceBase<SqlInstanceGraphData, AzureResourceDatabaseServer> {

	protected get query(): string {
		return instanceQuery;
	}

	protected convertResource(resource: SqlInstanceGraphData): AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: 'master'
		};
	}
}
