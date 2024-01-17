/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as Constants from '../constants';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { TokenCredentials } from '@azure/ms-rest-js';
import { AzureRestResponse, GetResourceGroupsResult, GetSubscriptionsResult, ResourceQueryResult, GetBlobContainersResult, GetFileSharesResult, HttpRequestMethod, GetLocationsResult, GetManagedDatabasesResult, CreateResourceGroupResult, GetBlobsResult, GetStorageAccountAccessKeyResult, AzureAccount, azureResource, AzureAccountProviderMetadata } from 'azurecore';
import { EOL } from 'os';
import { AppContext } from '../appContext';
import { invalidAzureAccount, invalidTenant, unableToFetchTokenError } from '../localizedConstants';
import { AzureResourceServiceNames } from './constants';
import { IAzureResourceSubscriptionFilterService, IAzureResourceSubscriptionService, IAzureResourceTenantFilterService } from './interfaces';
import { AzureResourceGroupService } from './providers/resourceGroup/resourceGroupService';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import providerSettings from '../account-provider/providerSettings';
import { ErrorResponseBody } from '@azure/arm-subscriptions/esm/models';
import { TenantIgnoredError } from '../utils/TenantIgnoredError';
import { AzureMonitorResourceService } from './providers/azuremonitor/azuremonitorService';
import { AzureMonitorTreeDataProvider } from './providers/azuremonitor/azuremonitorTreeDataProvider';
import { CosmosDbMongoService } from './providers/cosmosdb/mongo/cosmosDbMongoService';
import { CosmosDbNoSqlService } from './providers/cosmosdb/nosql/cosmosDbNoSqlService';
import { CosmosDbMongoTreeDataProvider } from './providers/cosmosdb/mongo/cosmosDbMongoTreeDataProvider';
import { CosmosDbNoSqlTreeDataProvider } from './providers/cosmosdb/nosql/cosmosDbNoSqlTreeDataProvider';
import { AzureResourceDatabaseService } from './providers/database/databaseService';
import { AzureResourceDatabaseTreeDataProvider } from './providers/database/databaseTreeDataProvider';
import { AzureResourceDatabaseServerService } from './providers/databaseServer/databaseServerService';
import { AzureResourceDatabaseServerTreeDataProvider } from './providers/databaseServer/databaseServerTreeDataProvider';
import { KustoResourceService } from './providers/kusto/kustoService';
import { KustoTreeDataProvider } from './providers/kusto/kustoTreeDataProvider';
import { MysqlFlexibleServerService } from './providers/mysqlFlexibleServer/mysqlFlexibleServerService';
import { MysqlFlexibleServerTreeDataProvider } from './providers/mysqlFlexibleServer/mysqlFlexibleServerTreeDataProvider';
import { PostgresServerArcService } from './providers/postgresArcServer/postgresArcServerService';
import { PostgresServerArcTreeDataProvider } from './providers/postgresArcServer/postgresArcServerTreeDataProvider';
import { PostgresServerService } from './providers/postgresServer/postgresServerService';
import { PostgresServerTreeDataProvider } from './providers/postgresServer/postgresServerTreeDataProvider';
import { ResourceProvider } from './providers/resourceProvider';
import { SqlInstanceResourceService } from './providers/sqlinstance/sqlInstanceService';
import { SqlInstanceTreeDataProvider } from './providers/sqlinstance/sqlInstanceTreeDataProvider';
import { SqlInstanceArcResourceService } from './providers/sqlinstanceArc/sqlInstanceArcService';
import { SqlInstanceArcTreeDataProvider } from './providers/sqlinstanceArc/sqlInstanceArcTreeDataProvider';
import { AzureResourceSynapseService } from './providers/synapseSqlPool/synapseSqlPoolService';
import { AzureResourceSynapseSqlPoolTreeDataProvider } from './providers/synapseSqlPool/synapseSqlPoolTreeDataProvider';
import { AzureResourceSynapseWorkspaceService } from './providers/synapseWorkspace/synapseWorkspaceService';
import { AzureResourceSynapseWorkspaceTreeDataProvider } from './providers/synapseWorkspace/synapseWorkspaceTreeDataProvider';
import { PostgresFlexibleServerTreeDataProvider } from './providers/postgresFlexibleServer/postgresFlexibleServerTreeDataProvider';
import { PostgresFlexibleServerService } from './providers/postgresFlexibleServer/postgresFlexibleServerService';
import { CosmosDbPostgresTreeDataProvider } from './providers/cosmosdb/postgres/cosmosDbPostgresTreeDataProvider';
import { CosmosDbPostgresService } from './providers/cosmosdb/postgres/cosmosDbPostgresService';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const localize = nls.loadMessageBundle();

