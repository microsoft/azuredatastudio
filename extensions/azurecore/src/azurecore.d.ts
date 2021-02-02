/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'azurecore' {
	import * as azdata from 'azdata';
	import { azureResource } from 'azureResource';

	/**
	 * Covers defining what the azurecore extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */
	export const enum extension {
		name = 'Microsoft.azurecore'
	}

	/**
	 * Enumeration of the Azure datacenter regions. See https://docs.microsoft.com/dotnet/api/microsoft.azure.management.resourcemanager.fluent.core.region
	 */
	export const enum AzureRegion {
		australiacentral = 'australiacentral',
		australiacentral2 = 'australiacentral2',
		australiaeast = 'australiaeast',
		australiasoutheast = 'australiasoutheast',
		brazilsouth = 'brazilsouth',
		brazilsoutheast = 'brazilsoutheast',
		canadacentral = 'canadacentral',
		canadaeast = 'canadaeast',
		centralindia = 'centralindia',
		centralus = 'centralus',
		centraluseuap = 'centraluseuap',
		eastasia = 'eastasia',
		eastus = 'eastus',
		eastus2 = 'eastus2',
		eastus2euap = 'eastus2euap',
		francecentral = 'francecentral',
		francesouth = 'francesouth',
		germanynorth = 'germanynorth',
		germanywestcentral = 'germanywestcentral',
		japaneast = 'japaneast',
		japanwest = 'japanwest',
		koreacentral = 'koreacentral',
		koreasouth = 'koreasouth',
		northcentralus = 'northcentralus',
		northeurope = 'northeurope',
		norwayeast = 'norwayeast',
		norwaywest = 'norwaywest',
		southafricanorth = 'southafricanorth',
		southafricawest = 'southafricawest',
		southcentralus = 'southcentralus',
		southeastasia = 'southeastasia',
		southindia = 'southindia',
		switzerlandnorth = 'switzerlandnorth',
		switzerlandwest = 'switzerlandwest',
		uaecentral = 'uaecentral',
		uaenorth = 'uaenorth',
		uksouth = 'uksouth',
		ukwest = 'ukwest',
		westcentralus = 'westcentralus',
		westeurope = 'westeurope',
		westindia = 'westindia',
		westus = 'westus',
		westus2 = 'westus2',
	}

	export interface IExtension {
		getSubscriptions(account?: azdata.Account, ignoreErrors?: boolean, selectedOnly?: boolean): Promise<GetSubscriptionsResult>;
		getResourceGroups(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Promise<GetResourceGroupsResult>;
		getSqlManagedInstances(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlManagedInstancesResult>;
		getSqlServers(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlServersResult>;
		getSqlVMServers(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlVMServersResult>;
		getStorageAccounts(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetStorageAccountResult>;
		getBlobContainers(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetBlobContainersResult>;
		getFileShares(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetFileSharesResult>;
		getMigrationController(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, resourceGroupName: string, regionName: string, controllerName: string, ignoreErrors?: boolean): Promise<GetMigrationControllerResult>;
		createMigrationController(account:azdata.Account, subscription: azureResource.AzureResourceSubscription, resourceGroupName: string, regionName: string, controllerName: string, ignoreErrors?:boolean): Promise<CreateMigrationControllerResult>;
		getMigrationControllerAuthKeys(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, resourceGroupName: string, regionName: string, controllerName: string, ignoreErrors?: boolean): Promise<GetMigrationControllerAuthKeysResult>;

		/**
		 * Converts a region value (@see AzureRegion) into the localized Display Name
		 * @param region The region value
		 */
		getRegionDisplayName(region?: string): string;
		provideResources(): azureResource.IAzureResourceProvider[];

		runGraphQuery<T extends azureResource.AzureGraphResource>(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors: boolean, query: string): Promise<ResourceQueryResult<T>>;
	}

	export type GetSubscriptionsResult = { subscriptions: azureResource.AzureResourceSubscription[], errors: Error[] };
	export type GetResourceGroupsResult = { resourceGroups: azureResource.AzureResourceResourceGroup[], errors: Error[] };
	export type GetSqlManagedInstancesResult = { resources: azureResource.AzureGraphResource[], errors: Error[] };
	export type GetSqlServersResult = { resources: azureResource.AzureGraphResource[], errors: Error[] };
	export type GetSqlVMServersResult = { resources: azureResource.AzureGraphResource[], errors: Error[] };
	export type GetStorageAccountResult = { resources: azureResource.AzureGraphResource[], errors: Error[] };
	export type GetBlobContainersResult = { blobContainers: azureResource.BlobContainer[], errors: Error[] };
	export type GetFileSharesResult = { fileShares: azureResource.FileShare[], errors: Error[] };
	export type GetMigrationControllerResult = { controller: azureResource.MigrationController | undefined, errors: Error[] };
	export type CreateMigrationControllerResult = { controller: azureResource.MigrationController | undefined, errors: Error[] };
	export type GetMigrationControllerAuthKeysResult = { keyName1: string, keyName2: string, errors: Error[] };

	export type ResourceQueryResult<T extends azureResource.AzureGraphResource> = { resources: T[], errors: Error[] };
	export type HttpRequestResult = { response: any, errors: Error[] };
}
