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
	 * Override of the Account type to enforce properties that are AzureAccountProperties
	 */
	export interface AzureAccount extends azdata.Account {
		/**
		 * AzureAccountProperties specifically used for Azure accounts
		 */
		properties: AzureAccountProperties;
	}

	/**
	 * Properties specific to an Azure account
	 */
	export interface AzureAccountProperties {
		/**
		 * Auth type of azure used to authenticate this account.
		 */
		azureAuthType?: AzureAuthType

		providerSettings: AzureAccountProviderMetadata;
		/**
		 * Whether or not the account is a Microsoft account
		 */
		isMsAccount: boolean;

		/**
		 * A list of tenants (aka directories) that the account belongs to
		 */
		tenants: Tenant[];

	}

	export const enum AzureAuthType {
		AuthCodeGrant = 0,
		DeviceCode = 1
	}

	/**
	 * Extension of account provider metadata to override settings type for Azure account providers
	 */
	export interface AzureAccountProviderMetadata extends azdata.AccountProviderMetadata {
		/**
		 * Azure specific account provider settings.
		 */
		settings: Settings;
	}

	/**
	 * Represents settings for an AAD account provider
	 */
	interface Settings {
		/**
		 * Host of the authority
		 */
		host?: string;

		/**
		 * Identifier of the client application
		 */
		clientId?: string;

		/**
		 * Information that describes the Microsoft resource management resource
		 */
		microsoftResource?: Resource

		/**
		 * Information that describes the AAD graph resource
		 */
		graphResource?: Resource;

		/**
		 * Information that describes the MS graph resource
		 */
		msGraphResource?: Resource;

		/**
		 * Information that describes the Azure resource management resource
		 */
		armResource?: Resource;

		/**
		 * Information that describes the SQL Azure resource
		 */
		sqlResource?: Resource;

		/**
		 * Information that describes the OSS RDBMS resource
		 */
		ossRdbmsResource?: Resource;

		/**
		 * Information that describes the Azure Key Vault resource
		 */
		azureKeyVaultResource?: Resource;

		/**
		 * Information that describes the Azure Dev Ops resource
		 */
		azureDevOpsResource?: Resource;

		/**
		 * Information that describes the Azure Log Analytics resource
		 */
		azureLogAnalyticsResource?: Resource;

		/**
		 * A list of tenant IDs to authenticate against. If defined, then these IDs will be used
		 * instead of querying the tenants endpoint of the armResource
		 */
		adTenants?: string[];

		// AuthorizationCodeGrantFlowSettings //////////////////////////////////

		/**
		 * An optional site ID that brands the interactive aspect of sign in
		 */
		siteId?: string;

		/**
		 * Redirect URI that is used to signify the end of the interactive aspect of sign it
		 */
		redirectUri?: string;

		scopes?: string[]

		portalEndpoint?: string
	}

	/**
	 * Represents a resource exposed by an Azure Active Directory
	 */
	export interface Resource {
		/**
		 * Identifier of the resource
		 */
		id: string;

		/**
		 * Endpoint url used to access the resource
		 */
		endpoint: string;

		/**
		 * Resource ID for azdata
		 */
		azureResourceId?: azdata.AzureResource
	}

	/**
	 * Represents a tenant (an Azure Active Directory instance) to which a user has access
	 */
	export interface Tenant {
		/**
		 * Globally unique identifier of the tenant
		 */
		id: string;

		/**
		 * Display name of the tenant
		 */
		displayName: string;

		/**
		 * Identifier of the user in the tenant
		 */
		userId?: string;

		/**
		 * The category the user has set their tenant to (e.g. Home Tenant)
		 */
		tenantCategory?: string;
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
		getLocations(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Promise<GetLocationsResult>;
		getSqlManagedInstances(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlManagedInstancesResult>;
		getManagedDatabases(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, managedInstance: azureResource.AzureSqlManagedInstance, ignoreErrors?: boolean): Promise<GetManagedDatabasesResult>;
		getSqlServers(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlServersResult>;
		getSqlVMServers(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlVMServersResult>;
		getStorageAccounts(account: azdata.Account, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetStorageAccountResult>;
		getBlobContainers(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetBlobContainersResult>;
		getFileShares(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetFileSharesResult>;
		createResourceGroup(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, resourceGroupName: string, location: string, ignoreErrors?: boolean): Promise<CreateResourceGroupResult>;
		getStorageAccountAccessKey(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetStorageAccountAccessKeyResult>;
		getBlobs(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, containerName: string, ignoreErrors?: boolean): Promise<GetBlobsResult>;
		/**
		 * Makes Azure REST requests to create, retrieve, update or delete access to azure service's resources.
		 * For reference to different service URLs, See https://docs.microsoft.com/rest/api/?view=Azure
		 * @param account The azure account used to acquire access token
		 * @param subscription The subscription under azure account where the service will perform operations.
		 * @param path The path for the service starting from '/subscription/..'. See https://docs.microsoft.com/rest/api/azure/.
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
	export type GetLocationsResult = { locations: azureResource.AzureLocation[], errors: Error[] };
	export type GetSqlManagedInstancesResult = { resources: azureResource.AzureSqlManagedInstance[], errors: Error[] };
	export type GetManagedDatabasesResult = { databases: azureResource.ManagedDatabase[], errors: Error[] };
	export type GetSqlServersResult = { resources: azureResource.AzureGraphResource[], errors: Error[] };
	export type GetSqlVMServersResult = { resources: azureResource.AzureGraphResource[], errors: Error[] };
	export type GetStorageAccountResult = { resources: azureResource.AzureGraphResource[], errors: Error[] };
	export type GetBlobContainersResult = { blobContainers: azureResource.BlobContainer[], errors: Error[] };
	export type GetFileSharesResult = { fileShares: azureResource.FileShare[], errors: Error[] };
	export type CreateResourceGroupResult = { resourceGroup: azureResource.AzureResourceResourceGroup, errors: Error[] };
	export type ResourceQueryResult<T extends azureResource.AzureGraphResource> = { resources: T[], errors: Error[] };
	export type AzureRestResponse = { response: any, errors: Error[] };
	export type GetBlobsResult = { blobs: azureResource.Blob[], errors: Error[] };
	export type GetStorageAccountAccessKeyResult = { keyName1: string, keyName2: string, errors: Error[] };
}
