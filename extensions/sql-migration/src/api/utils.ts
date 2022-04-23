/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IconPathHelper } from '../constants/iconPathHelper';
import { AdsMigrationStatus } from '../dialog/migrationStatus/migrationStatusDialogModel';
import { MigrationStatus, ProvisioningState } from '../models/migrationLocalStorage';
import * as crypto from 'crypto';
import { DatabaseMigration, getAvailableManagedInstanceProducts, getAvailableSqlVMs, getAvailableStorageAccounts, getBlobContainers, getBlobs, getFileShares, getFullResourceGroupFromId, getLocations, getResourceGroupFromId, getResourceGroups, getSqlMigrationServices, getSubscriptions, SqlMigrationService, SqlVMServer, StorageAccount } from './azure';
import { azureResource, Tenant } from 'azurecore';
import * as constants from '../constants/strings';


export function deepClone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result: any = Array.isArray(obj) ? [] : {};
	Object.keys(<any>obj).forEach((key: string) => {
		if ((<any>obj)[key] && typeof (<any>obj)[key] === 'object') {
			result[key] = deepClone((<any>obj)[key]);
		} else {
			result[key] = (<any>obj)[key];
		}
	});
	return result;
}

export function getSqlServerName(majorVersion: number): string | undefined {
	switch (majorVersion) {
		case 10:
			return 'SQL Server 2008';
		case 11:
			return 'SQL Server 2012';
		case 12:
			return 'SQL Server 2014';
		case 13:
			return 'SQL Server 2016';
		case 14:
			return 'SQL Server 2017';
		case 15:
			return 'SQL Server 2019';
		default:
			return undefined;
	}
}

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo | undefined {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
	return undefined;
}

/**
 * Generates a wordy time difference between start and end time.
 * @returns stringified duration like '10.0 days', '12.0 hrs', '1.0 min'
 */
export function convertTimeDifferenceToDuration(startTime: Date, endTime: Date): string {
	const time = endTime.getTime() - startTime.getTime();
	let seconds = (time / 1000).toFixed(1);
	let minutes = (time / (1000 * 60)).toFixed(1);
	let hours = (time / (1000 * 60 * 60)).toFixed(1);
	let days = (time / (1000 * 60 * 60 * 24)).toFixed(1);
	if (time / 1000 < 60) {
		return constants.SEC(parseFloat(seconds));
	}
	else if (time / (1000 * 60) < 60) {
		return constants.MINUTE(parseFloat(minutes));
	}
	else if (time / (1000 * 60 * 60) < 24) {
		return constants.HRS(parseFloat(hours));
	}
	else {
		return constants.DAYS(parseFloat(days));
	}
}

export function filterMigrations(databaseMigrations: DatabaseMigration[], statusFilter: string, databaseNameFilter?: string): DatabaseMigration[] {
	let filteredMigration: DatabaseMigration[] = [];
	if (statusFilter === AdsMigrationStatus.ALL) {
		filteredMigration = databaseMigrations;
	} else if (statusFilter === AdsMigrationStatus.ONGOING) {
		filteredMigration = databaseMigrations.filter(
			value => {
				const status = value.properties?.migrationStatus;
				return status === MigrationStatus.InProgress
					|| status === MigrationStatus.Creating
					|| value.properties?.provisioningState === MigrationStatus.Creating;
			});
	} else if (statusFilter === AdsMigrationStatus.SUCCEEDED) {
		filteredMigration = databaseMigrations.filter(
			value => value.properties?.migrationStatus === MigrationStatus.Succeeded);
	} else if (statusFilter === AdsMigrationStatus.FAILED) {
		filteredMigration = databaseMigrations.filter(
			value =>
				value.properties?.migrationStatus === MigrationStatus.Failed ||
				value.properties?.provisioningState === ProvisioningState.Failed);
	} else if (statusFilter === AdsMigrationStatus.COMPLETING) {
		filteredMigration = databaseMigrations.filter(
			value => value.properties?.migrationStatus === MigrationStatus.Completing);
	}
	if (databaseNameFilter) {
		const filter = databaseNameFilter.toLowerCase();
		filteredMigration = filteredMigration.filter(
			migration => migration.name?.toLowerCase().includes(filter));
	}
	return filteredMigration;
}

export function convertByteSizeToReadableUnit(size: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	for (let i = 1; i < units.length; i++) {
		const higherUnit = size / 1024;
		if (higherUnit < 0.1) {
			return `${size.toFixed(2)} ${units[i - 1]}`;
		}
		size = higherUnit;
	}
	return size.toString();
}

