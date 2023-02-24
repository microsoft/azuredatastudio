/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import * as constants from '../constants/strings';
import { getSessionIdHeader } from './utils';
import { URL } from 'url';
import { MigrationSourceAuthenticationType, MigrationStateModel, NetworkShare } from '../models/stateMachine';

const ARM_MGMT_API_VERSION = '2021-04-01';
const SQL_VM_API_VERSION = '2021-11-01-preview';
const SQL_MI_API_VERSION = '2021-11-01-preview';
const SQL_SQLDB_API_VERSION = '2021-11-01-preview';
const DMSV2_API_VERSION = '2022-03-30-preview';

async function getAzureCoreAPI(): Promise<azurecore.IExtension> {
	const api = (await vscode.extensions.getExtension(azurecore.extension.name)?.activate()) as azurecore.IExtension;
	if (!api) {
		throw new Error('azure core API undefined for sql-migration');
	}
	return api;
}

export type Subscription = azurecore.azureResource.AzureResourceSubscription;
export async function getSubscriptions(account: azdata.Account): Promise<Subscription[]> {
	const api = await getAzureCoreAPI();
	const subscriptions = await api.getSubscriptions(account, false);
	let listOfSubscriptions = subscriptions.subscriptions;
	sortResourceArrayByName(listOfSubscriptions);
	return subscriptions.subscriptions;
}

export async function getLocations(account: azdata.Account, subscription: Subscription): Promise<azurecore.azureResource.AzureLocation[]> {
	const api = await getAzureCoreAPI();
	const response = await api.getLocations(account, subscription, true);

	const path = `/subscriptions/${subscription.id}/providers/Microsoft.DataMigration?api-version=${ARM_MGMT_API_VERSION}`;
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const dataMigrationResourceProvider = (await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host))?.response?.data;
	const sqlMigratonResource = dataMigrationResourceProvider?.resourceTypes?.find((r: any) => r.resourceType === 'SqlMigrationServices');
	const sqlMigrationResourceLocations = sqlMigratonResource?.locations ?? [];
	if (response.errors?.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}

	const filteredLocations = response?.locations?.filter(
		loc => sqlMigrationResourceLocations.includes(loc.displayName));

	sortResourceArrayByName(filteredLocations);

	return filteredLocations;
}

export type AzureProduct = azurecore.azureResource.AzureGraphResource;

export async function getResourceGroups(account: azdata.Account, subscription: Subscription): Promise<azurecore.azureResource.AzureResourceResourceGroup[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getResourceGroups(account, subscription, true);
	sortResourceArrayByName(result.resourceGroups);
	return result.resourceGroups;
}

export async function createResourceGroup(account: azdata.Account, subscription: Subscription, resourceGroupName: string, location: string): Promise<azurecore.azureResource.AzureResourceResourceGroup> {
	const api = await getAzureCoreAPI();
	const result = await api.createResourceGroup(account, subscription, resourceGroupName, location, false);
	return result.resourceGroup;
}

export type SqlManagedInstance = azurecore.azureResource.AzureSqlManagedInstance;
export function isSqlManagedInstance(instance: any): instance is SqlManagedInstance {
	return (instance as SqlManagedInstance) !== undefined;
}

export async function getAvailableManagedInstanceProducts(account: azdata.Account, subscription: Subscription): Promise<SqlManagedInstance[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getSqlManagedInstances(account, [subscription], false);
	sortResourceArrayByName(result.resources);
	return result.resources;
}

export async function getSqlManagedInstanceDatabases(account: azdata.Account, subscription: Subscription, managedInstance: SqlManagedInstance): Promise<azurecore.azureResource.ManagedDatabase[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getManagedDatabases(account, subscription, managedInstance, false);
	sortResourceArrayByName(result.databases);
	return result.databases;
}

export type SqlServer = AzureProduct;
export async function getAvailableSqlServers(account: azdata.Account, subscription: Subscription): Promise<SqlServer[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getSqlServers(account, [subscription], false);
	return result.resources;
}

export interface SKU {
	name: string,
	tier: 'GeneralPurpose' | 'BusinessCritical',
	family: string,
	capacity: number,
}

