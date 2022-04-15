/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { window, CategoryValue, DropDownComponent, IconPath } from 'azdata';
import { IconPathHelper } from '../constants/iconPathHelper';
import { DAYS, HRS, MINUTE, SEC } from '../constants/strings';
import { AdsMigrationStatus } from '../dialog/migrationStatus/migrationStatusDialogModel';
import { MigrationStatus, ProvisioningState } from '../models/migrationLocalStorage';
import * as crypto from 'crypto';
import { DatabaseMigration, getAvailableManagedInstanceProducts, getAvailableSqlVMs, getAvailableStorageAccounts, getFullResourceGroupFromId, getLocations, getResourceGroupFromId, getResourceGroups, getSqlMigrationServices, getSubscriptions } from './azure';
import { azureResource } from 'azureResource';
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
		return SEC(parseFloat(seconds));
	}
	else if (time / (1000 * 60) < 60) {
		return MINUTE(parseFloat(minutes));
	}
	else if (time / (1000 * 60 * 60) < 24) {
		return HRS(parseFloat(hours));
	}
	else {
		return DAYS(parseFloat(days));
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

export function selectDefaultDropdownValue(dropDown: DropDownComponent, value?: string, useDisplayName: boolean = true): void {
	if (dropDown.values && dropDown.values.length > 0) {
		const selectedIndex = value ? findDropDownItemIndex(dropDown, value, useDisplayName) : -1;
		if (selectedIndex > -1) {
			selectDropDownIndex(dropDown, selectedIndex);
		} else {
			selectDropDownIndex(dropDown, 0);
		}
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

export function findDropDownItemIndex(dropDown: DropDownComponent, value: string, useDisplayName: boolean = true): number {
	if (value && dropDown.values && dropDown.values.length > 0) {
		const searachValue = value?.toLowerCase();
		return useDisplayName
			? dropDown.values.findIndex((v: any) =>
				(v as CategoryValue)?.displayName?.toLowerCase() === searachValue)
			: dropDown.values.findIndex((v: any) =>
				(v as CategoryValue)?.name?.toLowerCase() === searachValue);
	}
	return -1;
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

export function getMigrationStatusImage(status: string): IconPath {
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






//
export async function getSubscriptionsDropdownValues(account?: azdata.Account): Promise<azdata.CategoryValue[]> {
	let subscriptionsValues: azdata.CategoryValue[] = [];
	try {
		let subscriptions: azureResource.AzureResourceSubscription[] = [];
		if (account) {
			subscriptions = !account.isStale ? await getSubscriptions(account) : [];
		}

		subscriptions.forEach((subscription) => {
			subscriptionsValues.push({
				name: subscription.id,
				displayName: `${subscription.name} - ${subscription.id}`
			});
		});

		if (subscriptionsValues.length === 0) {
			subscriptionsValues = [
				{
					displayName: constants.NO_SUBSCRIPTIONS_FOUND,	//
					name: ''
				}
			];
		}
	} catch (e) {
		console.log(e);
		subscriptionsValues = [
			{
				displayName: constants.NO_SUBSCRIPTIONS_FOUND,
				name: ''
			}
		];
	}

	subscriptionsValues.sort((a, b) => a.displayName.localeCompare(b.displayName));
	return subscriptionsValues;
}
export async function getAzureLocationDropdownValues(resourceType: string, account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription): Promise<azdata.CategoryValue[]> {
	let locationValues: azdata.CategoryValue[] = [];
	try {
		let locations: azureResource.AzureLocation[] = [];
		if (account && subscription) {
			locations = await getLocations(account, subscription);

			// only show locations that contain resources of the desired type
			switch (resourceType) {
				case 'mi':
					let managedInstances = await getAvailableManagedInstanceProducts(account, subscription) || [];
					locations = locations.filter(
						(loc, i) => managedInstances.some(mi => mi.location === loc.name));
					break;
				case 'vm':
					let virtualMachines = await getAvailableSqlVMs(account, subscription) || [];
					locations = locations.filter(
						(loc, i) => virtualMachines.some(vm => vm.location === loc.name));
					break;
				case 'storage':
					let storageAccounts = await getAvailableStorageAccounts(account, subscription) || [];
					locations = locations.filter(
						(loc, i) => storageAccounts.some(sa => sa.location === loc.name));
					break;
				case 'dms':
					let sqlMigrationServices = await getSqlMigrationServices(account, subscription) || [];
					locations = locations.filter(
						(loc, i) => sqlMigrationServices.some(dms => dms.location === loc.name));
					break;
				default:
					break;
			}
		}

		locations.forEach((loc) => {
			locationValues.push({
				name: loc.name,
				displayName: loc.displayName
			});
		});

		if (locationValues.length === 0) {
			locationValues = [
				{
					displayName: constants.NO_LOCATION_FOUND,	//
					name: ''
				}
			];
		}
	} catch (e) {
		console.log(e);
		locationValues = [
			{
				displayName: constants.NO_LOCATION_FOUND,
				name: ''
			}
		];
	}

	locationValues.sort((a, b) => a.name.localeCompare(b.name));
	return locationValues;
}

//
export async function getAzureResourceGroupDropdownValues(resourceType: string, location: string, account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription): Promise<azdata.CategoryValue[]> {
	let resourceGroupValues: azdata.CategoryValue[] = [];
	try {
		let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
		if (account && subscription) {
			resourceGroups = await getResourceGroups(account, subscription);

			// only show resource groups that contain resources of the desired type in the desired location
			switch (resourceType) {
				case 'mi':
					let managedInstances = await getAvailableManagedInstanceProducts(account, subscription);
					resourceGroups = managedInstances
						.filter((mi) => mi.location === location)
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
				case 'vm':
					let virtualMachines = await getAvailableSqlVMs(account, subscription);
					resourceGroups = virtualMachines
						.filter((vm) => vm.location === location)
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
				case 'storage':
					let storageAccounts = await getAvailableStorageAccounts(account, subscription);
					resourceGroups = storageAccounts
						.filter((sa) => sa.location === location)
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
				case 'dms':
					let dmsInstances = await getSqlMigrationServices(account, subscription);
					resourceGroups = dmsInstances
						.filter((dms) => dms.location === location)
						.map((dms) => {
							return <azureResource.AzureResourceResourceGroup>{
								id: getFullResourceGroupFromId(dms.id),
								name: getResourceGroupFromId(dms.id),
								subscription: {
									id: dms.properties.subscriptionId
								},
								// tenant: ?
							};
						});
					break;
				default:
					break;
			}

			// remove duplicates
			resourceGroups = resourceGroups.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);
		}

		resourceGroups.forEach((rg) => {
			resourceGroupValues.push({
				name: rg.id,
				displayName: rg.name
			});
		});
		if (resourceGroupValues.length === 0) {
			resourceGroupValues = [
				{
					displayName: constants.RESOURCE_GROUP_NOT_FOUND,	//
					name: ''
				}
			];
		}
	} catch (e) {
		console.log(e);
		resourceGroupValues = [
			{
				displayName: constants.RESOURCE_GROUP_NOT_FOUND,
				name: ''
			}
		];
	}

	resourceGroupValues.sort((a, b) => a.name.localeCompare(b.name));
	return resourceGroupValues;
}