export function convertIsoTimeToLocalTime(isoTime: string): Date {
	let isoDate = new Date(isoTime);
	return new Date(isoDate.getTime() + (isoDate.getTimezoneOffset() * 60000));
}

export function selectDefaultDropdownValue(dropDown: azdata.DropDownComponent, value?: string, useDisplayName: boolean = true): void {
	if (dropDown.values && dropDown.values.length > 0) {
		let selectedIndex;
		if (value) {
			if (useDisplayName) {
				selectedIndex = dropDown.values.findIndex((v: any) => (v as azdata.CategoryValue)?.displayName?.toLowerCase() === value.toLowerCase());
			} else {
				selectedIndex = dropDown.values.findIndex((v: any) => (v as azdata.CategoryValue)?.name?.toLowerCase() === value.toLowerCase());
			}
		} else {
			selectedIndex = -1;
		}
		selectDropDownIndex(dropDown, selectedIndex > -1 ? selectedIndex : 0);
	}
}

export function selectDropDownIndex(dropDown: azdata.DropDownComponent, index: number): void {
	if (dropDown.values && dropDown.values.length > 0) {
		if (index >= 0 && index <= dropDown.values.length - 1) {
			dropDown.value = dropDown.values[index] as azdata.CategoryValue;
			return;
		}
	}
	dropDown.value = undefined;
}

export function hashString(value: string): string {
	if (value?.length > 0) {
		return crypto.createHash('sha512').update(value).digest('hex');
	}

	return '';
}

export function debounce(delay: number): Function {
	return decorate((fn, key) => {
		const timerKey = `$debounce$${key}`;

		return function (this: any, ...args: any[]) {
			clearTimeout(this[timerKey]);
			this[timerKey] = setTimeout(() => fn.apply(this, args), delay);
		};
	});
}

export function decorate(decorator: (fn: Function, key: string) => Function): Function {
	return (_target: any, key: string, descriptor: any) => {
		let fnKey: string | null = null;
		let fn: Function | null = null;

		if (typeof descriptor.value === 'function') {
			fnKey = 'value';
			fn = descriptor.value;
		} else if (typeof descriptor.get === 'function') {
			fnKey = 'get';
			fn = descriptor.get;
		}

		if (!fn || !fnKey) {
			throw new Error('not supported');
		}

		descriptor[fnKey] = decorator(fn, key);
	};
}

export function getSessionIdHeader(sessionId: string): { [key: string]: string } {
	return {
		'SqlMigrationSessionId': sessionId
	};
}

export function getMigrationStatusImage(status: string): azdata.IconPath {
	switch (status) {
		case MigrationStatus.InProgress:
			return IconPathHelper.inProgressMigration;
		case MigrationStatus.Succeeded:
			return IconPathHelper.completedMigration;
		case MigrationStatus.Creating:
			return IconPathHelper.notStartedMigration;
		case MigrationStatus.Completing:
			return IconPathHelper.completingCutover;
		case MigrationStatus.Canceling:
			return IconPathHelper.cancel;
		case MigrationStatus.Failed:
		default:
			return IconPathHelper.error;
	}
}

export function get12HourTime(date: Date | undefined): string {
	const localeTimeStringOptions: Intl.DateTimeFormatOptions = {
		hour: '2-digit',
		minute: '2-digit'
	};
	return (date ? date : new Date()).toLocaleTimeString([], localeTimeStringOptions);
}

export function displayDialogErrorMessage(dialog: azdata.window.Dialog, text: string, error: Error): void {
	dialog.message = {
		level: azdata.window.MessageLevel.Error,
		text: text,
		description: error.message,
	};
}

export function clearDialogMessage(dialog: azdata.window.Dialog): void {
	dialog.message = {
		text: ''
	};
}

export function getUserHome(): string | undefined {
	return process.env.HOME || process.env.USERPROFILE;
}

export async function getAzureAccounts(): Promise<azdata.Account[]> {
	let accounts: azdata.Account[] = [];
	try {
		accounts = await azdata.accounts.getAllAccounts();
	} catch (e) {
		console.log(e);
		accounts = [];
	}
	return accounts;
}

