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

	export const enum HttpRequestMethod {
		GET,
		PUT,
		POST,
		DELETE
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
		/**
		 * Makes Azure REST requests to create, retrieve, update or delete access to azure service's resources.
		 * For reference to different service URLs, See https://docs.microsoft.com/en-us/rest/api/?view=Azure
		 * @param account The azure account used to acquire access token
		 * @param subscription The subscription under azure account where the service will perform operations.
		 * @param path The path for the service starting from '/subscription/..'. See https://docs.microsoft.com/en-us/rest/api/azure/.
		 * @param requestType Http request method. Currently GET, PUT, POST and DELETE methods are supported.
		 * @param requestBody Optional request body to be used in PUT and POST requests.
		 * @param ignoreErrors When this flag is set the method will not throw any runtime or service errors and will return the errors in errors array.
		 * @param host Use this to override the host. The default host is https://management.azure.com
		 */
		makeAzureRestRequest(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, path: string, requestType: HttpRequestMethod, requestBody?: any, ignoreErrors?: boolean, host?: string): Promise<AzureRestResponse>;
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
	export type ResourceQueryResult<T extends azureResource.AzureGraphResource> = { resources: T[], errors: Error[] };
	export type AzureRestResponse = { response: any, errors: Error[] };
}
