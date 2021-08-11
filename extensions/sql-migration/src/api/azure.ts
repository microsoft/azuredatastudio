/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import { azureResource } from 'azureResource';
import * as constants from '../constants/strings';
import { getSessionIdHeader } from './utils';
import { ProvisioningState } from '../models/migrationLocalStorage';

async function getAzureCoreAPI(): Promise<azurecore.IExtension> {
	const api = (await vscode.extensions.getExtension(azurecore.extension.name)?.activate()) as azurecore.IExtension;
	if (!api) {
		throw new Error('azure core API undefined for sql-migration');
	}
	return api;
}

export type Subscription = azureResource.AzureResourceSubscription;
export async function getSubscriptions(account: azdata.Account): Promise<Subscription[]> {
	const api = await getAzureCoreAPI();
	const subscriptions = await api.getSubscriptions(account, false);
	let listOfSubscriptions = subscriptions.subscriptions;
	sortResourceArrayByName(listOfSubscriptions);
	return subscriptions.subscriptions;
}

export async function getLocations(account: azdata.Account, subscription: Subscription): Promise<azureResource.AzureLocation[]> {
	const api = await getAzureCoreAPI();
	const response = await api.getLocations(account, subscription, true);
	const dataMigrationResourceProvider = (await api.makeAzureRestRequest(account, subscription, `/subscriptions/${subscription.id}/providers/Microsoft.DataMigration?api-version=2021-04-01`, azurecore.HttpRequestMethod.GET)).response.data;
	const sqlMigratonResource = dataMigrationResourceProvider.resourceTypes.find((r: any) => r.resourceType === 'SqlMigrationServices');
	const sqlMigrationResourceLocations = sqlMigratonResource.locations;

	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	sortResourceArrayByName(response.locations);

	const filteredLocations = response.locations.filter(loc => {
		return sqlMigrationResourceLocations.includes(loc.displayName);
	});
	return filteredLocations;
}

export type AzureProduct = azureResource.AzureGraphResource;

export async function getResourceGroups(account: azdata.Account, subscription: Subscription): Promise<azureResource.AzureResourceResourceGroup[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getResourceGroups(account, subscription, false);
	sortResourceArrayByName(result.resourceGroups);
	return result.resourceGroups;
}

export async function createResourceGroup(account: azdata.Account, subscription: Subscription, resourceGroupName: string, location: string): Promise<azureResource.AzureResourceResourceGroup> {
	const api = await getAzureCoreAPI();
	const result = await api.createResourceGroup(account, subscription, resourceGroupName, location, false);
	return result.resourceGroup;
}

export type SqlManagedInstance = azureResource.AzureSqlManagedInstance;
export async function getAvailableManagedInstanceProducts(account: azdata.Account, subscription: Subscription): Promise<SqlManagedInstance[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getSqlManagedInstances(account, [subscription], false);
	sortResourceArrayByName(result.resources);
	return result.resources;
}

