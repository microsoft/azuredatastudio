/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { GraphData, queryGraphResources } from '../resourceTreeDataProviderBase';
import { azureResource, AzureAccount } from 'azurecore';
import { IAzureResourceService } from '../../interfaces';
import { synapseWorkspacesQuery } from '../queryStringConstants';

/**
 * Properties returned by the Synapse query are different from the server ones and have to be treated differently.
 */
export interface SynapseWorkspaceGraphData extends GraphData {
	properties: {
		/**
		 * SQL connectivity endpoint and other endpoints are found here, instead of fullyQualifiedDomainName.
		 */
		connectivityEndpoints: { sql: string };
		/**
		 * managedResourceGroupName is the resource group used by any SQL pools inside the workspace
		 * which is different from the resource group of the workspace itself.
		 */
		managedResourceGroupName: string;
		/**
		 * administratorLogin is called sqlAdministratorLogin here.
		 */
		sqlAdministratorLogin: string;
	};
}

export class AzureResourceSynapseWorkspaceService implements IAzureResourceService<azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return synapseWorkspacesQuery;
	}

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabaseServer[]> {
		const convertedResources: azureResource.AzureResourceDatabaseServer[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		let serverGraphResources: SynapseWorkspaceGraphData[] = await queryGraphResources<SynapseWorkspaceGraphData>(resourceClient, subscriptions, this.query);
		const ids = new Set<string>();
		serverGraphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId)?.name;
				const converted = this.convertResource(res);
				convertedResources.push(converted);
			}
		});

		return convertedResources;
	}

	protected convertResource(resource: SynapseWorkspaceGraphData): azureResource.AzureResourceDatabaseServer {

		return {
			id: resource.id,
			name: resource.name,
			fullName: resource.properties.connectivityEndpoints?.sql,
			loginName: resource.properties.sqlAdministratorLogin,
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
