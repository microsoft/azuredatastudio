/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { GraphData, IAzureResourceDbService, SynapseGraphData, SynapseWorkspaceGraphData } from '../../interfaces';
import { synapseWorkspacesQuery, synapseSqlPoolsQuery, where } from '../queryStringConstants';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { queryGraphResources } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';
import { SYNAPSE_SQL_POOL_PROVIDER_ID } from '../../../constants';

export class AzureResourceSynapseService implements IAzureResourceDbService<SynapseWorkspaceGraphData, SynapseGraphData> {

	// TODO: @Cheena
	public convertDatabaseResource(resource: SynapseGraphData, server?: SynapseWorkspaceGraphData | undefined): azureResource.AzureResourceDatabase | undefined {
		if (server) {
			return {
				name: resource.name,
				id: resource.id,
				provider: SYNAPSE_SQL_POOL_PROVIDER_ID,
				serverName: server.name,
				serverFullName: server.properties.connectivityEndpoints?.sql,
				loginName: server.properties.sqlAdministratorLogin,
				subscription: {
					id: resource.subscriptionId,
					name: resource.subscriptionName!
				},
				tenant: resource.tenantId,
				resourceGroup: resource.resourceGroup
			};
		} else {
			return undefined;
		}
	}

	public queryFilter: string = synapseSqlPoolsQuery;
	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabase[]> {
		const databases: azureResource.AzureResourceDatabase[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });

		// Query synapse servers, and databases in parallel (start all promises before waiting on the 1st)
		let synapseQueryPromise = queryGraphResources<GraphData>(resourceClient, subscriptions, where + this.queryFilter);
		let synapseWorkspaceQueryPromise = queryGraphResources<GraphData>(resourceClient, subscriptions, where + synapseWorkspacesQuery);
		let synapse = await synapseQueryPromise as SynapseGraphData[];
		let synapseWorkspaceByGraph: SynapseWorkspaceGraphData[] = await synapseWorkspaceQueryPromise as SynapseWorkspaceGraphData[];

		// Group servers by resource group, then merge DB results with servers so we
		// can get the login name and server fully qualified name to use for connections
		let rgMap = new Map<string, SynapseWorkspaceGraphData[]>();
		synapseWorkspaceByGraph.forEach(s => {
			// As the resource is a Synapse Workspace, we need to use the managedResourceGroupName
			// (any SQL pools inside will use this instead of the regular resource group associated with the workspace itself).
			let serversForRg = rgMap.get(s.properties.managedResourceGroupName) || [];
			serversForRg.push(s);
			rgMap.set(s.properties.managedResourceGroupName, serversForRg);
		});

		// Match database ID. When calling exec [0] is full match, [1] is resource group name, [2] is server name
		const svrIdRegExp = new RegExp(`\/subscriptions\/.+\/resourceGroups\/(.+)\/providers\/Microsoft\.Synapse\/workspaces\/(.+)\/sqlPools\/.+`);

		synapse.forEach(db => {
			// Filter master DBs, and for all others find their server to get login info
			if (!db.kind.endsWith('system') && svrIdRegExp.test(db.id)) {
				const founds = svrIdRegExp.exec(db.id);
				if (!founds) {
					console.warn(`Could not parse server name from ID ${db.id}`);
					return;
				}
				const serverName = founds[2];
				let server = synapseWorkspaceByGraph.find(s => s.name === serverName);
				if (server) {
					let res = this.convertDatabaseResource(db, server);
					databases.push(res!);
				}
			}
		});

		return databases;
	}
}