export async function getSqlManagedInstanceDatabases(account: azdata.Account, subscription: Subscription, managedInstance: SqlManagedInstance): Promise<azureResource.ManagedDatabase[]> {
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
export async function getAvailableSqlVMs(account: azdata.Account, subscription: Subscription, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<SqlVMServer[]> {
	const api = await getAzureCoreAPI();
	const path = `/subscriptions/${subscription.id}/resourceGroups/${resourceGroup.name}/providers/Microsoft.SqlVirtualMachine/sqlVirtualMachines?api-version=2017-03-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true);
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	sortResourceArrayByName(response.response.data.value);
	return response.response.data.value;
}

export type StorageAccount = AzureProduct;
export async function getAvailableStorageAccounts(account: azdata.Account, subscription: Subscription): Promise<StorageAccount[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getStorageAccounts(account, [subscription], false);
	sortResourceArrayByName(result.resources);
	return result.resources;
}

export async function getFileShares(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount): Promise<azureResource.FileShare[]> {
	const api = await getAzureCoreAPI();
	let result = await api.getFileShares(account, subscription, storageAccount, true);
	let fileShares = result.fileShares;
	sortResourceArrayByName(fileShares);
	return fileShares!;
}

export async function getBlobContainers(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount): Promise<azureResource.BlobContainer[]> {
	const api = await getAzureCoreAPI();
	let result = await api.getBlobContainers(account, subscription, storageAccount, true);
	let blobContainers = result.blobContainers;
	sortResourceArrayByName(blobContainers);
	return blobContainers!;
}

export async function getBlobs(account: azdata.Account, subscription: Subscription, storageAccount: StorageAccount, containerName: string): Promise<azureResource.Blob[]> {
	const api = await getAzureCoreAPI();
	let result = await api.getBlobs(account, subscription, storageAccount, containerName, true);
	let blobNames = result.blobs;
	sortResourceArrayByName(blobNames);
	return blobNames!;
}

export async function getSqlMigrationService(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string, sessionId: string): Promise<SqlMigrationService> {
	const api = await getAzureCoreAPI();
	const path = `/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	response.response.data.properties.resourceGroup = getResourceGroupFromId(response.response.data.id);
	return response.response.data;
}

export async function getSqlMigrationServices(account: azdata.Account, subscription: Subscription, resouceGroupName: string, sessionId: string): Promise<SqlMigrationService[]> {
	const api = await getAzureCoreAPI();
	const path = `/subscriptions/${subscription.id}/resourceGroups/${resouceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	sortResourceArrayByName(response.response.data.value);
	response.response.data.value.forEach((sms: SqlMigrationService) => {
		sms.properties.resourceGroup = getResourceGroupFromId(sms.id);
	});
	return response.response.data.value;
}

export async function createSqlMigrationService(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string, sessionId: string): Promise<SqlMigrationService> {
	const api = await getAzureCoreAPI();
	const path = `/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}?api-version=2020-09-01-preview`;
	const requestBody = {
		'location': regionName
	};
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.PUT, requestBody, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	const asyncUrl = response.response.headers['azure-asyncoperation'];
	const maxRetry = 24;
	let i = 0;
	for (i = 0; i < maxRetry; i++) {
		const asyncResponse = await api.makeAzureRestRequest(account, subscription, asyncUrl.replace('https://management.azure.com/', ''), azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
		const creationStatus = asyncResponse.response.data.status;
		if (creationStatus === ProvisioningState.Succeeded) {
			break;
		} else if (creationStatus === ProvisioningState.Failed) {
			throw new Error(asyncResponse.errors.toString());
		}
		await new Promise(resolve => setTimeout(resolve, 5000)); //adding  5 sec delay before getting creation status
	}
	if (i === maxRetry) {
		throw new Error(constants.DMS_PROVISIONING_FAILED);
	}
	return response.response.data;
}

export async function getSqlMigrationServiceAuthKeys(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string, sessionId: string): Promise<SqlMigrationServiceAuthenticationKeys> {
	const api = await getAzureCoreAPI();
	const path = `/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}/ListAuthKeys?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	return {
		authKey1: response?.response?.data?.authKey1 ?? '',
		authKey2: response?.response?.data?.authKey2 ?? ''
	};
}

export async function regenerateSqlMigrationServiceAuthKey(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationServiceName: string, keyName: string, sessionId: string): Promise<SqlMigrationServiceAuthenticationKeys> {
	const api = await getAzureCoreAPI();
	const path = `/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationServiceName}/regenerateAuthKeys?api-version=2020-09-01-preview`;
	const requestBody = {
		'location': regionName,
		'keyName': keyName,
	};

	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, requestBody, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
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
		throw new Error(response.errors.toString());
	}
	return {
		keyName1: response?.keyName1,
		keyName2: response?.keyName2
	};
}

export async function getSqlMigrationServiceMonitoringData(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, sqlMigrationService: string, sessionId: string): Promise<IntegrationRuntimeMonitoringData> {
	const api = await getAzureCoreAPI();
	const path = `/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/sqlMigrationServices/${sqlMigrationService}/monitoringData?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	return response.response.data;
}

export async function startDatabaseMigration(account: azdata.Account, subscription: Subscription, regionName: string, targetServer: SqlManagedInstance | SqlVMServer, targetDatabaseName: string, requestBody: StartDatabaseMigrationRequest, sessionId: string): Promise<StartDatabaseMigrationResponse> {
	const api = await getAzureCoreAPI();
	const path = `${targetServer.id}/providers/Microsoft.DataMigration/databaseMigrations/${targetDatabaseName}?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.PUT, requestBody, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	const asyncUrl = response.response.headers['azure-asyncoperation'];
	return {
		asyncUrl: asyncUrl,
		status: response.response.status,
		databaseMigration: response.response.data
	};
}

export async function getDatabaseMigration(account: azdata.Account, subscription: Subscription, regionName: string, migrationId: string, sessionId: string): Promise<DatabaseMigration> {
	const api = await getAzureCoreAPI();
	const path = `${migrationId}?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		if (response.response.status === 404 && response.response.data.error.code === 'ResourceDoesNotExist') {
			throw new Error(response.response.data.error.code);
		}
		throw new Error(response.errors.toString());
	}
	return response.response.data;
}

export async function getMigrationStatus(account: azdata.Account, subscription: Subscription, migration: DatabaseMigration, sessionId: string): Promise<DatabaseMigration> {
	const api = await getAzureCoreAPI();
	const path = `${migration.id}?$expand=MigrationStatusDetails&api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	return response.response.data;
}