/**
 * Specialized version of the ErrorResponseBody that is required to have the error
 * information for easier typing support, without it how do we know it's an error
 * response?
 * https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/subscription/arm-subscriptions/src/models/index.ts#L180
 */
export type ErrorResponseBodyWithError = Required<ErrorResponseBody>;

/**
 * Checks if the body object given is an error response, that is has a non-undefined
 * property named error which contains detailed about the error.
 * @param body The body object to check
 * @returns True if the body is an ErrorResponseBodyWithError
 */
export function isErrorResponseBodyWithError(body: any): body is ErrorResponseBodyWithError {
	return 'error' in body && body.error;
}

/**
 * Shape of list operation responses
 * e.g. https://learn.microsoft.com/en-us/rest/api/storagerp/srp_json_list_operations#response-body
 */
export declare type AzureListOperationResponse<T> = {
	value: T;
}

/**
 * An access key for the storage account.
 * https://learn.microsoft.com/en-us/rest/api/storagerp/storage-accounts/list-keys?tabs=HTTP#storageaccountkey
 */
declare type StorageAccountKey = {
	creationTime: string;
	keyName: string;
	// permissions: KeyPermission Can add this if ever needed
	value: string;
}

/**
 * The response from the ListKeys operation.
 * https://learn.microsoft.com/en-us/rest/api/storagerp/storage-accounts/list-keys?tabs=HTTP#storageaccountlistkeysresult
 */
declare type StorageAccountListKeysResult = {
	keys: StorageAccountKey[];
}

function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

export class AzureResourceErrorMessageUtil {
	public static getErrorMessage(error: Error | string): string {
		return localize('azure.resource.error', "Error: {0}", getErrorMessage(error));
	}
}

export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
	let oct: string = '';
	let tmp: number;
	/* tslint:disable:no-bitwise */
	for (let a: number = 0; a < 4; a++) {
		tmp = (4294967296 * Math.random()) | 0;
		oct += hexValues[tmp & 0xF] +
			hexValues[tmp >> 4 & 0xF] +
			hexValues[tmp >> 8 & 0xF] +
			hexValues[tmp >> 12 & 0xF] +
			hexValues[tmp >> 16 & 0xF] +
			hexValues[tmp >> 20 & 0xF] +
			hexValues[tmp >> 24 & 0xF] +
			hexValues[tmp >> 28 & 0xF];
	}

	// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
	/* tslint:enable:no-bitwise */
}

export function equals(one: any, other: any): boolean {
	if (one === other) {
		return true;
	}
	if (one === null || one === undefined || other === null || other === undefined) {
		return false;
	}
	if (typeof one !== typeof other) {
		return false;
	}
	if (typeof one !== 'object') {
		return false;
	}
	if ((Array.isArray(one)) !== (Array.isArray(other))) {
		return false;
	}

	let i: number;
	let key: string;

	if (Array.isArray(one)) {
		if (one.length !== other.length) {
			return false;
		}
		for (i = 0; i < one.length; i++) {
			if (!equals(one[i], other[i])) {
				return false;
			}
		}
	} else {
		const oneKeys: string[] = [];

		for (key in one) {
			oneKeys.push(key);
		}
		oneKeys.sort();
		const otherKeys: string[] = [];
		for (key in other) {
			otherKeys.push(key);
		}
		otherKeys.sort();
		if (!equals(oneKeys, otherKeys)) {
			return false;
		}
		for (i = 0; i < oneKeys.length; i++) {
			if (!equals(one[oneKeys[i]], other[oneKeys[i]])) {
				return false;
			}
		}
	}
	return true;
}

