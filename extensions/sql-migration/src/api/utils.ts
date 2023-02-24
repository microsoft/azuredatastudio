/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, Account, accounts, CategoryValue, DropDownComponent, IconPath, DisplayType, Component } from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import * as crypto from 'crypto';
import * as azure from './azure';
import { azureResource, Tenant } from 'azurecore';
import * as constants from '../constants/strings';
import { logError, TelemetryViews } from '../telemtery';
import { AdsMigrationStatus } from '../dashboard/tabBase';
import { getMigrationMode, getMigrationStatus, getMigrationTargetType, hasRestoreBlockingReason, PipelineStatusCodes } from '../constants/helper';

export type TargetServerType = azure.SqlVMServer | azureResource.AzureSqlManagedInstance | azure.AzureSqlDatabaseServer;

export const SqlMigrationExtensionId = 'microsoft.sql-migration';
export const DefaultSettingValue = '---';

export const MenuCommands = {
	Cutover: 'sqlmigration.cutover',
	ViewDatabase: 'sqlmigration.view.database',
	ViewTarget: 'sqlmigration.view.target',
	ViewService: 'sqlmigration.view.service',
	CopyMigration: 'sqlmigration.copy.migration',
	CancelMigration: 'sqlmigration.cancel.migration',
	RetryMigration: 'sqlmigration.retry.migration',
	StartMigration: 'sqlmigration.start',
	StartLoginMigration: 'sqlmigration.login.start',
	IssueReporter: 'workbench.action.openIssueReporter',
	OpenNotebooks: 'sqlmigration.openNotebooks',
	NewSupportRequest: 'sqlmigration.newsupportrequest',
	SendFeedback: 'sqlmigration.sendfeedback',
};

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

export function isTargetSqlVm2014OrBelow(sqlVm: azure.SqlVMServer): boolean {
	// e.g. SQL2008-WS2012, SQL2008R2-WS2019, SQL2012-WS2016, SQL2014-WS2012R2, SQL2016-WS2019, SQL2017-WS2019, SQL2019-WS2022
	const sqlImageOffer = sqlVm.properties.sqlImageOffer;

	// parse image offer and extract SQL version (assuming it is a valid image offer)
	if (sqlImageOffer && sqlImageOffer.toUpperCase().startsWith('SQL')) {
		const version = parseInt(sqlImageOffer.substring(3, 7));
		return version <= 2014;
	}

	return false;
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
					return status === constants.MigrationState.InProgress
						|| status === constants.MigrationState.ReadyForCutover
						|| status === constants.MigrationState.UploadingFullBackup
						|| status === constants.MigrationState.UploadingLogBackup
						|| status === constants.MigrationState.Restoring
						|| status === constants.MigrationState.Retriable
						|| status === constants.MigrationState.Creating;
				});
		case AdsMigrationStatus.SUCCEEDED:
			return filteredMigration.filter(
				value => getMigrationStatus(value) === constants.MigrationState.Succeeded);
		case AdsMigrationStatus.FAILED:
			return filteredMigration.filter(
				value => getMigrationStatus(value) === constants.MigrationState.Failed);
		case AdsMigrationStatus.COMPLETING:
			return filteredMigration.filter(
				value => getMigrationStatus(value) === constants.MigrationState.Completing);
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
			const searchValue = value.toLowerCase();
			if (useDisplayName) {
				selectedIndex = dropDown.values.findIndex((v: any) => (v as CategoryValue)?.displayName?.toLowerCase() === searchValue);
			} else {
				selectedIndex = dropDown.values.findIndex((v: any) => (v as CategoryValue)?.name?.toLowerCase() === searchValue);
			}
		} else {
			selectedIndex = -1;
		}
		selectDropDownIndex(dropDown, selectedIndex > -1 ? selectedIndex : 0);
	} else {
		dropDown.value = undefined;
	}
}

