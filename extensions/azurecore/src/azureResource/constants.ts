/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum AzureResourceItemType {
	account = 'azure.resource.itemType.account',
	subscription = 'azure.resource.itemType.subscription',
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
	cosmosDBMongoAccount = 'azure.resource.itemType.cosmosDBMongoAccount'
}

export enum AzureResourceServiceNames {
	resourceService = 'AzureResourceService',
	resourceGroupService = 'AzureResourceGroupService',
	cacheService = 'AzureResourceCacheService',
	accountService = 'AzureResourceAccountService',
	subscriptionService = 'AzureResourceSubscriptionService',
	subscriptionFilterService = 'AzureResourceSubscriptionFilterService',
	tenantService = 'AzureResourceTenantService',
	terminalService = 'AzureTerminalService',
}

export const mssqlProvider = 'MSSQL';