export async function getResourceGroups(appContext: AppContext, account?: AzureAccount, subscription?: azureResource.AzureResourceSubscription, ignoreErrors: boolean = false): Promise<GetResourceGroupsResult> {
	const result: GetResourceGroupsResult = { resourceGroups: [], errors: [] };
	if (!account?.properties?.tenants || !Array.isArray(account.properties.tenants) || !subscription) {
		const error = new Error(invalidAzureAccount);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}
	const service = appContext.getService<AzureResourceGroupService>(AzureResourceServiceNames.resourceGroupService);
	await Promise.all(account.properties.tenants.map(async (tenant: { id: string; }) => {
		try {
			const tokenResponse = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);
			if (!tokenResponse) {
				throw new Error(`Could not fetch security token fetching resource groups for tenant "${tenant.id}"`);
			}
			const token = tokenResponse.token;
			const tokenType = tokenResponse.tokenType;

			result.resourceGroups.push(...await service.getResources([subscription], new TokenCredentials(token, tokenType), account));
		} catch (err) {
			if (!(err instanceof TenantIgnoredError)) {
				const error = new Error(localize('azure.accounts.getResourceGroups.queryError', "Error fetching resource groups for account {0} ({1}) subscription {2} ({3}) tenant {4} : {5}",
					account.displayInfo.displayName,
					account.displayInfo.userId,
					subscription.id,
					subscription.name,
					tenant.id,
					err instanceof Error ? err.message : err));
				console.warn(error);
				if (!ignoreErrors) {
					throw error;
				}
				result.errors.push(error);
			}
		}
	}));
	return result;
}

export async function getLocations(appContext: AppContext, account?: AzureAccount, subscription?: azureResource.AzureResourceSubscription, ignoreErrors: boolean = false): Promise<GetLocationsResult> {
	const result: GetLocationsResult = { locations: [], errors: [] };
	if (!account?.properties?.tenants || !Array.isArray(account.properties.tenants) || !subscription) {
		const error = new Error(invalidAzureAccount);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}

	try {
		const path = `/subscriptions/${subscription.id}/locations?api-version=2020-01-01`;
		const host = getProviderMetadataForAccount(account).settings.armResource.endpoint;
		const response = await makeHttpRequest<AzureListOperationResponse<azureResource.AzureLocation[]>>(account, subscription, path, HttpRequestMethod.GET, undefined, ignoreErrors, host);
		result.locations.push(...response.response?.data.value || []);
		result.errors.push(...response.errors);
	} catch (err) {
		const error = new Error(localize('azure.accounts.getLocations.queryError', "Error fetching locations for account {0} ({1}) subscription {2} ({3}) tenant {4} : {5}",
			account.displayInfo.displayName,
			account.displayInfo.userId,
			subscription.id,
			subscription.name,
			account.properties.tenants[0].id,
			err instanceof Error ? err.message : err));
		console.warn(error);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
	}

	return result;
}

