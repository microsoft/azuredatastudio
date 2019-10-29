/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';
import { AzureResourceDatabaseServer } from '../../interfaces';


export interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

export const serversQuery = 'where type == "microsoft.sql/servers"';

export class AzureResourceDatabaseServerService extends ResourceServiceBase<DbServerGraphData, AzureResourceDatabaseServer> {

	protected get query(): string {
		return serversQuery;
	}

	protected convertResource(resource: DbServerGraphData): AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: 'master'
		};
	}
}
