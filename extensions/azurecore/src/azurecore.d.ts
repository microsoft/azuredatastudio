/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'azurecore' {
	import * as azdata from 'azdata';
	import * as vscode from 'vscode';
	import * as msRest from '@azure/ms-rest-js';
	import { BlobItem } from '@azure/storage-blob';
	import { AxiosResponse } from 'axios';

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
		azureAuthType?: AzureAuthType;

		/**
		 * Provider settings for account.
		 */
		providerSettings: AzureAccountProviderMetadata;

		/**
		 * Whether or not the account is a Microsoft account
		 */
		isMsAccount: boolean;

		/**
		 * Represents the tenant that the user would be signing in to. For work and school accounts, the GUID is the immutable tenant ID of the organization that the user is signing in to.
		 * For sign-ins to the personal Microsoft account tenant (services like Xbox, Teams for Life, or Outlook), the value is 9188040d-6c67-4c5b-b112-36a304b66dad.
		 */
		owningTenant: Tenant;
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
		host: string;

		/**
		 * Identifier of the client application
		 */
		clientId: string;

		/**
		 * Information that describes the Microsoft resource management resource
		 */
		microsoftResource: Resource

		/**
		 * Information that describes the MS graph resource
		 */
		msGraphResource?: Resource;

		/**
		 * Information that describes the Azure resource management resource
		 */
		armResource: Resource;

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
		 * Information that describes the Azure Kusto resource
		 */
		azureKustoResource?: Resource;

		/**
		 * Information that describes the Azure Log Analytics resource
		 */
		azureLogAnalyticsResource?: Resource;

		/**
		 * Information that describes the Azure Storage resource
		 */
		azureStorageResource: Resource;

		/**
		 * Information that describes the Power BI resource
		 */
		powerBiResource?: Resource;

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
		 * Redirect URI that is used to signify the end of the interactive aspect of sign in
		 */
		redirectUri: string;

		scopes: string[]

		portalEndpoint?: string
	}

	/**
	 * Represents a resource exposed by a Microsoft Entra identity
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
		 * Endpoint suffix used to access the resource
		 */
		endpointSuffix?: string;

		/**
		 * Resource ID for azdata
		 */
		azureResourceId?: azdata.AzureResource
	}

	/**
	 * Represents a Microsoft Entra tenant to which a user has access
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
		DELETE,
		PATCH
	}

	export interface IExtension {
		/**
		 * Gets the list of subscriptions for the specified AzureAccount
		 * @param account The account to get the subscriptions for
		 * @param ignoreErrors If true any errors are not thrown and instead collected and returned as part of the result
		 * @param selectedOnly Whether to only list subscriptions the user has selected to filter to for this account
		 */
		getSubscriptions(account?: AzureAccount, ignoreErrors?: boolean, selectedOnly?: boolean): Promise<GetSubscriptionsResult>;
		getResourceGroups(account?: AzureAccount, subscription?: azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Promise<GetResourceGroupsResult>;
		getLocations(account?: AzureAccount, subscription?: azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Promise<GetLocationsResult>;
		getSqlManagedInstances(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlManagedInstancesResult>;
		getManagedDatabases(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, managedInstance: azureResource.AzureSqlManagedInstance, ignoreErrors?: boolean): Promise<GetManagedDatabasesResult>;
		getSqlServers(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlServersResult>;
		getSqlVMServers(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetSqlVMServersResult>;
		getStorageAccounts(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<GetStorageAccountResult>;
		getBlobContainers(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetBlobContainersResult>;
		getFileShares(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetFileSharesResult>;
		createResourceGroup(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, resourceGroupName: string, location: string, ignoreErrors?: boolean): Promise<CreateResourceGroupResult>;
		getStorageAccountAccessKey(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<GetStorageAccountAccessKeyResult>;
		getBlobs(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, containerName: string, ignoreErrors?: boolean): Promise<GetBlobsResult>;
		/**
		 * Makes Azure REST requests to create, retrieve, update or delete access to azure service's resources.
		 * For reference to different service URLs, See https://docs.microsoft.com/rest/api/?view=Azure
		 * @param account The azure account used to acquire access token
		 * @param subscription The subscription under azure account where the service will perform operations.
		 * @param path The path for the service starting from '/subscription/..'. See https://docs.microsoft.com/rest/api/azure/.
		 * @param requestType Http request method. Currently GET, PUT, POST, DELETE, and PATCH methods are supported.
		 * @param requestBody Optional request body to be used in PUT, POST, and PATCH requests.
		 * @param ignoreErrors When this flag is set the method will not throw any runtime or service errors and will return the errors in errors array.
		 * @param host Use this to override the host. The default host is https://management.azure.com
		 * @param requestHeaders Provide additional request headers
		 */
		makeAzureRestRequest<B>(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, path: string, requestType: HttpRequestMethod, requestBody?: any, ignoreErrors?: boolean, host?: string, requestHeaders?: Record<string, string>): Promise<AzureRestResponse<B>>;
		/**
		 * Converts a region value (@see AzureRegion) into the localized Display Name
		 * @param region The region value
		 */
		getRegionDisplayName(region?: string): string;
		getProviderMetadataForAccount(account: AzureAccount): AzureAccountProviderMetadata;
		provideResources(): azureResource.IAzureResourceProvider[];
		getUniversalProvider(): azureResource.IAzureUniversalResourceProvider;
		runGraphQuery<T extends azureResource.AzureGraphResource>(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[], ignoreErrors: boolean, query: string): Promise<ResourceQueryResult<T>>;
		/**
		 * Event emitted when MSAL cache encryption keys are updated in credential store.
		 * Returns encryption keys used for encryption/decryption of MSAL cache that can be used
		 * by connection providers to read/write to the same access token cache for stable connectivity.
		 */
		onEncryptionKeysUpdated: vscode.Event<CacheEncryptionKeys>;
		/**
		 * Fetches MSAL cache encryption keys currently in use.
		 */
		getEncryptionKeys(): Promise<CacheEncryptionKeys>;
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
	export type CreateResourceGroupResult = { resourceGroup: azureResource.AzureResourceResourceGroup | undefined, errors: Error[] };
	export type ResourceQueryResult<T extends azureResource.AzureGraphResource> = { resources: T[], errors: Error[] };
	export type AzureRestResponse<B> = { response: AxiosResponse<B> | undefined, errors: Error[] };
	export type GetBlobsResult = { blobs: azureResource.Blob[], errors: Error[] };
	export type GetStorageAccountAccessKeyResult = { keyName1: string, keyName2: string, errors: Error[] };
	export type CacheEncryptionKeys = { key: string; iv: string; }

	export namespace azureResource {

		/**
		 * AzureCore extension supports following resource types of Azure Resource Graph.
		 * To add more resources, please refer this guide: https://docs.microsoft.com/en-us/azure/governance/resource-graph/reference/supported-tables-resources
		 */
		export const enum AzureResourceType {
			resourceGroup = 'microsoft.resources/subscriptions/resourcegroups',
			sqlServer = 'microsoft.sql/servers',
			sqlDatabase = 'microsoft.sql/servers/databases',
			sqlManagedInstance = 'microsoft.sql/managedinstances',
			sqlSynapseWorkspace = 'microsoft.synapse/workspaces', // (Synapse Analytics workspace)
			sqlSynapseSqlPool = 'microsoft.synapse/workspaces/sqlpools', // (Dedicated SQL pools)
			sqlSynapseSqlDatabase = 'microsoft.synapse/workspaces/sqldatabases', // (Synapse SQL databases)
			azureArcSqlManagedInstance = 'microsoft.azuredata/sqlmanagedinstances',
			virtualMachines = 'microsoft.compute/virtualmachines',
			kustoClusters = 'microsoft.kusto/clusters',
			azureArcPostgresServer = 'microsoft.azuredata/postgresinstances',
			postgresServer = 'microsoft.dbforpostgresql/servers',
			postgresServerv2 = 'microsoft.dbforpostgresql/serversv2',
			postgresSingleServer = 'microsoft.dbforpostgresql/singleservers',
			postgresFlexibleServer = 'microsoft.dbforpostgresql/flexibleservers',
			postgresServerGroup = 'microsoft.dbforpostgresql/servergroups',
			postgresServerGroupv2 = 'microsoft.dbforpostgresql/servergroupsv2',
			azureArcService = 'microsoft.azuredata/datacontrollers',
			storageAccount = 'microsoft.storage/storageaccounts',
			logAnalytics = 'microsoft.operationalinsights/workspaces',
			cosmosDbAccount = 'microsoft.documentdb/databaseaccounts',
			cosmosDbPostgresCluster = 'microsoft.documentdb/postgresclusters',
			cosmosDbMongoCluster = 'microsoft.documentdb/mongoclusters',
			mysqlFlexibleServer = 'microsoft.dbformysql/flexibleservers'
		}

		export interface IAzureUniversalTreeDataProvider extends IAzureResourceTreeDataProvider {
			/**
			 * Gets all the children for user account for provided subscription list.
			 */
			getAllChildren(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[]): Promise<IAzureResourceNode[]>;
		}

		export interface IAzureUniversalResourceProvider extends IAzureResourceProvider {
			getTreeDataProvider(): IAzureUniversalTreeDataProvider;
		}

		export interface IAzureResourceProvider extends azdata.DataProvider {
			getTreeDataProvider(): IAzureResourceTreeDataProvider;
		}

		export interface IAzureResourceTreeDataProvider {
			getService(): azureResource.IAzureResourceService;
			/**
			 * Gets the root tree item nodes for this provider - these will be used as
			 * direct children of the Tenant node in the Azure tree view.
			 */
			getRootChild(): Promise<azdata.TreeItem>;
			/**
			 * Gets the children for a given {@link IAzureResourceNode}
			 * @param element The parent node to get the children for
			 */
			getChildren(element: IAzureResourceNode): Promise<IAzureResourceNode[]>;
			/**
			 * Converts resource to VS Code treeItem
			 * @param resource Azure resource to convert.
			 * @param account User account
			 */
			getTreeItemForResource(resource: azureResource.AzureResource, account: AzureAccount): vscode.TreeItem;
			browseConnectionMode: boolean;
		}

		export interface IAzureResourceNode {
			readonly account: AzureAccount;
			readonly subscription: AzureResourceSubscription;
			readonly tenantId: string;
			readonly resourceProviderId: string;
			readonly treeItem: azdata.TreeItem;
		}

		export interface IAzureSubscriptionInfo {
			id: string;
			name: string;
		}

		export interface AzureResource {
			name: string;
			id: string;
			subscription: IAzureSubscriptionInfo;
			provider?: string,
			resourceGroup?: string;
			tenant?: string;
		}

		export interface IAzureResourceService {
			queryFilter: string;
			getResources(subscriptions: AzureResourceSubscription[], credential: msRest.ServiceClientCredentials, account: AzureAccount): Promise<AzureResource[]>;
		}

		export interface AzureResourceSubscription extends Omit<AzureResource, 'subscription'> {
		}

		export interface AzureSqlResource extends AzureResource {
			loginName: string;
		}

		export interface AzureGraphResource extends Omit<AzureResource, 'tenant' | 'subscription'> {
			tenantId: string;
			subscriptionId: string;
			type: string;
			location: string;
		}

		export interface AzureResourceResourceGroup extends AzureResource {
			location?: string;
			managedBy?: string;
			properties?: {
				provisioningState?: string
			};
			type?: string;
		}

		export interface AzureLocation {
			id: string,
			name: string,
			displayName: string,
			regionalDisplayName: string,
			metadata: {
				regionType: string,
				regionCategory: string,
				geographyGroup: string,
				longitude: number,
				latitude: number,
				physicalLocation: string,
				pairedRegion: {
					name: string,
					id: string,
				}[],
			},
		}

		export interface AzureSqlManagedInstance extends AzureGraphResource {
			sku: {
				capacity: number;
				family: string;
				name: string;
				tier: 'GeneralPurpose' | 'BusinessCritical';
			},
			properties: {
				provisioningState: string,
				storageAccountType: string,
				maintenanceConfigurationId: string,
				state: string,
				licenseType: string,
				zoneRedundant: false,
				fullyQualifiedDomainName: string,
				collation: string,
				administratorLogin: string,
				minimalTlsVersion: string,
				subnetId: string,
				publicDataEndpointEnabled: boolean,
				storageSizeInGB: number,
				timezoneId: string,
				proxyOverride: string,
				vCores: number,
				dnsZone: string,
			}

		}

		export interface ManagedDatabase {
			id: string,
			location: string,
			name: string,
			properties: {
				sourceDatabaseId: string,
				status: string
			},
			type: string
		}

		export interface AzureResourceDatabase extends AzureSqlResource {
			serverName: string;
			serverFullName: string;
		}

		export interface AzureResourceDatabaseServer extends AzureSqlResource {
			fullName: string;
			defaultDatabaseName: string;
		}

		export interface BlobContainer extends AzureResource { }

		export interface FileShare extends AzureResource { }

		export interface Blob extends BlobItem { }
	}
}
