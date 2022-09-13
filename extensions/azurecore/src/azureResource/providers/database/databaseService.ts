/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { IAzureResourceService } from '../../interfaces';
import { serversQuery, synapseQuery, DbServerGraphData } from '../databaseServer/databaseServerService';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { queryGraphResources, GraphData } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

interface DatabaseGraphData extends GraphData {
	kind: string;
}
export class AzureResourceDatabaseService implements IAzureResourceService<azureResource.AzureResourceDatabase> {
	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabase[]> {
		const databases: azureResource.AzureResourceDatabase[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });

		// Query servers and databases in parallel (start both promises before waiting on the 1st)
		let synapseQueryPromise = queryGraphResources<GraphData>(resourceClient, subscriptions, synapseQuery);
		let serverQueryPromise = queryGraphResources<GraphData>(resourceClient, subscriptions, serversQuery);
		let dbQueryPromise = queryGraphResources<GraphData>(resourceClient, subscriptions, `where type == "${azureResource.AzureResourceType.sqlDatabase}"`);
		let server1: DbServerGraphData[] = await serverQueryPromise as DbServerGraphData[];
		let server2: DbServerGraphData[] = await synapseQueryPromise as DbServerGraphData[];
		let dbByGraph: DatabaseGraphData[] = await dbQueryPromise as DatabaseGraphData[];
		let servers: DbServerGraphData[] = server1.concat(server2);

		// Group servers by resource group, then merge DB results with servers so we
		// can get the login name and server fully qualified name to use for connections
		let rgMap = new Map<string, DbServerGraphData[]>();
		servers.forEach(s => {
			if (s.properties.connectivityEndpoints) {
				let serversForRg = rgMap.get(s.properties.managedResourceGroupName) || [];
				serversForRg.push(s);
				rgMap.set(s.properties.managedResourceGroupName, serversForRg);
			} else {
				let serversForRg = rgMap.get(s.resourceGroup) || [];
				serversForRg.push(s);
				rgMap.set(s.resourceGroup, serversForRg);
			}
		});

		// Match database ID. When calling exec [0] is full match, [1] is resource group name, [2] is server name
		const svrIdRegExp = new RegExp(`\/subscriptions\/.+\/resourceGroups\/(.+)\/providers\/Microsoft\.Sql\/servers\/(.+)\/databases\/.+`);

		dbByGraph.forEach(db => {
			// Filter master DBs, and for all others find their server to get login info
			let serversForRg = rgMap.get(db.resourceGroup);
			if (serversForRg && !db.kind.endsWith('system') && svrIdRegExp.test(db.id)) {
				const founds = svrIdRegExp.exec(db.id);
				const serverName = founds[2];
				let server = servers.find(s => s.name === serverName);
				if (server) {
					databases.push({
						name: db.name,
						id: db.id,
						serverName: server.name,
						serverFullName: server.properties.connectivityEndpoints?.sql || server.properties.fullyQualifiedDomainName,
						loginName: server.properties.administratorLogin,
						subscription: {
							id: db.subscriptionId,
							name: (subscriptions.find(sub => sub.id === db.subscriptionId))?.name
						},
						tenant: db.tenantId,
						resourceGroup: db.resourceGroup
					});
				}
			}
		});

		return databases;
	}
}
