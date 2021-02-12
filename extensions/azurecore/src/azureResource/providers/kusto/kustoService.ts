/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azureResource';
import { ResourceServiceBase, GraphData } from '../resourceTreeDataProviderBase';

export interface KustoGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
		uri: string;
	};
}

const instanceQuery = `where type == "${azureResource.AzureResourceType.kustoClusters}"`;

export class KustoResourceService extends ResourceServiceBase<KustoGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return instanceQuery;
	}

	protected convertResource(resource: KustoGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.uri.replace('https://', ''),
			loginName: '',
			defaultDatabaseName: '',
			subscriptionId: resource.subscriptionId,
			tenant: resource.tenantId
		};
	}
}