export async function getMigrationAsyncOperationDetails(account: azdata.Account, subscription: Subscription, url: string, sessionId: string): Promise<AzureAsyncOperationResource> {
	const api = await getAzureCoreAPI();
	const response = await api.makeAzureRestRequest(account, subscription, url.replace('https://management.azure.com/', ''), azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	return response.response.data;
}

export async function listMigrationsBySqlMigrationService(account: azdata.Account, subscription: Subscription, sqlMigrationService: SqlMigrationService, sessionId: string): Promise<DatabaseMigration[]> {
	const api = await getAzureCoreAPI();
	const path = `${sqlMigrationService.id}/listMigrations?$expand=MigrationStatusDetails&api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.GET, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	return response.response.data.value;
}

export async function startMigrationCutover(account: azdata.Account, subscription: Subscription, migrationStatus: DatabaseMigration, sessionId: string): Promise<any> {
	const api = await getAzureCoreAPI();
	const path = `${migrationStatus.id}/operations/${migrationStatus.properties.migrationOperationId}/cutover?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
	return response.response.data.value;
}

export async function stopMigration(account: azdata.Account, subscription: Subscription, migrationStatus: DatabaseMigration, sessionId: string): Promise<void> {
	const api = await getAzureCoreAPI();
	const path = `${migrationStatus.id}/operations/${migrationStatus.properties.migrationOperationId}/cancel?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, path, azurecore.HttpRequestMethod.POST, undefined, true, undefined, getSessionIdHeader(sessionId));
	if (response.errors.length > 0) {
		throw new Error(response.errors.toString());
	}
}

export async function getLocationDisplayName(location: string): Promise<string> {
	const api = await getAzureCoreAPI();
	return await api.getRegionDisplayName(location);
}

type SortableAzureResources = AzureProduct | azureResource.FileShare | azureResource.BlobContainer | azureResource.Blob | azureResource.AzureResourceSubscription | SqlMigrationService;
function sortResourceArrayByName(resourceArray: SortableAzureResources[]): void {
	if (!resourceArray) {
		return;
	}
	resourceArray.sort((a: SortableAzureResources, b: SortableAzureResources) => {
		if (a.name.toLowerCase() < b.name.toLowerCase()) {
			return -1;
		}
		if (a.name.toLowerCase() > b.name.toLowerCase()) {
			return 1;
		}
		return 0;
	});
}

export function getResourceGroupFromId(id: string): string {
	return id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '').toLowerCase();
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
	properties: SqlMigrationServiceProperties;
	location: string;
	id: string;
	name: string;
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
		sourceSqlConnection: {
			authentication: string,
			dataSource: string,
			username: string,
			password: string
		},
		scope: string,
		autoCutoverConfiguration?: {
			autoCutover?: boolean,
			lastBackupName?: string
		},
	}
}

export interface StartDatabaseMigrationResponse {
	status: number,
	databaseMigration: DatabaseMigration
	asyncUrl: string
}

export interface DatabaseMigration {
	properties: DatabaseMigrationProperties;
	id: string;
	name: string;
	type: string;
}
export interface DatabaseMigrationProperties {
	scope: string;
	provisioningState: 'Succeeded' | 'Failed' | 'Creating';
	migrationStatus: 'InProgress' | 'Failed' | 'Succeeded' | 'Creating' | 'Completing' | 'Canceling';
	migrationStatusDetails?: MigrationStatusDetails;
	startedOn: string;
	endedOn: string;
	sourceSqlConnection: SqlConnectionInfo;
	sourceDatabaseName: string;
	targetDatabaseCollation: string;
	migrationService: string;
	migrationOperationId: string;
	backupConfiguration: BackupConfiguration;
	autoCutoverConfiguration: AutoCutoverConfiguration;
	migrationFailureError: ErrorInfo;
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
	currentRestoringFileName: string;
	lastRestoredFilename: string;
	pendingLogBackupsCount: number;
	invalidFiles: string[];
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

export interface AutoCutoverConfiguration {
	autoCutover: boolean;
	lastBackupName: string;
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
}

export interface TargetLocation {
	storageAccountResourceId: string;
	accountKey: string;
}

export interface BackupFileInfo {
	fileName: string;
	status: 'Arrived' | 'Uploading' | 'Uploaded' | 'Restoring' | 'Restored' | 'Cancelled' | 'Ignored';
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
