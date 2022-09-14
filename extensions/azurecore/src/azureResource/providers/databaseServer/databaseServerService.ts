/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { ResourceServiceBase, GraphData, queryGraphResources } from '../resourceTreeDataProviderBase';
import { azureResource, AzureAccount } from 'azurecore';
import { serversQuery, synapseQuery } from './serverQueryStrings';

export interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
		connectivityEndpoints?: { sql: string };
		managedResourceGroupName?: string;
		sqlAdministratorLogin?: string;
	};
}

export class AzureResourceDatabaseServerService extends ResourceServiceBase<DbServerGraphData, azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return serversQuery;
	}

	public override async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabaseServer[]> {
		const convertedResources: azureResource.AzureResourceDatabaseServer[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		let graphResources = await queryGraphResources<DbServerGraphData>(resourceClient, subscriptions, this.query);
		if (this.query === serversQuery) {
			let synapseGraphResources = await queryGraphResources<DbServerGraphData>(resourceClient, subscriptions, synapseQuery);
			graphResources = graphResources.concat(synapseGraphResources);
		}
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

	protected convertResource(resource: DbServerGraphData): azureResource.AzureResourceDatabaseServer {
		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.connectivityEndpoints?.sql || resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.sqlAdministratorLogin || resource.properties.administratorLogin,
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