export async function getAzureAccountsDropdownValues(accounts: azdata.Account[]): Promise<azdata.CategoryValue[]> {
	let accountsValues: azdata.CategoryValue[] = [];
	accounts.forEach((account) => {
		accountsValues.push({
			name: account.displayInfo.userId,
			displayName: account.isStale
				? constants.ACCOUNT_CREDENTIALS_REFRESH(account.displayInfo.displayName)
				: account.displayInfo.displayName
		});
	});
	if (accountsValues.length === 0) {
		accountsValues = [
			{
				displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,	//
				name: ''
			}
		];
	}
	return accountsValues;
}

export async function getAzureTenants(account?: azdata.Account): Promise<Tenant[]> {
	let tenants: Tenant[] = [];
	try {
		if (account) {
			tenants = account.properties.tenants;
		}
	} catch (e) {
		console.log(e);
		tenants = [];
	}
	return tenants;
}

export async function getAzureTenantsDropdownValues(tenants: Tenant[]): Promise<azdata.CategoryValue[]> {
	let tenantsValues: azdata.CategoryValue[] = [];
	tenants.forEach((tenant) => {
		tenantsValues.push({
			name: tenant.id,
			displayName: tenant.displayName
		});
	});
	if (tenantsValues.length === 0) {
		tenantsValues = [
			{
				displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,	//
				name: ''
			}
		];
	}
	return tenantsValues;
}

export async function getAzureSubscriptions(account?: azdata.Account): Promise<azureResource.AzureResourceSubscription[]> {
	let subscriptions: azureResource.AzureResourceSubscription[] = [];
	try {
		if (account) {
			subscriptions = !account.isStale ? await getSubscriptions(account) : [];
		}
	} catch (e) {
		console.log(e);
		subscriptions = [];
	}
	subscriptions.sort((a, b) => a.name.localeCompare(b.name));
	return subscriptions;
}

export async function getAzureSubscriptionsDropdownValues(subscriptions: azureResource.AzureResourceSubscription[]): Promise<azdata.CategoryValue[]> {
	let subscriptionsValues: azdata.CategoryValue[] = [];
	subscriptions.forEach((subscription) => {
		subscriptionsValues.push({
			name: subscription.id,
			displayName: `${subscription.name} - ${subscription.id}`
		});
	});
	if (subscriptionsValues.length === 0) {
		subscriptionsValues = [
			{
				displayName: constants.NO_SUBSCRIPTIONS_FOUND,
				name: ''
			}
		];
	}
	return subscriptionsValues;
}

export enum SelectableResourceType {
	ManagedInstance,
	VirtualMachine,
	StorageAccount,
	SqlMigrationService,
}

export async function getAzureLocations(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, resourceType?: SelectableResourceType, resources?: azureResource.AzureSqlManagedInstance[] | SqlVMServer[] | StorageAccount[] | SqlMigrationService[]): Promise<azureResource.AzureLocation[]> {
	let locations: azureResource.AzureLocation[] = [];
	try {
		if (account && subscription) {
			locations = await getLocations(account, subscription);

			// only show locations that contain resources of the desired type, if applicable
			switch (resourceType) {
				case SelectableResourceType.ManagedInstance:
					const managedInstances = resources as azureResource.AzureSqlManagedInstance[];
					locations = locations.filter((loc, i) => managedInstances.some(mi => mi.location.toLowerCase() === loc.name.toLowerCase()));
					break;
				case SelectableResourceType.VirtualMachine:
					const virtualMachines = resources as SqlVMServer[];
					locations = locations.filter((loc, i) => virtualMachines.some(vm => vm.location.toLowerCase() === loc.name.toLowerCase()));
					break;
				case SelectableResourceType.StorageAccount:
					const storageAccounts = resources as StorageAccount[];
					locations = locations.filter((loc, i) => storageAccounts.some(sa => sa.location.toLowerCase() === loc.name.toLowerCase()));
					break;
				case SelectableResourceType.SqlMigrationService:
					const sqlMigrationServices = resources as SqlMigrationService[];
					locations = locations.filter((loc, i) => sqlMigrationServices.some(dms => dms.location.toLowerCase() === loc.name.toLowerCase()));
					break;
				default:
					break;
			}
		}
	} catch (e) {
		console.log(e);
		locations = [];
	}
	locations.sort((a, b) => a.displayName.localeCompare(b.displayName));
	return locations;
}

export async function getAzureLocationsDropdownValues(locations: azureResource.AzureLocation[]): Promise<azdata.CategoryValue[]> {
	let locationValues: azdata.CategoryValue[] = [];
	locations.forEach((loc) => {
		locationValues.push({
			name: loc.name,
			displayName: loc.displayName
		});
	});
	if (locationValues.length === 0) {
		locationValues = [
			{
				displayName: constants.NO_LOCATION_FOUND,
				name: ''
			}
		];
	}
	return locationValues;
}