export function getAllResourceProviders(extensionContext: vscode.ExtensionContext): azureResource.IAzureResourceProvider[] {
	const arcFeaturedEnabled = vscode.workspace.getConfiguration(Constants.AzureSection).get(Constants.EnableArcFeaturesSection);
	const providers: azureResource.IAzureResourceProvider[] = [
		new ResourceProvider(Constants.AZURE_MONITOR_PROVIDER_ID, new AzureMonitorTreeDataProvider(new AzureMonitorResourceService(), extensionContext)),
		new ResourceProvider(Constants.COSMOSDB_MONGO_PROVIDER_ID, new CosmosDbMongoTreeDataProvider(new CosmosDbMongoService(), extensionContext)),
		new ResourceProvider(Constants.COSMOSDB_NOSQL_PROVIDER_ID, new CosmosDbNoSqlTreeDataProvider(new CosmosDbNoSqlService(), extensionContext)),
		new ResourceProvider(Constants.COSMOSDB_POSTGRES_PROVIDER_ID, new CosmosDbPostgresTreeDataProvider(new CosmosDbPostgresService(), extensionContext)),
		new ResourceProvider(Constants.DATABASE_PROVIDER_ID, new AzureResourceDatabaseTreeDataProvider(new AzureResourceDatabaseService(), extensionContext)),
		new ResourceProvider(Constants.DATABASE_SERVER_PROVIDER_ID, new AzureResourceDatabaseServerTreeDataProvider(new AzureResourceDatabaseServerService(), extensionContext)),
		new ResourceProvider(Constants.KUSTO_PROVIDER_ID, new KustoTreeDataProvider(new KustoResourceService(), extensionContext)),
		new ResourceProvider(Constants.MYSQL_FLEXIBLE_SERVER_PROVIDER_ID, new MysqlFlexibleServerTreeDataProvider(new MysqlFlexibleServerService(), extensionContext)),
		new ResourceProvider(Constants.POSTGRES_FLEXIBLE_SERVER_PROVIDER_ID, new PostgresFlexibleServerTreeDataProvider(new PostgresFlexibleServerService(), extensionContext)),
		new ResourceProvider(Constants.POSTGRES_SERVER_PROVIDER_ID, new PostgresServerTreeDataProvider(new PostgresServerService(), extensionContext)),
		new ResourceProvider(Constants.SQLINSTANCE_PROVIDER_ID, new SqlInstanceTreeDataProvider(new SqlInstanceResourceService(), extensionContext)),
		new ResourceProvider(Constants.SYNAPSE_SQL_POOL_PROVIDER_ID, new AzureResourceSynapseSqlPoolTreeDataProvider(new AzureResourceSynapseService(), extensionContext)),
		new ResourceProvider(Constants.SYNAPSE_WORKSPACE_PROVIDER_ID, new AzureResourceSynapseWorkspaceTreeDataProvider(new AzureResourceSynapseWorkspaceService(), extensionContext)),
	];

	if (arcFeaturedEnabled) {
		providers.push(
			new ResourceProvider(Constants.SQLINSTANCE_ARC_PROVIDER_ID, new SqlInstanceArcTreeDataProvider(new SqlInstanceArcResourceService(), extensionContext)),
			new ResourceProvider(Constants.POSTGRES_ARC_SERVER_PROVIDER_ID, new PostgresServerArcTreeDataProvider(new PostgresServerArcService(), extensionContext))
		);
	}
	return providers;
}

export async function runResourceQuery<T extends azureResource.AzureGraphResource>(
	account: AzureAccount,
	subscriptions: azureResource.AzureResourceSubscription[],
	ignoreErrors: boolean = false,
	query: string): Promise<ResourceQueryResult<T>> {
	const result: ResourceQueryResult<T> = { resources: [], errors: [] };
	if (!account?.properties?.tenants || !Array.isArray(account.properties.tenants)) {
		const error = new Error(invalidAzureAccount);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}

	// Check our subscriptions to ensure we have valid ones
	subscriptions.forEach(subscription => {
		if (!subscription.tenant) {
			const error = new Error(invalidTenant);
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
		}
	});
	if (result.errors.length > 0) {
		return result;
	}

	// We need to get a different security token for each tenant to query the resources for the subscriptions on
	// that tenant
	for (let i = 0; i < account.properties.tenants.length; ++i) {
		const tenant = account.properties.tenants[i];
		const tenantSubscriptions = subscriptions.filter(subscription => subscription.tenant === tenant.id);
		if (tenantSubscriptions.length < 1) {
			// We may not have all subscriptions or the tenant might not have any subscriptions - just ignore these ones
			continue;
		}

		let resourceClient: ResourceGraphClient;
		try {
			const tokenResponse = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);
			if (!tokenResponse) {
				throw new Error(`Could not fetch security token for query "${query}" on tenant ${tenant.id}`);
			}
			const token = tokenResponse.token;
			const tokenType = tokenResponse.tokenType;
			const credential = new TokenCredentials(token, tokenType);

			resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		} catch (err) {
			console.error(err);
			if (!(err instanceof TenantIgnoredError)) {
				const error = new Error(unableToFetchTokenError(tenant.id));
				result.errors.push(error);
			}
			continue;
		}

		const allResources: T[] = [];
		let totalProcessed = 0;

		const doQuery = async (skipToken?: string) => {
			const response = await resourceClient.resources({
				subscriptions: tenantSubscriptions.map(subscription => subscription.id),
				query,
				options: {
					resultFormat: 'objectArray',
					skipToken: skipToken
				}
			});
			const resources: T[] = response.data as T[];
			totalProcessed += resources.length;
			allResources.push(...resources);
			if (response.skipToken && totalProcessed < response.totalRecords) {
				await doQuery(response.skipToken);
			}
		};
		try {
			await doQuery();
		} catch (err) {
			console.error(err);
			const error = new Error(localize('azure.accounts.runResourceQuery.errors.invalidQuery', "Invalid query"));
			result.errors.push(error);
		}
		result.resources.push(...allResources);
	}
	return result;
}