export interface AzureSqlDatabase {
	id: string,
	name: string,
	location: string,
	tags: any,
	type: string,
	sku: SKU,
	kind: string,
	properties: {
		collation: string,
		maxSizeBytes: number,
		status: string,
		databaseId: string,
		creationDate: string,
		currentServiceObjectiveName: string,
		requestedServiceObjectiveName: string,
		defaultSecondaryLocation: string,
		catalogCollation: string,
		zoneRedundant: boolean,
		earliestRestoreDate: string,
		readScale: string,
		currentSku: SKU,
		currentBackupStorageRedundancy: string,
		requestedBackupStorageRedundancy: string,
		maintenanceConfigurationId: string,
		isLedgerOn: boolean
		isInfraEncryptionEnabled: boolean,
		licenseType: string,
		maxLogSizeBytes: number,
	},
}

export interface ServerAdministrators {
	administratorType: string,
	azureADOnlyAuthentication: boolean,
	login: string,
	principalType: string,
	sid: string,
	tenantId: string,
}

export interface PrivateEndpointProperty {
	id?: string;
}

export interface PrivateLinkServiceConnectionStateProperty {
	status: string;
	description: string;
	readonly actionsRequired?: string;
}

export interface PrivateEndpointConnectionProperties {
	groupIds: string[];
	privateEndpoint?: PrivateEndpointProperty;
	privateLinkServiceConnectionState?: PrivateLinkServiceConnectionStateProperty;
	readonly provisioningState?: string;
}

export interface ServerPrivateEndpointConnection {
	readonly id?: string;
	readonly properties?: PrivateEndpointConnectionProperties;
}

export function isAzureSqlDatabaseServer(instance: any): instance is AzureSqlDatabaseServer {
	return (instance as AzureSqlDatabaseServer) !== undefined;
}

export interface AzureSqlDatabaseServer {
	id: string,
	name: string,
	kind: string,
	location: string,
	tags?: { [propertyName: string]: string; };
	type: string,
	// sku: SKU,
	// subscriptionId: string,
	// tenantId: string,
	// fullName: string,
	properties: {
		administratorLogin: string,
		administrators: ServerAdministrators,
		fullyQualifiedDomainName: string,
		minimalTlsVersion: string,
		privateEndpointConnections: ServerPrivateEndpointConnection[],
		publicNetworkAccess: string,
		restrictOutboundNetworkAccess: string,
		state: string,
		version: string,
	},
}

export type SqlVMServer = {
	properties: {
		virtualMachineResourceId: string,
		provisioningState: string,
		sqlImageOffer: string,
		sqlManagement: string,
		sqlImageSku: string
	},
	location: string,
	id: string,
	name: string,
	type: string,
	tenantId: string,
	subscriptionId: string
};

export type VirtualMachineInstanceView = {
	computerName: string,
	osName: string,
	osVersion: string,
	vmAgent: { [propertyName: string]: string; },
	disks: { [propertyName: string]: string; }[],
	bootDiagnostics: { [propertyName: string]: string; },
	extensions: { [propertyName: string]: string; }[],
	hyperVGeneration: string,
	patchStatus: { [propertyName: string]: string; },
	statuses: InstanceViewStatus[],
}

export type InstanceViewStatus = {
	code: string,
	displayStatus: string,
	level: string,
	message: string,
	time: string,
}

export async function getAvailableSqlDatabaseServers(account: azdata.Account, subscription: Subscription): Promise<AzureSqlDatabaseServer[]> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/providers/Microsoft.Sql/servers?api-version=${SQL_SQLDB_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	sortResourceArrayByName(response.response.data.value);
	return response.response.data.value;
}

export async function getAvailableSqlDatabases(account: azdata.Account, subscription: Subscription, resourceGroupName: string, serverName: string): Promise<AzureSqlDatabase[]> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.Sql/servers/${serverName}/databases?api-version=${SQL_SQLDB_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	sortResourceArrayByName(response.response.data.value);
	return response.response.data.value;
}

