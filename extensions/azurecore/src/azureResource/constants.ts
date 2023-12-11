/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum AzureResourceItemType {
	account = 'azure.resource.itemType.account',
	singleTenantAccount = 'azure.resource.itemType.singleTenantAccount',
	multipleTenantAccount = 'azure.resource.itemType.multipleTenantAccount',
	subscription = 'azure.resource.itemType.subscription',
	tenant = 'azure.resource.itemType.tenant',
	databaseContainer = 'azure.resource.itemType.databaseContainer',
	database = 'azure.resource.itemType.database',
	databaseServerContainer = 'azure.resource.itemType.databaseServerContainer',
	databaseServer = 'azure.resource.itemType.databaseServer',
	synapseSqlPoolContainer = 'azure.resource.itemType.synapseSqlPoolContainer',
	synapseSqlPool = 'azure.resource.itemType.synapseSqlPool',
	synapseWorkspaceContainer = 'azure.resource.itemType.synapseWorkspaceContainer',
	synapseWorkspace = 'azure.resource.itemType.synapseWorkspace',
	azureDataExplorerContainer = 'azure.resource.itemType.azureDataExplorerContainer',
	azureDataExplorer = 'azure.resource.itemType.azureDataExplorer',
	sqlInstance = 'azure.resource.itemType.sqlInstance',
	message = 'azure.resource.itemType.message',
	azureMonitor = 'azure.resource.itemType.azureMonitor',
	azureMonitorContainer = 'azure.resource.itemType.azureMonitorContainer',
	cosmosDBMongoAccount = 'azure.resource.itemType.cosmosDBMongoAccount',
	cosmosDBNoSqlAccount = 'azure.resource.itemType.cosmosDBNoSqlAccount',
	cosmosDBMongoCluster = 'azure.resource.itemType.cosmosDBMongoCluster',
	cosmosDBPostgresAccount = 'azure.resource.itemType.cosmosDBPostgresAccount',
	cosmosDBPostgresCluster = 'azure.resource.itemType.cosmosDBPostgresCluster'
}

export enum AzureResourceServiceNames {
	resourceService = 'AzureResourceService',
	resourceGroupService = 'AzureResourceGroupService',
	cacheService = 'AzureResourceCacheService',
	accountService = 'AzureResourceAccountService',
	subscriptionService = 'AzureResourceSubscriptionService',
	subscriptionFilterService = 'AzureResourceSubscriptionFilterService',
	tenantService = 'AzureResourceTenantService',
	tenantFilterService = 'AzureResourceTenantFilterService',
	terminalService = 'AzureTerminalService',
}

export enum AzureResourcePrefixes {
	logAnalytics = 'LogAnalytics_',
	cosmosdb = 'Cosmosdb_',
	database = 'database_',
	databaseServer = 'databaseServer_',
	kusto = 'Kusto_',
	mySqlFlexibleServer = 'mySqlFlexibleServer_',
	postgresServerArc = 'postgresServerArc_',
	postgresFlexibleServer = 'postgresFlexibleServer_',
	postgresServer = 'postgresServer_',
	sqlInstance = 'sqlInstance_',
	sqlInstanceArc = 'sqlInstanceArc_',
	synapseSqlPool = 'synapseSqlPool_',
	synapseWorkspace = 'synapseWorkspace_'
}

export const mssqlProvider = 'MSSQL';
export const logAnalyticsProvider = 'LOGANALYTICS';
export const cosmosDBMongoProvider = 'COSMOSDB_MONGO';
export const cosmosDBNoSqlProvider = 'COSMOSDB_NOSQL';
export const kustoProvider = 'KUSTO';
export const mySqlProvider = 'MySQL';
export const pgsqlProvider = 'PGSQL';

// Kinds
export const analyticsKind = 'v12.0,analytics';
export const mongoDbKind = 'MongoDB';
export const cosmosDbNoSqlKind = 'GlobalDocumentDB';

export enum ResourceCategory {
	Server = 0,
	Database = 1
}
