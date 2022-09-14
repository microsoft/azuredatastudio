/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { GraphData, queryGraphResources } from '../resourceTreeDataProviderBase';
import { azureResource, AzureAccount } from 'azurecore';
import { sqlServersQuery, synapseWorkspacesQuery } from './serverQueryStrings';
import { IAzureResourceService } from '../../interfaces';

export interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

export interface DbSynapseGraphData extends GraphData {
	properties: {
		connectivityEndpoints: { sql: string };
		managedResourceGroupName: string;
		sqlAdministratorLogin: string;
	};
}

export class AzureResourceDatabaseServerService implements IAzureResourceService<azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return sqlServersQuery;
	}

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabaseServer[]> {
		const convertedResources: azureResource.AzureResourceDatabaseServer[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		let graphResources: (DbSynapseGraphData | DbServerGraphData)[] = await queryGraphResources<DbServerGraphData>(resourceClient, subscriptions, this.query);
		let synapseGraphResources: (DbSynapseGraphData | DbServerGraphData)[] = await queryGraphResources<DbSynapseGraphData>(resourceClient, subscriptions, synapseWorkspacesQuery);
		graphResources = graphResources.concat(synapseGraphResources);
		const ids = new Set<string>();
		graphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId).name;
				const converted = this.convertResource(res);
				convertedResources.push(converted);
			}
		});

		return convertedResources;
	}

	protected convertResource(resource: DbServerGraphData | DbSynapseGraphData): azureResource.AzureResourceDatabaseServer {

		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.constructor.name === 'DbSynapseGraphData' ? (resource as DbSynapseGraphData).properties.connectivityEndpoints.sql : (resource as DbServerGraphData).properties.fullyQualifiedDomainName,
			loginName: resource.constructor.name === 'DbSynapseGraphData' ? (resource as DbSynapseGraphData).properties.sqlAdministratorLogin : (resource as DbServerGraphData).properties.administratorLogin,
			defaultDatabaseName: 'master',
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName
			},
			tenant: resource.tenantId,
			resourceGroup: resource.resourceGroup
		};
	}
}
