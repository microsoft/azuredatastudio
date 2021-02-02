/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import { azureResource } from 'azureResource';

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

export type AzureProduct = azureResource.AzureGraphResource;

export async function getResourceGroups(account: azdata.Account, subscription: Subscription): Promise<azureResource.AzureResourceResourceGroup[]> {
	const api = await getAzureCoreAPI();
	const result = await api.getResourceGroups(account, subscription, false);
	sortResourceArrayByName(result.resourceGroups);
	return result.resourceGroups;
}

export type SqlManagedInstance = AzureProduct;
export async function getAvailableManagedInstanceProducts(account: azdata.Account, subscription: Subscription): Promise<SqlManagedInstance[]> {
	const api = await getAzureCoreAPI();

	const result = await api.getSqlManagedInstances(account, [subscription], false);
	return result.resources;
}

export type SqlServer = AzureProduct;
export async function getAvailableSqlServers(account: azdata.Account, subscription: Subscription): Promise<SqlServer[]> {
	const api = await getAzureCoreAPI();

	const result = await api.getSqlServers(account, [subscription], false);
	return result.resources;
}

export type SqlVMServer = AzureProduct;
export async function getAvailableSqlVMs(account: azdata.Account, subscription: Subscription): Promise<SqlVMServer[]> {
	const api = await getAzureCoreAPI();

	const result = await api.getSqlVMServers(account, [subscription], false);
	return result.resources;
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

export async function getMigrationController(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, controllerName: string): Promise<MigrationController> {
	const api = await getAzureCoreAPI();
	const serviceUrl = `https://${regionName}.management.azure.com/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/Controllers/${controllerName}?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, serviceUrl, azurecore.HttpRequestMethod.GET, undefined, true);
	if (response.errors.length > 0) {
		throw response.errors;
	}

	return response.response.data;
}

export async function createMigrationController(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, controllerName: string): Promise<MigrationController> {
	const api = await getAzureCoreAPI();
	const serviceUrl = `https://${regionName}.management.azure.com/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/Controllers/${controllerName}?api-version=2020-09-01-preview`;
	const requestBody = {
		'location': regionName
	};
	const response = await api.makeAzureRestRequest(account, subscription, serviceUrl, azurecore.HttpRequestMethod.PUT, requestBody, true);
	if (response.errors.length > 0) {
		throw response.errors;
	}
	return response.response.data;
}

export async function getMigrationControllerAuthKeys(account: azdata.Account, subscription: Subscription, resourceGroupName: string, regionName: string, controllerName: string): Promise<GetMigrationControllerAuthKeysResult> {
	const api = await getAzureCoreAPI();
	const serviceUrl = `https://${regionName}.management.azure.com/subscriptions/${subscription.id}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataMigration/Controllers/${controllerName}/ListAuthKeys?api-version=2020-09-01-preview`;
	const response = await api.makeAzureRestRequest(account, subscription, serviceUrl, azurecore.HttpRequestMethod.POST, undefined, true);
	if (response.errors.length > 0) {
		throw response.errors;
	}
	return {
		keyName1: response?.response?.data?.keyName1 ?? '',
		keyName2: response?.response?.data?.keyName2 ?? ''
	};
}

/**
 * For now only east us euap is supported. Actual API calls will be added in the public release.
 */
export function getMigrationControllerRegions(): azdata.CategoryValue[] {
	return [
		{
			displayName: 'East US EUAP',
			name: 'eastus2euap'
		}
	];
}

type SortableAzureResources = AzureProduct | azureResource.FileShare | azureResource.BlobContainer | azureResource.AzureResourceSubscription;
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

export interface MigrationControllerProperties {
	name: string;
	subscriptionId: string;
	resourceGroup: string;
	location: string;
	provisioningState: string;
	integrationRuntimeState?: string;
	isProvisioned?: boolean;
}

export interface MigrationController {
	properties: MigrationControllerProperties;
	location: string;
	id: string;
	name: string;
	error: {
		code: string,
		message: string
	}
}

export interface GetMigrationControllerAuthKeysResult {
	keyName1: string,
	keyName2: string
}
