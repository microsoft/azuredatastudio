/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { queryGraphResources } from '../resourceTreeDataProviderBase';
import { azureResource, AzureAccount } from 'azurecore';
import { UniversalGraphData, IAzureResourceServerService, IAzureResourceDbService } from '../../interfaces';
import { where } from '../queryStringConstants';
import * as nls from 'vscode-nls';
import { AzureResourcePrefixes, ResourceCategory, analyticsKind, cosmosDbNoSqlKind, mongoDbKind } from '../../constants';
import {
	COSMOSDB_MONGO_PROVIDER_ID, DATABASE_PROVIDER_ID, DATABASE_SERVER_PROVIDER_ID, KUSTO_PROVIDER_ID, AZURE_MONITOR_PROVIDER_ID,
	MYSQL_FLEXIBLE_SERVER_PROVIDER_ID, POSTGRES_SERVER_PROVIDER_ID, POSTGRES_ARC_SERVER_PROVIDER_ID,
	SQLINSTANCE_PROVIDER_ID, SQLINSTANCE_ARC_PROVIDER_ID, SYNAPSE_SQL_POOL_PROVIDER_ID, SYNAPSE_WORKSPACE_PROVIDER_ID, POSTGRES_FLEXIBLE_SERVER_PROVIDER_ID, COSMOSDB_NOSQL_PROVIDER_ID, COSMOSDB_POSTGRES_PROVIDER_ID
} from '../../../constants';
import { Logger } from '../../../utils/Logger';

const localize = nls.loadMessageBundle();

export class AzureResourceUniversalService implements azureResource.IAzureResourceService {

	constructor(
		private registeredTreeDataProviders: Map<string, azureResource.IAzureResourceTreeDataProvider>
	) {
		this.queryFilter = this.generateUniversalQueryFilter();
	}

	public queryFilter: string;

	private generateUniversalQueryFilter(): string {
		let queryFilter = where;
		this.registeredTreeDataProviders.forEach((v, k) => {
			queryFilter += ' (' + v.getService().queryFilter + ') ' + 'or';
		})
		return queryFilter.substring(0, queryFilter.length - 3); // remove last || clause.
	}