export async function getSubscriptions(appContext: AppContext, account?: AzureAccount, ignoreErrors: boolean = false): Promise<GetSubscriptionsResult> {
	const result: GetSubscriptionsResult = { subscriptions: [], errors: [] };
	if (!account?.properties?.tenants || !Array.isArray(account.properties.tenants)) {
		const error = new Error(invalidAzureAccount);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}

	const subscriptionService = appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
	await Promise.all(account.properties.tenants.map(async (tenant: { id: string; }) => {
		try {
			result.subscriptions.push(...await subscriptionService.getSubscriptions(account, [tenant.id]));
		} catch (err) {
			const error = new Error(localize('azure.accounts.getSubscriptions.queryError', "Error fetching subscriptions for account {0} tenant {1} : {2}",
				account.displayInfo.displayName,
				tenant.id,
				err instanceof Error ? err.message : err));
			console.warn(error);
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
		}
	}));
	return result;
}

export async function getSelectedSubscriptions(appContext: AppContext, account?: AzureAccount, ignoreErrors: boolean = false): Promise<GetSubscriptionsResult> {
	const result: GetSubscriptionsResult = { subscriptions: [], errors: [] };
	if (!account?.properties?.tenants || !Array.isArray(account.properties.tenants)) {
		const error = new Error(invalidAzureAccount);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}

	const subscriptionFilterService = appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);
	const tenantFilterService = appContext.getService<IAzureResourceTenantFilterService>(AzureResourceServiceNames.tenantFilterService);
	try {
		const tenants = await tenantFilterService.getSelectedTenants(account);
		for (const tenant of tenants) {
			result.subscriptions.push(...await subscriptionFilterService.getSelectedSubscriptions(account, tenant));
		}
	} catch (err) {
		const error = new Error(localize('azure.accounts.getSelectedSubscriptions.queryError', "Error fetching subscriptions for account {0} : {1}",
			account.displayInfo.displayName,
			err instanceof Error ? err.message : err));
		console.warn(error);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
	}
	return result;
}

/**
 * Makes Azure REST requests to create, retrieve, update or delete access to azure service's resources.
 * For reference to different service URLs, See https://docs.microsoft.com/rest/api/?view=Azure
 * @param account The azure account used to acquire access token
 * @param subscription The subscription under azure account where the service will perform operations.
 * @param path The path for the service starting from '/subscription/..'. See https://docs.microsoft.com/rest/api/azure/.
 * @param requestType Http request method. Currently GET, PUT, POST, DELETE, and PATCH methods are supported.
 * @param requestBody Optional request body to be used in PUT, POST, AND PATCH requests.
 * @param ignoreErrors When this flag is set the method will not throw any runtime or service errors and will return the errors in errors array.
 * @param host Use this to override the host. The default host is https://management.azure.com
 * @param requestHeaders Provide additional request headers
 */
