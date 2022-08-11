/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, Account, accounts, CategoryValue, DropDownComponent, IconPath } from 'azdata';
import { IconPathHelper } from '../constants/iconPathHelper';
import { MigrationStatus, ProvisioningState } from '../models/migrationLocalStorage';
import * as crypto from 'crypto';
import * as azure from './azure';
import { azureResource, Tenant } from 'azurecore';
import * as constants from '../constants/strings';
import { logError, TelemetryViews } from '../telemtery';
import { AdsMigrationStatus } from '../dashboard/tabBase';
import { getMigrationMode, getMigrationStatus, getMigrationTargetType, PipelineStatusCodes } from '../constants/helper';

export const DefaultSettingValue = '---';

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

export function getMigrationTime(migrationTime: string): string {
	return migrationTime
		? new Date(migrationTime).toLocaleString()
		: DefaultSettingValue;
}

export function getMigrationDuration(startDate: string, endDate: string): string {
	if (startDate) {
		if (endDate) {
			return convertTimeDifferenceToDuration(
				new Date(startDate),
				new Date(endDate));
		} else {
			return convertTimeDifferenceToDuration(
				new Date(startDate),
				new Date());
		}
	}

	return DefaultSettingValue;
}

export function filterMigrations(databaseMigrations: azure.DatabaseMigration[], statusFilter: string, columnTextFilter?: string): azure.DatabaseMigration[] {
	let filteredMigration: azure.DatabaseMigration[] = databaseMigrations || [];
	if (columnTextFilter) {
		const filter = columnTextFilter.toLowerCase();
		filteredMigration = filteredMigration.filter(
			migration => migration.properties.sourceServerName?.toLowerCase().includes(filter)
				|| migration.properties.sourceDatabaseName?.toLowerCase().includes(filter)
				|| getMigrationStatus(migration)?.toLowerCase().includes(filter)
				|| getMigrationMode(migration)?.toLowerCase().includes(filter)
				|| getMigrationTargetType(migration)?.toLowerCase().includes(filter)
				|| azure.getResourceName(migration.properties.scope)?.toLowerCase().includes(filter)
				|| azure.getResourceName(migration.id)?.toLowerCase().includes(filter)
				|| getMigrationDuration(
					migration.properties.startedOn,
					migration.properties.endedOn)?.toLowerCase().includes(filter)
				|| getMigrationTime(migration.properties.startedOn)?.toLowerCase().includes(filter)
				|| getMigrationTime(migration.properties.endedOn)?.toLowerCase().includes(filter)
				|| getMigrationMode(migration)?.toLowerCase().includes(filter));
	}

	switch (statusFilter) {
		case AdsMigrationStatus.ALL:
			return filteredMigration;
		case AdsMigrationStatus.ONGOING:
			return filteredMigration.filter(
				value => {
					const status = getMigrationStatus(value);
					return status === MigrationStatus.InProgress
						|| status === MigrationStatus.Retriable
						|| status === MigrationStatus.Creating;
				});
		case AdsMigrationStatus.SUCCEEDED:
			return filteredMigration.filter(
				value => getMigrationStatus(value) === MigrationStatus.Succeeded);
		case AdsMigrationStatus.FAILED:
			return filteredMigration.filter(
				value => getMigrationStatus(value) === MigrationStatus.Failed);
		case AdsMigrationStatus.COMPLETING:
			return filteredMigration.filter(
				value => getMigrationStatus(value) === MigrationStatus.Completing);
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

export function selectDefaultDropdownValue(dropDown: DropDownComponent, value?: string, useDisplayName: boolean = true): void {
	if (dropDown.values && dropDown.values.length > 0) {
		let selectedIndex;
		if (value) {
			if (useDisplayName) {
				selectedIndex = dropDown.values.findIndex((v: any) => (v as CategoryValue)?.displayName?.toLowerCase() === value.toLowerCase());
			} else {
				selectedIndex = dropDown.values.findIndex((v: any) => (v as CategoryValue)?.name?.toLowerCase() === value.toLowerCase());
			}
		} else {
			selectedIndex = -1;
		}
		selectDropDownIndex(dropDown, selectedIndex > -1 ? selectedIndex : 0);
	}
}

export function selectDropDownIndex(dropDown: DropDownComponent, index: number): void {
	if (dropDown.values && dropDown.values.length > 0) {
		if (index >= 0 && index <= dropDown.values.length - 1) {
			dropDown.value = dropDown.values[index] as CategoryValue;
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
	return { 'SqlMigrationSessionId': sessionId };
}

export function getMigrationStatusWithErrors(migration: azure.DatabaseMigration): string {
	const properties = migration.properties;
	const migrationStatus = properties.migrationStatus ?? properties.provisioningState;
	let warningCount = 0;

	if (properties.migrationFailureError?.message) {
		warningCount++;
	}
	if (properties.migrationStatusDetails?.fileUploadBlockingErrors) {
		const blockingErrors = properties.migrationStatusDetails?.fileUploadBlockingErrors.length ?? 0;
		warningCount += blockingErrors;
	}
	if (properties.migrationStatusDetails?.restoreBlockingReason) {
		warningCount++;
	}

	return constants.STATUS_VALUE(migrationStatus, warningCount)
		+ (constants.STATUS_WARNING_COUNT(migrationStatus, warningCount) ?? '');
}

export function getPipelineStatusImage(status: string | undefined): IconPath {
	// status codes: 'PreparingForCopy' | 'Copying' | 'CopyFinished' | 'RebuildingIndexes' | 'Succeeded' | 'Failed' |	'Canceled',
	switch (status) {
		case PipelineStatusCodes.Copying:				// Copying: 'Copying',
			return IconPathHelper.copy;
		case PipelineStatusCodes.CopyFinished:			// CopyFinished: 'CopyFinished',
		case PipelineStatusCodes.RebuildingIndexes:		// RebuildingIndexes: 'RebuildingIndexes',
			return IconPathHelper.inProgressMigration;
		case PipelineStatusCodes.Canceled:				// Canceled: 'Canceled',
			return IconPathHelper.cancel;
		case PipelineStatusCodes.PreparingForCopy:		// PreparingForCopy: 'PreparingForCopy',
			return IconPathHelper.notStartedMigration;
		case PipelineStatusCodes.Failed:				// Failed: 'Failed',
			return IconPathHelper.error;
		case PipelineStatusCodes.Succeeded:				// Succeeded: 'Succeeded',
			return IconPathHelper.completedMigration;

		// legacy status codes:  Queued: 'Queued', InProgress: 'InProgress',Cancelled: 'Cancelled',
		case PipelineStatusCodes.Queued:
			return IconPathHelper.notStartedMigration;
		case PipelineStatusCodes.InProgress:
			return IconPathHelper.inProgressMigration;
		case PipelineStatusCodes.Cancelled:
			return IconPathHelper.cancel;
		// default:
		default:
			return IconPathHelper.error;
	}
}

export function getMigrationStatusImage(migration: azure.DatabaseMigration): IconPath {
	const status = getMigrationStatus(migration);
	switch (status) {
		case MigrationStatus.InProgress:
			return IconPathHelper.inProgressMigration;
		case MigrationStatus.Succeeded:
			return IconPathHelper.completedMigration;
		case MigrationStatus.Creating:
			return IconPathHelper.notStartedMigration;
		case MigrationStatus.Completing:
			return IconPathHelper.completingCutover;
		case MigrationStatus.Retriable:
			return IconPathHelper.retry;
		case MigrationStatus.Canceling:
		case MigrationStatus.Canceled:
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

export function displayDialogErrorMessage(dialog: window.Dialog, text: string, error: Error): void {
	dialog.message = {
		level: window.MessageLevel.Error,
		text: text,
		description: error.message,
	};
}

export function clearDialogMessage(dialog: window.Dialog): void {
	dialog.message = {
		text: ''
	};
}

export function getUserHome(): string | undefined {
	return process.env.HOME || process.env.USERPROFILE;
}

export async function getAzureAccounts(): Promise<Account[]> {
	let azureAccounts: Account[] = [];
	try {
		azureAccounts = await accounts.getAllAccounts();
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAzureAccounts', e);
	}
	return azureAccounts;
}

export async function getAzureAccountsDropdownValues(accounts: Account[]): Promise<CategoryValue[]> {
	let accountsValues: CategoryValue[] = [];
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
				displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,
				name: ''
			}
		];
	}
	return accountsValues;
}

export function getAzureTenants(account?: Account): Tenant[] {
	let tenants: Tenant[] = [];
	try {
		if (account) {
			tenants = account.properties.tenants;
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAzureTenants', e);
	}
	return tenants;
}

export async function getAzureTenantsDropdownValues(tenants: Tenant[]): Promise<CategoryValue[]> {
	let tenantsValues: CategoryValue[] = [];
	tenants.forEach((tenant) => {
		tenantsValues.push({
			name: tenant.id,
			displayName: tenant.displayName
		});
	});
	if (tenantsValues.length === 0) {
		tenantsValues = [
			{
				displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,
				name: ''
			}
		];
	}
	return tenantsValues;
}

export async function getAzureSubscriptions(account?: Account): Promise<azureResource.AzureResourceSubscription[]> {
	let subscriptions: azureResource.AzureResourceSubscription[] = [];
	try {
		if (account) {
			subscriptions = !account.isStale ? await azure.getSubscriptions(account) : [];
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAzureSubscriptions', e);
	}
	subscriptions.sort((a, b) => a.name.localeCompare(b.name));
	return subscriptions;
}

export async function getAzureSubscriptionsDropdownValues(subscriptions: azureResource.AzureResourceSubscription[]): Promise<CategoryValue[]> {
	let subscriptionsValues: CategoryValue[] = [];
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

export async function getSqlManagedInstanceLocations(account?: Account, subscription?: azureResource.AzureResourceSubscription, managedInstances?: azureResource.AzureSqlManagedInstance[]): Promise<azureResource.AzureLocation[]> {
	let locations: azureResource.AzureLocation[] = [];
	try {
		if (account && subscription && managedInstances) {
			locations = await azure.getLocations(account, subscription);
			locations = locations.filter((loc, i) => managedInstances.some(mi => mi.location.toLowerCase() === loc.name.toLowerCase()));
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getSqlManagedInstanceLocations', e);
	}
	locations.sort((a, b) => a.displayName.localeCompare(b.displayName));
	return locations;
}

export async function getSqlVirtualMachineLocations(account?: Account, subscription?: azureResource.AzureResourceSubscription, virtualMachines?: azure.SqlVMServer[]): Promise<azureResource.AzureLocation[]> {
	let locations: azureResource.AzureLocation[] = [];
	try {
		if (account && subscription && virtualMachines) {
			locations = await azure.getLocations(account, subscription);
			locations = locations.filter((loc, i) => virtualMachines.some(vm => vm.location.toLowerCase() === loc.name.toLowerCase()));
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getSqlVirtualMachineLocations', e);
	}
	locations.sort((a, b) => a.displayName.localeCompare(b.displayName));
	return locations;
}

export async function getSqlMigrationServiceLocations(account?: Account, subscription?: azureResource.AzureResourceSubscription, migrationServices?: azure.SqlMigrationService[]): Promise<azureResource.AzureLocation[]> {
	let locations: azureResource.AzureLocation[] = [];
	try {
		if (account && subscription && migrationServices) {
			locations = await azure.getLocations(account, subscription);
			locations = locations.filter((loc, i) => migrationServices.some(dms => dms.location.toLowerCase() === loc.name.toLowerCase()));
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getSqlMigrationServiceLocations', e);
	}
	locations.sort((a, b) => a.displayName.localeCompare(b.displayName));
	return locations;
}

export async function getAzureLocationsDropdownValues(locations: azureResource.AzureLocation[]): Promise<CategoryValue[]> {
	let locationValues: CategoryValue[] = [];
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

export async function getSqlManagedInstanceResourceGroups(managedInstances?: azureResource.AzureSqlManagedInstance[], location?: azureResource.AzureLocation): Promise<azureResource.AzureResourceResourceGroup[]> {
	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	try {
		if (managedInstances && location) {
			resourceGroups = managedInstances
				.filter((mi) => mi.location.toLowerCase() === location.name.toLowerCase())
				.map((mi) => {
					return <azureResource.AzureResourceResourceGroup>{
						id: azure.getFullResourceGroupFromId(mi.id),
						name: azure.getResourceGroupFromId(mi.id),
						subscription: {
							id: mi.subscriptionId
						},
						tenant: mi.tenantId
					};
				});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getSqlManagedInstanceResourceGroups', e);
	}

	// remove duplicates
	resourceGroups = resourceGroups.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);
	resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroups;
}

export async function getSqlVirtualMachineResourceGroups(virtualMachines?: azure.SqlVMServer[], location?: azureResource.AzureLocation): Promise<azureResource.AzureResourceResourceGroup[]> {
	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	try {
		if (virtualMachines && location) {
			resourceGroups = virtualMachines
				.filter((vm) => vm.location.toLowerCase() === location.name.toLowerCase())
				.map((vm) => {
					return <azureResource.AzureResourceResourceGroup>{
						id: azure.getFullResourceGroupFromId(vm.id),
						name: azure.getResourceGroupFromId(vm.id),
						subscription: {
							id: vm.subscriptionId
						},
						tenant: vm.tenantId
					};
				});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getSqlVirtualMachineResourceGroups', e);
	}

	// remove duplicates
	resourceGroups = resourceGroups.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);
	resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroups;
}

export async function getStorageAccountResourceGroups(storageAccounts?: azure.StorageAccount[], location?: azureResource.AzureLocation): Promise<azureResource.AzureResourceResourceGroup[]> {
	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	try {
		if (storageAccounts && location) {
			resourceGroups = storageAccounts
				.filter((sa) => sa.location.toLowerCase() === location.name.toLowerCase())
				.map((sa) => {
					return <azureResource.AzureResourceResourceGroup>{
						id: azure.getFullResourceGroupFromId(sa.id),
						name: azure.getResourceGroupFromId(sa.id),
						subscription: {
							id: sa.subscriptionId
						},
						tenant: sa.tenantId
					};
				});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getStorageAccountResourceGroups', e);
	}

	// remove duplicates
	resourceGroups = resourceGroups.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);
	resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroups;
}

export async function getSqlMigrationServiceResourceGroups(migrationServices?: azure.SqlMigrationService[], location?: azureResource.AzureLocation): Promise<azureResource.AzureResourceResourceGroup[]> {
	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	try {
		if (migrationServices && location) {
			resourceGroups = migrationServices
				.filter((dms) => dms.properties.provisioningState === ProvisioningState.Succeeded && dms.location.toLowerCase() === location.name.toLowerCase())
				.map((dms) => {
					return <azureResource.AzureResourceResourceGroup>{
						id: azure.getFullResourceGroupFromId(dms.id),
						name: azure.getResourceGroupFromId(dms.id),
						subscription: {
							id: dms.properties.subscriptionId
						},
					};
				});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getSqlMigrationServiceResourceGroups', e);
	}

	// remove duplicates
	resourceGroups = resourceGroups.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);
	resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroups;
}

export async function getAllResourceGroups(account?: Account, subscription?: azureResource.AzureResourceSubscription): Promise<azureResource.AzureResourceResourceGroup[]> {
	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	try {
		if (account && subscription) {
			resourceGroups = await azure.getResourceGroups(account, subscription);
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAllResourceGroups', e);
	}
	resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroups;
}

export async function getAzureResourceGroupsDropdownValues(resourceGroups: azureResource.AzureResourceResourceGroup[]): Promise<CategoryValue[]> {
	let resourceGroupValues: CategoryValue[] = [];
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

export async function getManagedInstances(account?: Account, subscription?: azureResource.AzureResourceSubscription): Promise<azureResource.AzureSqlManagedInstance[]> {
	let managedInstances: azureResource.AzureSqlManagedInstance[] = [];
	try {
		if (account && subscription) {
			managedInstances = await azure.getAvailableManagedInstanceProducts(account, subscription);
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getManagedInstances', e);
	}
	managedInstances.sort((a, b) => a.name.localeCompare(b.name));
	return managedInstances;
}

export async function getManagedInstancesDropdownValues(managedInstances: azureResource.AzureSqlManagedInstance[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<CategoryValue[]> {
	let managedInstancesValues: CategoryValue[] = [];
	if (location && resourceGroup) {
		managedInstances.forEach((managedInstance) => {
			if (managedInstance.location.toLowerCase() === location.name.toLowerCase() && managedInstance.resourceGroup?.toLowerCase() === resourceGroup.name.toLowerCase()) {
				let managedInstanceValue: CategoryValue;
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

export async function getVirtualMachines(account?: Account, subscription?: azureResource.AzureResourceSubscription): Promise<azure.SqlVMServer[]> {
	let virtualMachines: azure.SqlVMServer[] = [];
	try {
		if (account && subscription) {
			virtualMachines = (await azure.getAvailableSqlVMs(account, subscription)).filter((virtualMachine) => {
				if (virtualMachine.properties.sqlImageOffer) {
					return virtualMachine.properties.sqlImageOffer.toLowerCase().includes('-ws'); //filtering out all non windows sql vms.
				}
				return true; // Returning all VMs that don't have this property as we don't want to accidentally skip valid vms.
			});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getVirtualMachines', e);
	}
	virtualMachines.sort((a, b) => a.name.localeCompare(b.name));
	return virtualMachines;
}

export async function getVirtualMachinesDropdownValues(virtualMachines: azure.SqlVMServer[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<CategoryValue[]> {
	let virtualMachineValues: CategoryValue[] = [];
	if (location && resourceGroup) {
		virtualMachines.forEach((virtualMachine) => {
			if (virtualMachine.location.toLowerCase() === location.name.toLowerCase() && azure.getResourceGroupFromId(virtualMachine.id).toLowerCase() === resourceGroup.name.toLowerCase()) {
				virtualMachineValues.push({
					name: virtualMachine.id,
					displayName: virtualMachine.name
				});
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

export async function getStorageAccounts(account?: Account, subscription?: azureResource.AzureResourceSubscription): Promise<azure.StorageAccount[]> {
	let storageAccounts: azure.StorageAccount[] = [];
	try {
		if (account && subscription) {
			storageAccounts = await azure.getAvailableStorageAccounts(account, subscription);
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getStorageAccounts', e);
	}
	storageAccounts.sort((a, b) => a.name.localeCompare(b.name));
	return storageAccounts;
}

export async function getStorageAccountsDropdownValues(storageAccounts: azure.StorageAccount[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<CategoryValue[]> {
	let storageAccountValues: CategoryValue[] = [];
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

export async function getAzureSqlMigrationServices(account?: Account, subscription?: azureResource.AzureResourceSubscription): Promise<azure.SqlMigrationService[]> {
	let sqlMigrationServices: azure.SqlMigrationService[] = [];
	try {
		if (account && subscription) {
			sqlMigrationServices = (await azure.getSqlMigrationServices(account, subscription)).filter(dms => {
				return dms.properties.provisioningState === ProvisioningState.Succeeded;
			});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAzureSqlMigrationServices', e);
	}
	sqlMigrationServices.sort((a, b) => a.name.localeCompare(b.name));
	return sqlMigrationServices;
}

export async function getAzureSqlMigrationServicesDropdownValues(sqlMigrationServices: azure.SqlMigrationService[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<CategoryValue[]> {
	let SqlMigrationServicesValues: CategoryValue[] = [];
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

export async function getBlobContainer(account?: Account, subscription?: azureResource.AzureResourceSubscription, storageAccount?: azure.StorageAccount): Promise<azureResource.BlobContainer[]> {
	let blobContainers: azureResource.BlobContainer[] = [];
	try {
		if (account && subscription && storageAccount) {
			blobContainers = await azure.getBlobContainers(account, subscription, storageAccount);
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getBlobContainer', e);
	}
	blobContainers.sort((a, b) => a.name.localeCompare(b.name));
	return blobContainers;
}

export async function getBlobContainersValues(blobContainers: azureResource.BlobContainer[]): Promise<CategoryValue[]> {
	let blobContainersValues: CategoryValue[] = [];
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

export async function getBlobLastBackupFileNames(account?: Account, subscription?: azureResource.AzureResourceSubscription, storageAccount?: azure.StorageAccount, blobContainer?: azureResource.BlobContainer): Promise<azureResource.Blob[]> {
	let lastFileNames: azureResource.Blob[] = [];
	try {
		if (account && subscription && storageAccount && blobContainer) {
			lastFileNames = await azure.getBlobs(account, subscription, storageAccount, blobContainer.name);
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getBlobLastBackupFileNames', e);
	}
	lastFileNames.sort((a, b) => a.name.localeCompare(b.name));
	return lastFileNames;
}

export async function getBlobLastBackupFileNamesValues(lastFileNames: azureResource.Blob[]): Promise<CategoryValue[]> {
	let lastFileNamesValues: CategoryValue[] = [];
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
