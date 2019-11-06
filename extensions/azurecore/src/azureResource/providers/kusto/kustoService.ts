/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureResourceDatabaseServer } from '../../interfaces';
import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';

export interface KustoGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

const instanceQuery = 'where type == "microsoft.kusto/clusters"';

export class KustoResourceService extends ResourceServiceBase<KustoGraphData, AzureResourceDatabaseServer> {

	protected get query(): string {
		return instanceQuery;
	}

	protected convertResource(resource: KustoGraphData): AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: '',
			defaultDatabaseName: ''
		};
	}
}