export async function makeHttpRequest<B>(
	account: AzureAccount,
	subscription: azureResource.AzureResourceSubscription,
	path: string,
	requestType: HttpRequestMethod,
	requestBody?: any,
	ignoreErrors: boolean = false,
	host: string = 'https://management.azure.com',
	requestHeaders: Record<string, string> = {}
): Promise<AzureRestResponse<B>> {
	const result: AzureRestResponse<B> = { response: undefined, errors: [] };

	if (!account?.properties?.tenants || !Array.isArray(account.properties.tenants)) {
		const error = new Error(invalidAzureAccount);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
	}

	if (!subscription.tenant) {
		const error = new Error(invalidTenant);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
	}
	if (result.errors.length > 0) {
		return result;
	}

	let securityToken: azdata.accounts.AccountSecurityToken | undefined = undefined;
	try {
		securityToken = await azdata.accounts.getAccountSecurityToken(
			account,
			subscription.tenant!,
			azdata.AzureResource.ResourceManagement
		);
	} catch (err) {
		console.error(err);
		const error = new Error(unableToFetchTokenError(subscription?.tenant || '<unknown>'));
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
	}
	if (result.errors.length > 0 || !securityToken) {
		return result;
	}

	let reqHeaders = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${securityToken.token}`,
		...requestHeaders
	}

	const config: AxiosRequestConfig = {
		headers: reqHeaders,
		validateStatus: () => true // Never throw
	};

	// Adding '/' if path does not begin with it.
	if (path.indexOf('/') !== 0) {
		path = `/${path}`;
	}

	let requestUrl: string;
	if (host) {
		requestUrl = `${host}${path}`;
	} else {
		requestUrl = `${account.properties.providerSettings.settings.armResource.endpoint}${path}`;
	}

	let response: AxiosResponse<B | ErrorResponseBodyWithError> | undefined;
	switch (requestType) {
		case HttpRequestMethod.GET:
			response = await axios.get(requestUrl, config);
			break;
		case HttpRequestMethod.POST:
			response = await axios.post(requestUrl, requestBody, config);
			break;
		case HttpRequestMethod.PUT:
			response = await axios.put(requestUrl, requestBody, config);
			break;
		case HttpRequestMethod.DELETE:
			response = await axios.delete(requestUrl, config);
			break;
		case HttpRequestMethod.PATCH:
			response = await axios.patch(requestUrl, config);
			break;
		default:
			const error = new Error(`Unknown RequestType "${requestType}"`);
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
	}

	if (!response) {
		const error = new Error(`No response to HTTP request ${requestUrl}`);
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
	} else if (response.status < 200 || response.status > 299) {
		let errorMessage: string[] = [];
		errorMessage.push(response.status.toString());
		const data = response.data;
		if (isErrorResponseBodyWithError(data)) {
			errorMessage.push(`${data.error.code} : ${data.error.message}`);
		}
		const error = new Error(errorMessage.join(EOL));
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
	} else {
		// We know this isn't an error response at this point
		result.response = response as AxiosResponse<B>;
	}

	return result;
}

export async function getManagedDatabases(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, managedInstance: azureResource.AzureSqlManagedInstance, ignoreErrors: boolean): Promise<GetManagedDatabasesResult> {
	const path = `/subscriptions/${subscription.id}/resourceGroups/${managedInstance.resourceGroup}/providers/Microsoft.Sql/managedInstances/${managedInstance.name}/databases?api-version=2020-02-02-preview`;
	const host = getProviderMetadataForAccount(account).settings.armResource.endpoint;
	const response = await makeHttpRequest<AzureListOperationResponse<azureResource.ManagedDatabase[]>>(account, subscription, path, HttpRequestMethod.GET, undefined, ignoreErrors, host);
	return {
		databases: response?.response?.data?.value ?? [],
		errors: response.errors ? response.errors : []
	};
}

export async function getBlobContainers(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors: boolean): Promise<GetBlobContainersResult> {
	const path = `/subscriptions/${subscription.id}/resourceGroups/${storageAccount.resourceGroup}/providers/Microsoft.Storage/storageAccounts/${storageAccount.name}/blobServices/default/containers?api-version=2019-06-01`;
	const host = getProviderMetadataForAccount(account).settings.armResource.endpoint;
	const response = await makeHttpRequest<AzureListOperationResponse<azureResource.BlobContainer[]>>(account, subscription, path, HttpRequestMethod.GET, undefined, ignoreErrors, host);
	return {
		blobContainers: response?.response?.data?.value ?? [],
		errors: response.errors ? response.errors : []
	};
}

export async function getFileShares(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors: boolean): Promise<GetFileSharesResult> {
	const path = `/subscriptions/${subscription.id}/resourceGroups/${storageAccount.resourceGroup}/providers/Microsoft.Storage/storageAccounts/${storageAccount.name}/fileServices/default/shares?api-version=2019-06-01`;
	const host = getProviderMetadataForAccount(account).settings.armResource.endpoint;
	const response = await makeHttpRequest<AzureListOperationResponse<azureResource.FileShare[]>>(account, subscription, path, HttpRequestMethod.GET, undefined, ignoreErrors, host);
	return {
		fileShares: response?.response?.data?.value ?? [],
		errors: response.errors ? response.errors : []
	};
}

export async function createResourceGroup(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, resourceGroupName: string, location: string, ignoreErrors: boolean): Promise<CreateResourceGroupResult> {
	const path = `/subscriptions/${subscription.id}/resourcegroups/${resourceGroupName}?api-version=2021-04-01`;
	const requestBody = {
		location: location
	};
	const host = getProviderMetadataForAccount(account).settings.armResource.endpoint;
	const response = await makeHttpRequest<azureResource.AzureResourceResourceGroup>(account, subscription, path, HttpRequestMethod.PUT, requestBody, ignoreErrors, host);
	return {
		resourceGroup: response?.response?.data,
		errors: response.errors ? response.errors : []
	};
}

export async function getStorageAccountAccessKey(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, ignoreErrors: boolean): Promise<GetStorageAccountAccessKeyResult> {
	const path = `/subscriptions/${subscription.id}/resourceGroups/${storageAccount.resourceGroup}/providers/Microsoft.Storage/storageAccounts/${storageAccount.name}/listKeys?api-version=2019-06-01`;
	const host = getProviderMetadataForAccount(account).settings.armResource.endpoint;
	const response = await makeHttpRequest<StorageAccountListKeysResult>(account, subscription, path, HttpRequestMethod.POST, undefined, ignoreErrors, host);
	return {
		keyName1: response?.response?.data?.keys[0].value ?? '',
		keyName2: response?.response?.data?.keys[0].value ?? '',
		errors: response.errors ? response.errors : []
	};
}

export async function getBlobs(account: AzureAccount, subscription: azureResource.AzureResourceSubscription, storageAccount: azureResource.AzureGraphResource, containerName: string, ignoreErrors: boolean): Promise<GetBlobsResult> {
	const result: GetBlobsResult = { blobs: [], errors: [] };
	const storageKeys = await getStorageAccountAccessKey(account, subscription, storageAccount, ignoreErrors);
	if (!ignoreErrors) {
		throw storageKeys.errors.toString();
	} else {
		result.errors.push(...storageKeys.errors);
	}
	try {
		const sharedKeyCredential = new StorageSharedKeyCredential(storageAccount.name, storageKeys.keyName1);
		const blobServiceClient = new BlobServiceClient(
			`https://${storageAccount.name}.blob${account.properties.providerSettings.settings.azureStorageResource.endpointSuffix}`,
			sharedKeyCredential
		);
		const containerClient = blobServiceClient.getContainerClient(containerName);
		for await (const blob of containerClient.listBlobsFlat()) {
			result.blobs.push(blob);
		}
	} catch (e) {
		if (!ignoreErrors) {
			throw e;
		} else {
			result.errors.push(e);
		}
	}
	return result;
}

export function getProviderMetadataForAccount(account: AzureAccount): AzureAccountProviderMetadata {
	const provider = providerSettings.find(provider => {
		return account.properties.providerSettings.id === provider.metadata.id;
	});
	if (!provider) {
		throw new Error(`Could not find provider ${account.properties.providerSettings.id} for account ${account.displayInfo.displayName} (${account.displayInfo.userId})`);
	}

	return provider.metadata;
}