export function selectDropDownIndex(dropDown: DropDownComponent, index: number): void {
	if (dropDown.values && dropDown.values.length > 0) {
		if (index >= 0 && index < dropDown.values.length) {
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
	const migrationStatus = getMigrationStatus(migration) ?? '';

	// provisioning error
	let warningCount = properties.provisioningError?.length > 0 ? 1 : 0;

	// migration failure error
	warningCount += properties.migrationFailureError?.message?.length > 0 ? 1 : 0;

	// file upload blocking errors
	warningCount += properties.migrationStatusWarnings?.fileUploadBlockingErrorCount ?? 0;

	// restore blocking reason
	warningCount += hasRestoreBlockingReason(migration) ? 1 : 0;

	// complete restore error message
	warningCount += (properties.migrationStatusWarnings?.completeRestoreErrorMessage ?? '').length > 0 ? 1 : 0;

	return constants.STATUS_VALUE(migrationStatus) + (constants.STATUS_WARNING_COUNT(migrationStatus, warningCount) ?? '');
}

export function getLoginStatusMessage(loginFound: boolean): string {
	if (loginFound) {
		return constants.LOGINS_FOUND;
	} else {
		return constants.LOGINS_NOT_FOUND;
	}
}

export function getLoginStatusImage(loginFound: boolean): IconPath {
	if (loginFound) {
		return IconPathHelper.completedMigration;
	} else {
		return IconPathHelper.notFound;
	}
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
		case constants.MigrationState.InProgress:
		case constants.MigrationState.UploadingFullBackup:
		case constants.MigrationState.UploadingLogBackup:
		case constants.MigrationState.Restoring:
			return IconPathHelper.inProgressMigration;
		case constants.MigrationState.ReadyForCutover:
			return IconPathHelper.cutover;
		case constants.MigrationState.Succeeded:
			return IconPathHelper.completedMigration;
		case constants.MigrationState.Creating:
			return IconPathHelper.notStartedMigration;
		case constants.MigrationState.Completing:
			return IconPathHelper.completingCutover;
		case constants.MigrationState.Retriable:
			return IconPathHelper.retry;
		case constants.MigrationState.Canceling:
		case constants.MigrationState.Canceled:
			return IconPathHelper.cancel;
		case constants.MigrationState.Failed:
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
	return account?.properties.tenants || [];
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

export async function getResourceLocations(
	account?: Account,
	subscription?: azureResource.AzureResourceSubscription,
	resources?: { location: string }[]): Promise<azureResource.AzureLocation[]> {

	try {
		if (account && subscription && resources) {
			const locations = await azure.getLocations(account, subscription);
			return locations
				.filter((loc, i) => resources.some(resource => resource.location.toLowerCase() === loc.name.toLowerCase()))
				.sort((a, b) => a.displayName.localeCompare(b.displayName));
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getResourceLocations', e);
	}
	return [];
}

export function getServiceResourceGroupsByLocation(
	resources: { location: string, id: string, tenantId?: string }[],
	location: azureResource.AzureLocation): azureResource.AzureResourceResourceGroup[] {

	let resourceGroups: azureResource.AzureResourceResourceGroup[] = [];
	if (resources && location) {
		const locationName = location.name.toLowerCase();
		resourceGroups = resources
			.filter(resource => resource.location.toLowerCase() === locationName)
			.map(resource => {
				return <azureResource.AzureResourceResourceGroup>{
					id: azure.getFullResourceGroupFromId(resource.id),
					name: azure.getResourceGroupFromId(resource.id),
					subscription: { id: getSubscriptionIdFromResourceId(resource.id) },
					tenant: resource.tenantId
				};
			});
	}

	// remove duplicates
	return resourceGroups
		.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function getSubscriptionIdFromResourceId(resourceId: string): string | undefined {
	let parts = resourceId?.split('/subscriptions/');
	if (parts?.length > 1) {
		parts = parts[1]?.split('/resourcegroups/');
		if (parts?.length > 0) {
			return parts[0];
		}
	}
	return undefined;
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
				if (managedInstance.properties.state.toLowerCase() === 'Ready'.toLowerCase()) {
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

export async function getAzureSqlDatabaseServers(account?: Account, subscription?: azureResource.AzureResourceSubscription): Promise<azure.AzureSqlDatabaseServer[]> {
	let sqlDatabaseServers: azure.AzureSqlDatabaseServer[] = [];
	try {
		if (account && subscription) {
			sqlDatabaseServers = await azure.getAvailableSqlDatabaseServers(account, subscription);
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAzureSqlDatabaseServers', e);
	}
	sqlDatabaseServers.sort((a, b) => a.name.localeCompare(b.name));
	return sqlDatabaseServers;
}

export async function getAzureSqlDatabases(account?: Account, subscription?: azureResource.AzureResourceSubscription, resourceGroupName?: string, serverName?: string): Promise<azure.AzureSqlDatabase[]> {
	if (account && subscription && resourceGroupName && serverName) {
		try {
			const databases = await azure.getAvailableSqlDatabases(account, subscription, resourceGroupName, serverName);
			return databases.sort((a, b) => a.name.localeCompare(b.name));
		} catch (e) {
			logError(TelemetryViews.Utils, 'utils.getAzureSqlDatabases', e);
		}
	}
	return [];
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

export async function getVirtualMachinesDropdownValues(virtualMachines: azure.SqlVMServer[], location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup, account: Account, subscription: azureResource.AzureResourceSubscription): Promise<CategoryValue[]> {
	let virtualMachinesValues: CategoryValue[] = [];
	if (location && resourceGroup) {
		for (const virtualMachine of virtualMachines) {
			if (virtualMachine.location.toLowerCase() === location.name.toLowerCase() && azure.getResourceGroupFromId(virtualMachine.id).toLowerCase() === resourceGroup.name.toLowerCase()) {
				let virtualMachineValue: CategoryValue;

				// 1) check if VM is on by querying underlying compute resource's instance view
				let vmInstanceView = await azure.getVMInstanceView(virtualMachine, account, subscription);
				if (!vmInstanceView.statuses.some(status => status.code.toLowerCase() === 'PowerState/running'.toLowerCase())) {
					virtualMachineValue = {
						name: virtualMachine.id,
						displayName: constants.UNAVAILABLE_TARGET_PREFIX(virtualMachine.name)
					}
				}

				// 2) check for IaaS extension in Full mode
				else if (virtualMachine.properties.sqlManagement.toLowerCase() !== 'Full'.toLowerCase()) {
					virtualMachineValue = {
						name: virtualMachine.id,
						displayName: constants.UNAVAILABLE_TARGET_PREFIX(virtualMachine.name)
					}
				}

				else {
					virtualMachineValue = {
						name: virtualMachine.id,
						displayName: virtualMachine.name
					};
				}

				virtualMachinesValues.push(virtualMachineValue);
			}
		}
	}

	if (virtualMachinesValues.length === 0) {
		virtualMachinesValues = [
			{
				displayName: constants.NO_VIRTUAL_MACHINE_FOUND,
				name: ''
			}
		];
	}
	return virtualMachinesValues;
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

export async function getAzureSqlMigrationServices(account?: Account, subscription?: azureResource.AzureResourceSubscription): Promise<azure.SqlMigrationService[]> {
	try {
		if (account && subscription) {
			const services = await azure.getSqlMigrationServices(account, subscription);
			return services
				.filter(dms => dms.properties.provisioningState === constants.ProvisioningState.Succeeded)
				.sort((a, b) => a.name.localeCompare(b.name));
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAzureSqlMigrationServices', e);
	}
	return [];
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

export function getAzureResourceDropdownValues(
	azureResources: { location: string, id: string, name: string }[],
	location: azureResource.AzureLocation | undefined,
	resourceGroup: string | undefined,
	resourceNotFoundMessage: string): CategoryValue[] {

	if (location?.name && resourceGroup && azureResources?.length > 0) {
		const locationName = location.name.toLowerCase();
		const resourceGroupName = resourceGroup.toLowerCase();

		return azureResources
			.filter(resource =>
				resource.location?.toLowerCase() === locationName &&
				azure.getResourceGroupFromId(resource.id)?.toLowerCase() === resourceGroupName)
			.map(resource => {
				return { name: resource.id, displayName: resource.name };
			});
	}

	return [{ name: '', displayName: resourceNotFoundMessage }];
}

export function getResourceDropdownValues(resources: { id: string, name: string }[], resourceNotFoundMessage: string): CategoryValue[] {
	if (!resources || !resources.length) {
		return [{ name: '', displayName: resourceNotFoundMessage }];
	}

	return resources?.map(resource => { return { name: resource.id, displayName: resource.name }; })
		|| [{ name: '', displayName: resourceNotFoundMessage }];
}

export async function getAzureTenantsDropdownValues(tenants: Tenant[]): Promise<CategoryValue[]> {
	return tenants?.map(tenant => { return { name: tenant.id, displayName: tenant.displayName }; })
		|| [{ name: '', displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR }];
}

export async function getAzureLocationsDropdownValues(locations: azureResource.AzureLocation[]): Promise<CategoryValue[]> {
	if (!locations || !locations.length) {
		return [{ name: '', displayName: constants.NO_LOCATION_FOUND }];
	}

	return locations?.map(location => { return { name: location.name, displayName: location.displayName }; })
		|| [{ name: '', displayName: constants.NO_LOCATION_FOUND }];
}

export async function getBlobLastBackupFileNamesValues(blobs: azureResource.Blob[]): Promise<CategoryValue[]> {
	return blobs?.map(blob => { return { name: blob.name, displayName: blob.name }; })
		|| [{ name: '', displayName: constants.NO_BLOBFILES_FOUND }];
}

export async function updateControlDisplay(control: Component, visible: boolean, displayStyle: DisplayType = 'inline'): Promise<void> {
	const display = visible ? displayStyle : 'none';
	control.display = display;
	await control.updateCssStyles({ 'display': display });
	await control.updateProperties({ 'display': display });
}

export function generateGuid(): string {
	const hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
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
	const clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return `${oct.substr(0, 8)}-${oct.substr(9, 4)}-4${oct.substr(13, 3)}-${clockSequenceHi}${oct.substr(16, 3)}-${oct.substr(19, 12)}`;
	/* tslint:enable:no-bitwise */
}

export async function promptUserForFolder(): Promise<string> {
	const options: vscode.OpenDialogOptions = {
		defaultUri: vscode.Uri.file(getUserHome()!),
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
	};

	const fileUris = await vscode.window.showOpenDialog(options);
	if (fileUris && fileUris.length > 0 && fileUris[0]) {
		return fileUris[0].fsPath;
	}

	return '';
}