export async function getAvailableSqlVMs(account: azdata.Account, subscription: Subscription): Promise<SqlVMServer[]> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/providers/Microsoft.SqlVirtualMachine/sqlVirtualMachines?api-version=${SQL_VM_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);

	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	sortResourceArrayByName(response.response.data.value);
	return response.response.data.value;
}

export async function getVMInstanceView(sqlVm: SqlVMServer, account: azdata.Account, subscription: Subscription): Promise<VirtualMachineInstanceView> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/resourceGroups/${getResourceGroupFromId(sqlVm.id)}/providers/Microsoft.Compute/virtualMachines/${sqlVm.name}/instanceView?api-version=2022-08-01`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);

	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}

	return response.response.data;
}

export type StorageAccount = AzureProduct;
export async function getAvailableStorageAccounts(account: azdata.Account, subscription: Subscription): Promise<StorageAccount[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getStorageAccounts(account, [subscription], false);
	sortResourceArrayByName(result.resources);
	return result.resources;
}

export async function getFileShares(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount): Promise<azurecore.azureResource.FileShare[]> {
	const api = await getAzureCoreAPI();
	let result = await api.getFileShares(account, subscription, storageAccount, true);
	let fileShares = result.fileShares;
	sortResourceArrayByName(fileShares);
	return fileShares!;
}

export async function getBlobContainers(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount): Promise<azurecore.azureResource.BlobContainer[]> {
	const api = await getAzureCoreAPI();
	let result = await api.getBlobContainers(account, subscription, storageAccount, true);
	let blobContainers = result.blobContainers;
	sortResourceArrayByName(blobContainers);
	return blobContainers!;
}

export async function getBlobs(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount, containerName: string): Promise<azurecore.azureResource.Blob[]> {
	const api = await getAzureCoreAPI();
	let result = await api.getBlobs(account, subscription, storageAccount, containerName, true);
	let blobNames = result.blobs;
	sortResourceArrayByName(blobNames);
	return blobNames!;
}

export async function getSqlMigrationService(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string): Promise<SqlMigrationService> {
	const sqlMigrationServiceId = `/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}`;
	return await getSqlMigrationServiceById(account, subscription, sqlMigrationServiceId);
}

export async function getSqlMigrationServiceById(account: azdata.Account, subscription: Subscription, sqlMigrationServiceId: string): Promise<SqlMigrationService> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`${sqlMigrationServiceId}?api-version=${DMSV2_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	response.response.data.properties.resourceGroup = getResourceGroupFromId(response.response.data.id);
	return response.response.data;
}

export async function getSqlMigrationServicesByResourceGroup(account: azdata.Account, subscription: Subscription, resouceGroupName: string): Promise<SqlMigrationService[]> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/resourceGroups/${resouceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices?api-version=${DMSV2_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	sortResourceArrayByName(response.response.data.value);
	response.response.data.value.forEach((sms: SqlMigrationService) => {
		sms.properties.resourceGroup = getResourceGroupFromId(sms.id);
	});
	return response.response.data.value;
}

export async function getSqlMigrationServices(account: azdata.Account, subscription: Subscription): Promise<SqlMigrationService[]> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/providers/Microsoft.DataMigration/sqlMigrationServices?api-version=${DMSV2_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	sortResourceArrayByName(response.response.data.value);
	response.response.data.value.forEach((sms: SqlMigrationService) => {
		sms.properties.resourceGroup = getResourceGroupFromId(sms.id);
	});
	return response.response.data.value;
}

export async function createSqlMigrationService(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string, sessionId: string): Promise<SqlMigrationService> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}?api-version=${DMSV2_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const requestBody = {
		'location': regionName
	};
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.PUT, requestBody, true, host, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	const asyncUrl = response.response.headers['azure-asyncoperation'];
	const asyncPath = asyncUrl.replace((new URL(asyncUrl)).origin + '/', '');	// path is everything after the hostname, e.g. the 'test' part of 'https://management.azure.com/test'

	const maxRetry = 24;
	let i = 0;
	for (i = 0; i < maxRetry; i++) {
		const asyncResponse = await api.makeAzureRestRequest(account, subscription, asyncPath, azurecore.HttpRequestMethod.GET, undefined, true, host);
		const creationStatus = asyncResponse.response.data.status;
		if (creationStatus === constants.ProvisioningState.Succeeded) {
			break;
		} else if (creationStatus === constants.ProvisioningState.Failed) {
			throw new Error(asyncResponse.errors.toString());
		}
		await new Promise(resolve => setTimeout(resolve, 5000)); //adding  5 sec delay before getting creation status
	}
	if (i === maxRetry) {
		throw new Error(constants.DMS_PROVISIONING_FAILED);
	}
	return response.response.data;
}

