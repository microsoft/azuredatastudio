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
	sqlInstance = 'azure.resource.itemType.sqlInstance',
	message = 'azure.resource.itemType.message'
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