export async function getAzureResourceGroupsByResources(resourceType: SelectableResourceType, resources: azureResource.AzureSqlManagedInstance[] | SqlVMServer[] | StorageAccount[] | SqlMigrationService[], location: azureResource.AzureLocation): Promise<azureResource.AzureResourceResourceGroup[]> {
	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	try {
		// derive resource groups from resources
		switch (resourceType) {
			case SelectableResourceType.ManagedInstance:
				const managedInstances = resources as azureResource.AzureSqlManagedInstance[];
				resourceGroups = managedInstances
					.filter((mi) => mi.location.toLowerCase() === location.name.toLowerCase())
					.map((mi) => {
						return <azureResource.AzureResourceResourceGroup>{
							id: getFullResourceGroupFromId(mi.id),
							name: getResourceGroupFromId(mi.id),
							subscription: {
								id: mi.subscriptionId
							},
							tenant: mi.tenantId
						};
					});
				break;
			case SelectableResourceType.VirtualMachine:
				const virtualMachines = resources as SqlVMServer[];
				resourceGroups = virtualMachines
					.filter((vm) => vm.location.toLowerCase() === location.name.toLowerCase())
					.map((vm) => {
						return <azureResource.AzureResourceResourceGroup>{
							id: getFullResourceGroupFromId(vm.id),
							name: getResourceGroupFromId(vm.id),
							subscription: {
								id: vm.subscriptionId
							},
							tenant: vm.tenantId
						};
					});
				break;
			case SelectableResourceType.StorageAccount:
				const storageAccounts = resources as StorageAccount[];
				resourceGroups = storageAccounts
					.filter((sa) => sa.location.toLowerCase() === location.name.toLowerCase())
					.map((sa) => {
						return <azureResource.AzureResourceResourceGroup>{
							id: getFullResourceGroupFromId(sa.id),
							name: getResourceGroupFromId(sa.id),
							subscription: {
								id: sa.subscriptionId
							},
							tenant: sa.tenantId
						};
					});
				break;
			case SelectableResourceType.SqlMigrationService:
				const dmsInstances = resources as SqlMigrationService[];
				resourceGroups = dmsInstances
					.filter((dms) => dms.properties.provisioningState === 'Succeeded' && dms.location.toLowerCase() === location.name.toLowerCase())
					.map((dms) => {
						return <azureResource.AzureResourceResourceGroup>{
							id: getFullResourceGroupFromId(dms.id),
							name: getResourceGroupFromId(dms.id),
							subscription: {
								id: dms.properties.subscriptionId
							},
						};
					});
				break;
		}
	} catch (e) {
		console.log(e);
		resourceGroups = [];
	}

	// remove duplicates
	resourceGroups = resourceGroups.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);
	resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroups;
}

export async function getAzureResourceGroups(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription): Promise<azureResource.AzureResourceResourceGroup[]> {
	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	try {
		if (account && subscription) {
			resourceGroups = await getResourceGroups(account, subscription);
		}
	} catch (e) {
		console.log(e);
		resourceGroups = [];
	}
	resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroups;
}

export async function getAzureResourceGroupsDropdownValues(resourceGroups: azureResource.AzureResourceResourceGroup[]): Promise<azdata.CategoryValue[]> {
	let resourceGroupValues: azdata.CategoryValue[] = [];
	resourceGroups.forEach((rg) => {
		resourceGroupValues.push({
			name: rg.id,
			displayName: rg.name
		});
	});
	if (resourceGroupValues.length === 0) {
		resourceGroupValues = [
			{
				displayName: constants.RESOURCE_GROUP_NOT_FOUND,
				name: ''
			}
		];
	}
	return resourceGroupValues;
}

export async function getManagedInstances(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription): Promise<azureResource.AzureSqlManagedInstance[]> {
	let managedInstances: azureResource.AzureSqlManagedInstance[] = [];
	try {
		if (account && subscription) {
			managedInstances = await getAvailableManagedInstanceProducts(account, subscription);
		}
	} catch (e) {
		console.log(e);
		managedInstances = [];
	}
	managedInstances.sort((a, b) => a.name.localeCompare(b.name));
	return managedInstances;
}