export async function getSqlMigrationServiceAuthKeys(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string): Promise<SqlMigrationServiceAuthenticationKeys> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}/ListAuthKeys?api-version=${DMSV2_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	return {
		authKey1: response?.response?.data?.authKey1 ?? '',
		authKey2: response?.response?.data?.authKey2 ?? ''
	};
}

export async function regenerateSqlMigrationServiceAuthKey(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string, keyName: string): Promise<SqlMigrationServiceAuthenticationKeys> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}/regenerateAuthKeys?api-version=${DMSV2_API_VERSION}`);
	const requestBody = {
		'location': regionName,
		'keyName': keyName,
	};
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, requestBody, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	return {
		authKey1: response?.response?.data?.authKey1 ?? '',
		authKey2: response?.response?.data?.authKey2 ?? ''
	};
}

export async function getStorageAccountAccessKeys(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount): Promise<GetStorageAccountAccessKeysResult> {
	const api = await getAzureCoreAPI();
	const response = await api.getStorageAccountAccessKey(account, subscription, storageAccount, true);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	return {
		keyName1: response?.keyName1,
		keyName2: response?.keyName2
	};
}

export async function getSqlMigrationServiceMonitoringData(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationService: string): Promise<IntegrationRuntimeMonitoringData> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationService}/listMonitoringData?api-version=${DMSV2_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	return response.response.data;
}

export async function startDatabaseMigration(
	account: azdata.Account,
	subscription: Subscription,
	regionName: string,
	targetServer: SqlManagedInstance | SqlVMServer | AzureSqlDatabaseServer,
	targetDatabaseName: string,
	requestBody: StartDatabaseMigrationRequest,
	sessionId: string): Promise<StartDatabaseMigrationResponse> {

	const api = await getAzureCoreAPI();
	const path = encodeURI(`${targetServer.id}/providers/Microsoft.DataMigration/databaseMigrations/${targetDatabaseName}?api-version=${DMSV2_API_VERSION}`);
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.PUT, requestBody, true, host, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	const asyncUrl = response.response.headers['azure-asyncoperation'];
	return {
		asyncUrl: asyncUrl,
		status: response.response.status,
		databaseMigration: response.response.data
	};
}

export async function getMigrationDetails(account: azdata.Account, subscription: Subscription, migrationId: string, migrationOperationId?: string): Promise<DatabaseMigration> {

	const path = migrationOperationId === undefined
		? encodeURI(`${migrationId}?$expand=MigrationStatusDetails&api-version=${DMSV2_API_VERSION}`)
		: encodeURI(`${migrationId}?migrationOperationId=${migrationOperationId}&$expand=MigrationStatusDetails&api-version=${DMSV2_API_VERSION}`);

	const api = await getAzureCoreAPI();
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}

	return response.response.data;
}

export async function getServiceMigrations(account: azdata.Account, subscription: Subscription, resourceId: string): Promise<DatabaseMigration[]> {
	const path = encodeURI(`${resourceId}/listMigrations?&api-version=${DMSV2_API_VERSION}`);
	const api = await getAzureCoreAPI();
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}

	return response.response.data.value;
}

export async function getMigrationTargetInstance(account: azdata.Account, subscription: Subscription, migration: DatabaseMigration): Promise<SqlManagedInstance | SqlVMServer> {
	const targetServerId = getMigrationTargetId(migration);
	const path = encodeURI(`${targetServerId}?api-version=${SQL_MI_API_VERSION}`);
	const api = await getAzureCoreAPI();
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}

	return response.response.data;
}

export async function getMigrationAsyncOperationDetails(account: azdata.Account, subscription: Subscription, url: string): Promise<AzureAsyncOperationResource> {
	const api = await getAzureCoreAPI();
	const path = url.replace((new URL(url)).origin + '/', '');	// path is everything after the hostname, e.g. the 'test' part of 'https://management.azure.com/test'
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	return response.response.data;
}

export async function startMigrationCutover(account: azdata.Account, subscription: Subscription, migration: DatabaseMigration): Promise<any> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`${migration.id}/cutover?api-version=${DMSV2_API_VERSION}`);
	const requestBody = { migrationOperationId: migration.properties.migrationOperationId };
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, requestBody, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
	return response.response.data.value;
}

export async function stopMigration(account: azdata.Account, subscription: Subscription, migration: DatabaseMigration): Promise<void> {
	const api = await getAzureCoreAPI();
	const path = encodeURI(`${migration.id}/cancel?api-version=${DMSV2_API_VERSION}`);
	const requestBody = { migrationOperationId: migration.properties.migrationOperationId };
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, requestBody, true, host);
	if (response.errors.length > 0) {
		const message = response.errors
			.map(err => err.message)
			.join(', ');
		throw new Error(message);
	}
}

export async function getLocationDisplayName(location: string): Promise<string> {
	const api = await getAzureCoreAPI();
	return api.getRegionDisplayName(location);
}

export async function validateIrSqlDatabaseMigrationSettings(
	migration: MigrationStateModel,
	sourceServerName: string,
	trustServerCertificate: boolean,
	sourceDatabaseName: string,
	targetDatabaseName: string,
	testIrOnline: boolean = true,
	testSourceConnectivity: boolean = true,
	testTargetConnectivity: boolean = true): Promise<ValdiateIrDatabaseMigrationResponse> {

	const api = await getAzureCoreAPI();
	const account = migration._azureAccount;
	const subscription = migration._targetSubscription;
	const serviceId = migration._sqlMigrationService?.id;
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const path = encodeURI(`${serviceId}/validateIr?api-version=${DMSV2_API_VERSION}`);
	const targetDatabaseServer = migration._targetServerInstance as AzureSqlDatabaseServer;

	const requestBody: ValidateIrSqlDatabaseMigrationRequest = {
		sourceDatabaseName: sourceDatabaseName,
		targetDatabaseName: targetDatabaseName,
		kind: AzureResourceKind.SQLDB,
		validateIntegrationRuntimeOnline: testIrOnline,
		sourceSqlConnection: {
			testConnectivity: testSourceConnectivity,
			dataSource: sourceServerName,
			userName: migration._sqlServerUsername,
			password: migration._sqlServerPassword,
			authentication: migration._authenticationType,
			trustServerCertificate: trustServerCertificate,
			// encryptConnection: true,
		},
		targetSqlConnection: {
			testConnectivity: testTargetConnectivity,
			dataSource: targetDatabaseServer.properties.fullyQualifiedDomainName,
			userName: migration._targetUserName,
			password: migration._targetPassword,
			encryptConnection: true,
			trustServerCertificate: false,
			authentication: MigrationSourceAuthenticationType.Sql,
		}
	};

	const response = await api.makeAzureRestRequest(
		account,
		subscription,
		path,
		azurecore.HttpRequestMethod.POST,
		requestBody,
		true,
		host);

	if (response.errors.length > 0) {
		throw new Error(response.errors.map(e => e.message).join(','));
	}
	return response.response.data;
}

export async function validateIrDatabaseMigrationSettings(
	migration: MigrationStateModel,
	sourceServerName: string,
	trustServerCertificate: boolean,
	sourceDatabaseName: string,
	networkShare: NetworkShare,
	testIrOnline: boolean = true,
	testSourceLocationConnectivity: boolean = true,
	testSourceConnectivity: boolean = true,
	testBlobConnectivity: boolean = true): Promise<ValdiateIrDatabaseMigrationResponse> {

	const api = await getAzureCoreAPI();
	const account = migration._azureAccount;
	const subscription = migration._targetSubscription;
	const serviceId = migration._sqlMigrationService?.id;
	const host = api.getProviderMetadataForAccount(account).settings.armResource?.endpoint;
	const path = encodeURI(`${serviceId}/validateIr?api-version=${DMSV2_API_VERSION}`);
	const storage = await getStorageAccountAccessKeys(account, subscription, networkShare.storageAccount);

	const requestBody: ValdiateIrDatabaseMigrationRequest = {
		sourceDatabaseName: sourceDatabaseName ?? '',
		kind: migration.isSqlMiTarget
			? AzureResourceKind.SQLMI
			: AzureResourceKind.SQLVM,
		validateIntegrationRuntimeOnline: testIrOnline,
		backupConfiguration: {
			sourceLocation: {
				testConnectivity: testSourceLocationConnectivity,
				fileShare: {
					path: networkShare.networkShareLocation,
					username: networkShare.windowsUser,
					password: networkShare.password,
				},
			},
			targetLocation: {
				testConnectivity: testBlobConnectivity,
				accountKey: storage?.keyName1,
				storageAccountResourceId: networkShare.storageAccount?.id
			},
		},
		sourceSqlConnection: {
			testConnectivity: testSourceConnectivity,
			dataSource: sourceServerName,
			userName: migration._sqlServerUsername,
			password: migration._sqlServerPassword,
			trustServerCertificate: trustServerCertificate,
			encryptConnection: true,
			authentication: migration._authenticationType,
		}
	};

	const response = await api.makeAzureRestRequest(
		account,
		subscription,
		path,
		azurecore.HttpRequestMethod.POST,
		requestBody,
		true,
		host);

	if (response.errors.length > 0) {
		throw new Error(response.errors.map(e => e.message).join(','));
	}
	return response.response.data;
}

type SortableAzureResources = AzureProduct | azurecore.azureResource.FileShare | azurecore.azureResource.BlobContainer | azurecore.azureResource.Blob | azurecore.azureResource.AzureResourceSubscription | SqlMigrationService;
export function sortResourceArrayByName(resourceArray: SortableAzureResources[]): void {
	if (!resourceArray) {
		return;
	}
	resourceArray.sort((a: SortableAzureResources, b: SortableAzureResources) => {
		if (a?.name?.toLowerCase() < b?.name?.toLowerCase()) {
			return -1;
		}
		if (a?.name?.toLowerCase() > b?.name?.toLowerCase()) {
			return 1;
		}
		return 0;
	});
}

export function getMigrationTargetId(migration: DatabaseMigration): string {
	// `${targetServerId}/providers/Microsoft.DataMigration/databaseMigrations/${targetDatabaseName}?api-version=${DMSV2_API_VERSION}`
	const paths = migration.id.split('/providers/Microsoft.DataMigration/', 1);
	return paths[0];
}

export function getMigrationTargetName(migration: DatabaseMigration): string {
	const targetServerId = getMigrationTargetId(migration);
	return getResourceName(targetServerId);
}

export function getResourceGroupFromId(id: string): string {
	return id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '').toLowerCase();
}

export function getFullResourceGroupFromId(id: string): string {
	return id.replace(RegExp('/providers/.*'), '').toLowerCase();
}

export function getResourceName(id: string): string {
	const splitResourceId = id.split('/');
	return splitResourceId[splitResourceId.length - 1];
}

export function getBlobContainerId(resourceGroupId: string, storageAccountName: string, blobContainerName: string): string {
	return `${resourceGroupId}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}/blobServices/default/containers/${blobContainerName}`;
}

export interface SqlMigrationServiceProperties {
	name: string;
	subscriptionId: string;
	resourceGroup: string;
	location: string;
	provisioningState: string;
	integrationRuntimeState?: string;
	isProvisioned?: boolean;
}

export interface SqlMigrationService {
	id: string;
	name: string;
	location: string;
	properties: SqlMigrationServiceProperties;
	error: {
		code: string,
		message: string
	}
}

export interface SqlMigrationServiceAuthenticationKeys {
	authKey1: string,
	authKey2: string
}

export interface GetStorageAccountAccessKeysResult {
	keyName1: string,
	keyName2: string
}

export interface IntegrationRuntimeMonitoringData {
	name: string,
	nodes: IntegrationRuntimeNode[];
}

export interface IntegrationRuntimeNode {
	availableMemoryInMB: number,
	concurrentJobsLimit: number
	concurrentJobsRunning: number,
	cpuUtilization: number,
	nodeName: string
	receivedBytes: number
	sentBytes: number
}

export interface StartDatabaseMigrationRequest {
	location: string,
	properties: {
		sourceDatabaseName: string,
		migrationService: string,
		backupConfiguration: {
			targetLocation?: {
				storageAccountResourceId: string,
				accountKey: string,
			},
			sourceLocation?: SourceLocation
		},
		targetSqlConnection?: {
			dataSource: string,
			authentication: string,
			userName: string,
			password: string,
			encryptConnection?: boolean,
			trustServerCertificate?: boolean,
		},
		sourceSqlConnection: {
			dataSource: string,
			authentication: string,
			userName: string,
			password: string,
			encryptConnection?: boolean,
			trustServerCertificate?: boolean,
		},
		sqlDataCopyThresholds?: {
			cidxrowthreshold: number,
			cidxkbsthreshold: number,
		},
		tableList?: string[],
		scope: string,
		offlineConfiguration?: OfflineConfiguration,
	}
}

export interface StartDatabaseMigrationResponse {
	status: number,
	databaseMigration: DatabaseMigration,
	asyncUrl: string,
}

export enum AzureResourceKind {
	SQLDB = 'SqlDb',
	SQLMI = 'SqlMi',
	SQLVM = 'SqlVm',
}

export interface ValidateIrSqlDatabaseMigrationRequest {
	sourceDatabaseName: string,
	targetDatabaseName: string,
	kind: string,
	validateIntegrationRuntimeOnline?: boolean,
	sourceSqlConnection: {
		testConnectivity?: boolean,
		dataSource: string,
		userName: string,
		password: string,
		encryptConnection?: boolean,
		trustServerCertificate?: boolean,
		authentication: string,
	},
	targetSqlConnection: {
		testConnectivity?: boolean,
		dataSource: string,
		userName: string,
		password: string,
		encryptConnection?: boolean,
		trustServerCertificate?: boolean,
		authentication: string,
	},
}

export interface ValdiateIrDatabaseMigrationRequest {
	sourceDatabaseName: string,
	kind: string,
	validateIntegrationRuntimeOnline?: boolean,
	backupConfiguration: {
		targetLocation: {
			testConnectivity?: boolean,
			storageAccountResourceId?: string,
			accountKey?: string,
		},
		sourceLocation: {
			testConnectivity?: boolean,
			fileShare: {
				path: string,
				username: string,
				password: string,
			}
		}
	},
	sourceSqlConnection: {
		testConnectivity?: boolean,
		dataSource?: string,
		userName?: string,
		password?: string,
		encryptConnection?: boolean,
		trustServerCertificate?: boolean,
		authentication?: string,
	},
}

export interface ValidationError {
	code: string,
	message: string,
}

export interface ValdiateIrDatabaseMigrationResponse {
	kind: string,
	sourceDatabaseName: string,
	sourceSqlConnection: {
		testConnectivity: boolean,
		encryptConnection: true,
		trustServerCertificate: false,
		dataSource: string,
	},
	backupConfiguration: {
		sourceLocation: {
			testConnectivity: boolean,
			fileShare: {
				path: string, //?
			},
		},
		targetLocation: {
			testConnectivity: boolean,
			storageAccountResourceId: string,
		},
	},
	succeeded: boolean,
	errors: ValidationError[],
	validateIntegrationRuntimeOnline: boolean,
}

export interface DatabaseMigration {
	id: string;
	name: string;
	type: string;
	properties: DatabaseMigrationProperties;
}

export interface DatabaseMigrationProperties {
	scope: string;
	provisioningState: 'Succeeded' | 'Failed' | 'Creating';
	provisioningError: string;
	migrationStatus: 'Canceled' | 'Canceling' | 'Completing' | 'Creating' | 'Failed' | 'InProgress' | 'ReadyForCutover' | 'Restoring' | 'Retriable' | 'Succeeded' | 'UploadingFullBackup' | 'UploadingLogBackup';
	migrationStatusDetails?: MigrationStatusDetails;
	migrationStatusWarnings?: MigrationStatusWarnings;
	startedOn: string;
	endedOn: string;
	sourceDatabaseName: string;
	sourceServerName: string;
	targetDatabaseCollation: string;
	migrationService: string;
	migrationOperationId: string;
	backupConfiguration: BackupConfiguration;
	offlineConfiguration: OfflineConfiguration;
	migrationFailureError: ErrorInfo;
	tableList: string[];
}

export interface MigrationStatusDetails {
	migrationState: string;
	startedOn: string;
	endedOn: string;
	fullBackupSetInfo: BackupSetInfo;
	lastRestoredBackupSetInfo: BackupSetInfo;
	activeBackupSets: BackupSetInfo[];
	blobContainerName: string;
	isFullBackupRestored: boolean;
	restoreBlockingReason: string;
	fileUploadBlockingErrors: string[];
	currentRestoringFilename: string;
	lastRestoredFilename: string;
	pendingLogBackupsCount: number;
	invalidFiles: string[];
	listOfCopyProgressDetails: CopyProgressDetail[];
	sqlDataCopyErrors: string[];
}

export interface MigrationStatusWarnings {
	restoreBlockingReason?: string;
	completeRestoreErrorMessage?: string;
	fileUploadBlockingErrorCount?: number;
}

export interface CopyProgressDetail {
	tableName: string;
	status: 'PreparingForCopy' | 'Copying' | 'CopyFinished' | 'RebuildingIndexes' | 'Succeeded' | 'Failed' | 'Canceled',
	parallelCopyType: string;
	usedParallelCopies: number;
	dataRead: number;
	dataWritten: number;
	rowsRead: number;
	rowsCopied: number;
	copyStart: string;
	copyThroughput: number,
	copyDuration: number;
	errors: string[];
}

export interface SqlConnectionInfo {
	dataSource: string;
	authentication: string;
	username: string;
	password: string;
	encryptConnection: string;
	trustServerCertificate: string;
}

export interface BackupConfiguration {
	sourceLocation?: SourceLocation;
	targetLocation?: TargetLocation;
}

export interface OfflineConfiguration {
	offline: boolean;
	lastBackupName?: string;
}

export interface ErrorInfo {
	code: string;
	message: string;
}

export interface BackupSetInfo {
	backupSetId: string;
	firstLSN: string;
	lastLSN: string;
	backupType: string;
	listOfBackupFiles: BackupFileInfo[];
	backupStartDate: string;
	backupFinishDate: string;
	isBackupRestored: boolean;
	backupSize: number;
	compressedBackupSize: number;
	hasBackupChecksums: boolean;
	familyCount: number;
}

export interface SourceLocation {
	fileShare?: DatabaseMigrationFileShare;
	azureBlob?: DatabaseMigrationAzureBlob;
	fileStorageType: 'FileShare' | 'AzureBlob' | 'None';
}

export interface TargetLocation {
	storageAccountResourceId: string;
	accountKey: string;
}

export interface BackupFileInfo {
	fileName: string;
	status: 'Arrived' | 'Uploading' | 'Uploaded' | 'Restoring' | 'Restored' | 'Canceled' | 'Ignored';
	totalSize: number;
	dataRead: number;
	dataWritten: number;
	copyThroughput: number;
	copyDuration: number;
	familySequenceNumber: number;
}

export interface DatabaseMigrationFileShare {
	path: string;
	username: string;
	password: string;
}

export interface DatabaseMigrationAzureBlob {
	storageAccountResourceId: string;
	accountKey: string;
	blobContainerName: string;
}

export interface AzureAsyncOperationResource {
	name: string,
	status: string,
	startTime: string,
	endTime: string,
	percentComplete: number,
	error: ErrorInfo
}
