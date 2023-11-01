/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { DatabaseGraphData, DbServerGraphData, GraphData, IAzureResourceDbService } from '../../interfaces';
import { sqlServerQuery, sqlDatabaseQuery, where } from '../queryStringConstants';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { queryGraphResources } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';
import { DATABASE_PROVIDER_ID } from '../../../constants';

export class AzureResourceDatabaseService implements IAzureResourceDbService<DbServerGraphData, DatabaseGraphData> {

	public queryFilter: string = sqlDatabaseQuery;

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabase[]> {
		const databases: azureResource.AzureResourceDatabase[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });

		// Query servers and databases in parallel (start all promises before waiting on the 1st)
		let serverQueryPromise = queryGraphResources<GraphData>(resourceClient, subscriptions, where + sqlServerQuery);
		let dbQueryPromise = queryGraphResources<GraphData>(resourceClient, subscriptions, where + this.queryFilter);
		let servers: DbServerGraphData[] = await serverQueryPromise as DbServerGraphData[];
		let dbByGraph: DatabaseGraphData[] = await dbQueryPromise as DatabaseGraphData[];

		// Group servers by resource group, then merge DB results with servers so we
		// can get the login name and server fully qualified name to use for connections
		let rgMap = new Map<string, (DbServerGraphData)[]>();
		servers.forEach(s => {
			let serversForRg = rgMap.get(s.resourceGroup) || [];
			serversForRg.push(s);
			rgMap.set(s.resourceGroup, serversForRg);
		});

		// Match database ID. When calling exec [0] is full match, [1] is resource group name, [2] is server name
		const svrIdRegExp = new RegExp(`\/subscriptions\/.+\/resourceGroups\/(.+)\/providers\/Microsoft\.Sql\/servers\/(.+)\/databases\/.+`);
		const synapseDBRegExp = new RegExp(`\/subscriptions\/.+\/resourceGroups\/(.+)\/providers\/Microsoft\.Synapse\/workspaces\/(.+)\/databases\/.+`);

		dbByGraph.forEach(db => {
			// Filter master DBs, and for all others find their server to get login information
			let serversForRg = rgMap.get(db.resourceGroup);
			if (serversForRg && !db.kind.endsWith('system') && (svrIdRegExp.test(db.id) || synapseDBRegExp.test(db.id))) {
				const founds = svrIdRegExp.exec(db.id) ?? synapseDBRegExp.exec(db.id);
				if (!founds) {
					console.warn(`Could not parse server name from ID ${db.id}`);
					return;
				}
				const serverName = founds[2];
				let server = servers.find(s => s.name === serverName);
				if (server) {
					databases.push(this.convertDatabaseResource(db, server)!);
				}
			}
		});

		return databases;
	}

	public convertDatabaseResource(resource: DatabaseGraphData, server?: DbServerGraphData | undefined): azureResource.AzureResourceDatabase | undefined {
		if (server) {
			return {
				name: resource.name,
				id: resource.id,
				provider: DATABASE_PROVIDER_ID,
				serverName: server.name,
				serverFullName: server.properties.fullyQualifiedDomainName,
				loginName: server.properties.administratorLogin,
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
}