export async function getManagedInstancesDropdownValues(managedInstances: azureResource.AzureSqlManagedInstance[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {
	let managedInstancesValues: azdata.CategoryValue[] = [];
	if (location && resourceGroup) {
		managedInstances.forEach((managedInstance) => {
			if (managedInstance.location.toLowerCase() === location.name.toLowerCase() && managedInstance.resourceGroup?.toLowerCase() === resourceGroup.name.toLowerCase()) {
				let managedInstanceValue: azdata.CategoryValue;
				if (managedInstance.properties.state === 'Ready') {
					managedInstanceValue = {
						name: managedInstance.id,
						displayName: managedInstance.name
					};
				} else {
					managedInstanceValue = {
						name: managedInstance.id,
						displayName: constants.UNAVAILABLE_TARGET_PREFIX(managedInstance.name)
					};
				}
				managedInstancesValues.push(managedInstanceValue);
			}
		});
	}

	if (managedInstancesValues.length === 0) {
		managedInstancesValues = [
			{
				displayName: constants.NO_MANAGED_INSTANCE_FOUND,
				name: ''
			}
		];
	}
	return managedInstancesValues;
}

export async function getVirtualMachines(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription): Promise<SqlVMServer[]> {
	let virtualMachines: SqlVMServer[] = [];
	try {
		if (account && subscription) {
			virtualMachines = (await getAvailableSqlVMs(account, subscription)).filter((virtualMachine) => {
				if (virtualMachine.properties.sqlImageOffer) {
					return virtualMachine.properties.sqlImageOffer.toLowerCase().includes('-ws'); //filtering out all non windows sql vms.
				}
				return true; // Returning all VMs that don't have this property as we don't want to accidentally skip valid vms.
			});
		}
	} catch (e) {
		console.log(e);
		virtualMachines = [];
	}
	virtualMachines.sort((a, b) => a.name.localeCompare(b.name));
	return virtualMachines;
}

export async function getVirtualMachinesDropdownValues(virtualMachines: SqlVMServer[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {
	let virtualMachineValues: azdata.CategoryValue[] = [];
	if (location && resourceGroup) {
		virtualMachines.forEach((virtualMachine) => {
			if (virtualMachine.location.toLowerCase() === location.name.toLowerCase() && getResourceGroupFromId(virtualMachine.id).toLowerCase() === resourceGroup.name.toLowerCase()) {
				let virtualMachineValue: azdata.CategoryValue;
				if (virtualMachine.properties.provisioningState === 'Succeeded') {
					virtualMachineValue = {
						name: virtualMachine.id,
						displayName: virtualMachine.name
					};
				} else {
					virtualMachineValue = {
						name: virtualMachine.id,
						displayName: constants.UNAVAILABLE_TARGET_PREFIX(virtualMachine.name)
					};
				}
				virtualMachineValues.push(virtualMachineValue);
			}
		});
	}

	if (virtualMachineValues.length === 0) {
		virtualMachineValues = [
			{
				displayName: constants.NO_VIRTUAL_MACHINE_FOUND,
				name: ''
			}
		];
	}
	return virtualMachineValues;
}

export async function getStorageAccounts(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription): Promise<StorageAccount[]> {
	let storageAccounts: StorageAccount[] = [];
	try {
		if (account && subscription) {
			storageAccounts = await getAvailableStorageAccounts(account, subscription);
		}
	} catch (e) {
		console.log(e);
		storageAccounts = [];
	}
	storageAccounts.sort((a, b) => a.name.localeCompare(b.name));
	return storageAccounts;
}

export async function getStorageAccountsDropdownValues(storageAccounts: StorageAccount[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {
	let storageAccountValues: azdata.CategoryValue[] = [];
	storageAccounts.forEach((storageAccount) => {
		if (storageAccount.location.toLowerCase() === location.name.toLowerCase() && storageAccount.resourceGroup?.toLowerCase() === resourceGroup.name.toLowerCase()) {
			storageAccountValues.push({
				name: storageAccount.id,
				displayName: storageAccount.name
			});
		}
	});

	if (storageAccountValues.length === 0) {
		storageAccountValues = [
			{
				displayName: constants.NO_STORAGE_ACCOUNT_FOUND,
				name: ''
			}
		];
	}
	return storageAccountValues;
}

export async function getAzureSqlMigrationServices(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription): Promise<SqlMigrationService[]> {
	let sqlMigrationServices: SqlMigrationService[] = [];
	try {
		if (account && subscription) {
			sqlMigrationServices = (await getSqlMigrationServices(account, subscription)).filter(dms => {
				return dms.properties.provisioningState === 'Succeeded';
			});
		}
	} catch (e) {
		console.log(e);
		sqlMigrationServices = [];
	}
	sqlMigrationServices.sort((a, b) => a.name.localeCompare(b.name));
	return sqlMigrationServices;
}

export async function getAzureSqlMigrationServicesDropdownValues(sqlMigrationServices: SqlMigrationService[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {
	let SqlMigrationServicesValues: azdata.CategoryValue[] = [];
	if (location && resourceGroup) {
		sqlMigrationServices.forEach((sqlMigrationService) => {
			if (sqlMigrationService.location.toLowerCase() === location.name.toLowerCase() && sqlMigrationService.properties.resourceGroup.toLowerCase() === resourceGroup.name.toLowerCase()) {
				SqlMigrationServicesValues.push({
					name: sqlMigrationService.id,
					displayName: sqlMigrationService.name
				});
			}
		});
	}

	if (SqlMigrationServicesValues.length === 0) {
		SqlMigrationServicesValues = [
			{
				displayName: constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR,
				name: ''
			}
		];
	}
	return SqlMigrationServicesValues;
}

export async function getFileShare(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, storageAccount?: StorageAccount): Promise<azureResource.FileShare[]> {
	let fileShares: azureResource.FileShare[] = [];
	try {
		if (account && subscription && storageAccount) {
			fileShares = await getFileShares(account, subscription, storageAccount);
		}
	} catch (e) {
		console.log(e);
		fileShares = [];
	}
	fileShares.sort((a, b) => a.name.localeCompare(b.name));
	return fileShares;
}

export async function getFileSharesValues(fileShares: azureResource.FileShare[]): Promise<azdata.CategoryValue[]> {
	let fileSharesValues: azdata.CategoryValue[] = [];
	fileShares.forEach((fileShare) => {
		fileSharesValues.push({
			name: fileShare.id,
			displayName: fileShare.name
		});
	});
	if (fileSharesValues.length === 0) {
		fileSharesValues = [
			{
				displayName: constants.NO_FILESHARES_FOUND,
				name: ''
			}
		];
	}
	return fileSharesValues;
}

export async function getBlobContainer(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, storageAccount?: StorageAccount): Promise<azureResource.BlobContainer[]> {
	let blobContainers: azureResource.BlobContainer[] = [];
	try {
		if (account && subscription && storageAccount) {
			blobContainers = await getBlobContainers(account, subscription, storageAccount);
		}
	} catch (e) {
		console.log(e);
		blobContainers = [];
	}
	blobContainers.sort((a, b) => a.name.localeCompare(b.name));
	return blobContainers;
}

export async function getBlobContainersValues(blobContainers: azureResource.BlobContainer[]): Promise<azdata.CategoryValue[]> {
	let blobContainersValues: azdata.CategoryValue[] = [];
	blobContainers.forEach((blobContainer) => {
		blobContainersValues.push({
			name: blobContainer.id,
			displayName: blobContainer.name
		});
	});
	if (blobContainersValues.length === 0) {
		blobContainersValues = [
			{
				displayName: constants.NO_BLOBCONTAINERS_FOUND,
				name: ''
			}
		];
	}
	return blobContainersValues;
}

export async function getBlobLastBackupFileNames(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, storageAccount?: StorageAccount, blobContainer?: azureResource.BlobContainer): Promise<azureResource.Blob[]> {
	let lastFileNames: azureResource.Blob[] = [];
	try {
		if (account && subscription && storageAccount && blobContainer) {
			lastFileNames = await getBlobs(account, subscription, storageAccount, blobContainer.name);
		}
	} catch (e) {
		console.log(e);
		lastFileNames = [];
	}
	lastFileNames.sort((a, b) => a.name.localeCompare(b.name));
	return lastFileNames;
}

export async function getBlobLastBackupFileNamesValues(lastFileNames: azureResource.Blob[]): Promise<azdata.CategoryValue[]> {
	let lastFileNamesValues: azdata.CategoryValue[] = [];
	lastFileNames.forEach((lastFileName) => {
		lastFileNamesValues.push({
			name: lastFileName.name,
			displayName: lastFileName.name
		});
	});
	if (lastFileNamesValues.length === 0) {
		lastFileNamesValues = [
			{
				displayName: constants.NO_BLOBFILES_FOUND,
				name: ''
			}
		];
	}
	return lastFileNamesValues;
}