	public getRegisteredTreeDataProviderInstance(id: string): azureResource.IAzureResourceTreeDataProvider {
		if (this.registeredTreeDataProviders.has(id)) {
			return this.registeredTreeDataProviders.get(id)!;
		}
		throw new Error(localize('azurecore.unregisteredProvider', 'Unrecognized Provider resource: {0}', id));
	}

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResource[]> {
		const convertedResources: azureResource.AzureResource[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		let graphResources: UniversalGraphData[] = await queryGraphResources<UniversalGraphData>(resourceClient, subscriptions, this.queryFilter);
		const ids = new Set<string>();
		graphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId)?.name;
				let converted: azureResource.AzureResource | undefined;
				let providerInfo = this.getProviderFromResourceType(res.type, res.kind);
				// Convert based on server/database type.
				if (providerInfo[1] === ResourceCategory.Server) {
					let serverProvider = providerInfo[0].getService() as IAzureResourceServerService<UniversalGraphData>;
					converted = serverProvider.convertServerResource(res);
				} else { // database
					// Don't select 'master' Azure databases as they are internal databases and repititive with server names.
					if (!res.kind?.endsWith('system')) {
						let dbProvider = providerInfo[0].getService() as IAzureResourceDbService<UniversalGraphData, UniversalGraphData>;
						let serverResource = this.getServerResource(res, graphResources);
						converted = dbProvider.convertDatabaseResource(res, serverResource);
					}
				}
				if (converted) {
					convertedResources.push(converted);
				}
			}
		});

		return convertedResources;
	}

	public getProviderFromResourceType(type: string, kind?: string):
		[provider: azureResource.IAzureResourceTreeDataProvider, category: ResourceCategory] {
		if ((type === azureResource.AzureResourceType.cosmosDbAccount && kind === mongoDbKind) || type === azureResource.AzureResourceType.cosmosDbMongoCluster) {
			return [this.getRegisteredTreeDataProviderInstance(COSMOSDB_MONGO_PROVIDER_ID), ResourceCategory.Server];
		} else if ((type === azureResource.AzureResourceType.cosmosDbAccount && kind === cosmosDbNoSqlKind)) {
			return [this.getRegisteredTreeDataProviderInstance(COSMOSDB_NOSQL_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.postgresServerGroup || type === azureResource.AzureResourceType.postgresServerGroupv2) {
			return [this.getRegisteredTreeDataProviderInstance(COSMOSDB_POSTGRES_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.sqlDatabase || type === azureResource.AzureResourceType.sqlSynapseSqlDatabase) {
			return [this.getRegisteredTreeDataProviderInstance(DATABASE_PROVIDER_ID), ResourceCategory.Database];
		} else if (type === azureResource.AzureResourceType.sqlServer && kind !== analyticsKind) {
			return [this.getRegisteredTreeDataProviderInstance(DATABASE_SERVER_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.kustoClusters) {
			return [this.getRegisteredTreeDataProviderInstance(KUSTO_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.logAnalytics) {
			return [this.getRegisteredTreeDataProviderInstance(AZURE_MONITOR_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.mysqlFlexibleServer) {
			return [this.getRegisteredTreeDataProviderInstance(MYSQL_FLEXIBLE_SERVER_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.postgresServer || type === azureResource.AzureResourceType.postgresServerv2 || type === azureResource.AzureResourceType.postgresSingleServer) {
			return [this.getRegisteredTreeDataProviderInstance(POSTGRES_SERVER_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.postgresFlexibleServer) {
			return [this.getRegisteredTreeDataProviderInstance(POSTGRES_FLEXIBLE_SERVER_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.azureArcPostgresServer) {
			return [this.getRegisteredTreeDataProviderInstance(POSTGRES_ARC_SERVER_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.sqlManagedInstance) {
			return [this.getRegisteredTreeDataProviderInstance(SQLINSTANCE_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.azureArcSqlManagedInstance) {
			return [this.getRegisteredTreeDataProviderInstance(SQLINSTANCE_ARC_PROVIDER_ID), ResourceCategory.Server];
		} else if (type === azureResource.AzureResourceType.sqlSynapseSqlPool) {
			return [this.getRegisteredTreeDataProviderInstance(SYNAPSE_SQL_POOL_PROVIDER_ID), ResourceCategory.Database];
		} else if (type === azureResource.AzureResourceType.sqlSynapseWorkspace) {
			return [this.getRegisteredTreeDataProviderInstance(SYNAPSE_WORKSPACE_PROVIDER_ID), ResourceCategory.Server];
		}
		Logger.error(`Type provider not registered: ${type}`);
		throw new Error(localize('azurecore.unregisteredProviderType', 'Unrecognized Provider resource type: {0}', type));
	}

	public getProviderFromResourceId(id: string): azureResource.IAzureResourceTreeDataProvider {
		if (id.startsWith(AzureResourcePrefixes.cosmosdb)) {
			return this.getRegisteredTreeDataProviderInstance(COSMOSDB_MONGO_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.database)) {
			return this.getRegisteredTreeDataProviderInstance(DATABASE_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.databaseServer)) {
			return this.getRegisteredTreeDataProviderInstance(DATABASE_SERVER_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.kusto)) {
			return this.getRegisteredTreeDataProviderInstance(KUSTO_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.logAnalytics)) {
			return this.getRegisteredTreeDataProviderInstance(AZURE_MONITOR_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.mySqlFlexibleServer)) {
			return this.getRegisteredTreeDataProviderInstance(MYSQL_FLEXIBLE_SERVER_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.postgresServer)) {
			return this.getRegisteredTreeDataProviderInstance(POSTGRES_SERVER_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.postgresFlexibleServer)) {
			return this.getRegisteredTreeDataProviderInstance(POSTGRES_FLEXIBLE_SERVER_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.postgresServerArc)) {
			return this.getRegisteredTreeDataProviderInstance(POSTGRES_ARC_SERVER_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.sqlInstance)) {
			return this.getRegisteredTreeDataProviderInstance(SQLINSTANCE_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.sqlInstanceArc)) {
			return this.getRegisteredTreeDataProviderInstance(SQLINSTANCE_ARC_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.synapseSqlPool)) {
			return this.getRegisteredTreeDataProviderInstance(SYNAPSE_SQL_POOL_PROVIDER_ID);
		} else if (id.startsWith(AzureResourcePrefixes.synapseWorkspace)) {
			return this.getRegisteredTreeDataProviderInstance(SYNAPSE_WORKSPACE_PROVIDER_ID);
		}
		Logger.error(`Unrecognized provider prefix for id: ${id}`);
		throw new Error(localize('azurecore.unregisteredProvider', 'Unrecognized Provider resource: {0}', id));
	}

	/**
	 * Resource Id format:
	 * '/subscriptions/<subscriptionid>/resourceGroups/<resourcegroupname>/providers/Microsoft.Sql/servers/<servername>/databases/<dbname>'
	 * We find server with it's name in the same subscription, as resource groups can still be different.
	 */
	private getServerResource(resource: UniversalGraphData, allResources: UniversalGraphData[]): UniversalGraphData | undefined {
		const resourceParts = resource.id.split('/');
		const serverNameIndex = resourceParts.length - 3;
		const subscriptionId = resourceParts[2];
		return allResources.find(res => res.name === resourceParts[serverNameIndex]
			&& res.subscriptionId === subscriptionId) ?? undefined;
	}
}
