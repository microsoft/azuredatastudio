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

export class AzureResourceDatabaseServerService implements IAzureResourceService<azureResource.AzureResourceDatabaseServer> {

	protected get query(): string {
		return sqlServersQuery;
	}

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabaseServer[]> {
		const convertedResources: azureResource.AzureResourceDatabaseServer[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		/**
		 * We need to get the list of servers minus the Synapse Workspaces,
		 * then we need to make another query to get them.
		 *
		 * This is done because the first query provides invalid endpoints for Synapse Workspaces
		 * While the second one provides them as one of its properties.
		 *
		 * They have to be processed in different ways by convertResource as their structure differs
		 * in terms of properties. (See above)
		 *
		 * Queries must be made separately due to union not being recognized by resourceGraph resource calls.
		*/
		let combinedGraphResources: (DbServerGraphData | SynapseWorkspaceGraphData)[] = [];
		let serverGraphResources: DbServerGraphData[] = await queryGraphResources<DbServerGraphData>(resourceClient, subscriptions, this.query);
		let synapseGraphResources: SynapseWorkspaceGraphData[] = await queryGraphResources<SynapseWorkspaceGraphData>(resourceClient, subscriptions, synapseWorkspacesQuery);
		combinedGraphResources = combinedGraphResources.concat(serverGraphResources).concat(synapseGraphResources);
		const ids = new Set<string>();
		combinedGraphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId).name;
				const converted = this.convertResource(res);
				convertedResources.push(converted);
			}
		});

		return convertedResources;
	}

	protected convertResource(resource: DbServerGraphData | SynapseWorkspaceGraphData): azureResource.AzureResourceDatabaseServer {

		return {
			id: resource.id,
			name: resource.name,
			// Determine if resource object is for Synapse Workspace or not and get the needed property from the correct place.
			fullName: (resource as SynapseWorkspaceGraphData).properties.connectivityEndpoints?.sql ?? (resource as DbServerGraphData).properties.fullyQualifiedDomainName,
			loginName: (resource as SynapseWorkspaceGraphData).properties.sqlAdministratorLogin ?? (resource as DbServerGraphData).properties.administratorLogin,
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
