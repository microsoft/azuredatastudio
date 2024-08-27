/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, Account, accounts, CategoryValue, DropDownComponent, IconPath, DisplayType, Component, ModelView, DeclarativeTableComponent, DeclarativeDataType, FlexContainer } from 'azdata';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { promises as fs } from 'fs';
import { IconPathHelper } from '../constants/iconPathHelper';
import * as crypto from 'crypto';
import * as azure from './azure';
import { azureResource, Tenant } from 'azurecore';
import * as constants from '../constants/strings';
import { logError, TelemetryViews } from '../telemetry';
import { AdsMigrationStatus } from '../dashboard/tabBase';
import { getMigrationMode, getMigrationStatus, getSchemaMigrationStatus, getMigrationType, getMigrationTargetType, hasRestoreBlockingReason, PipelineStatusCodes } from '../constants/helper';
import * as os from 'os';
import * as styles from '../constants/styles';
import { SqlMigrationService, SqlMigrationServiceAuthenticationKeys, getSqlMigrationService, getSqlMigrationServiceAuthKeys, regenerateSqlMigrationServiceAuthKey } from './azure';
import { MigrationStateModel } from '../models/stateMachine';
import * as contracts from '../service/contracts';
import { CssStyles } from 'azdata';
import { DeclarativeTableCellValue } from 'azdata';
import path = require('path');
import { spawn } from "child_process"
import { collectSourceLogins, getSourceConnectionId, getSourceConnectionString, LoginTableInfo } from './sqlUtils';

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
	DeleteMigration: 'sqlmigration.delete.migration',
	RetryMigration: 'sqlmigration.retry.migration',
	RestartMigration: 'sqlmigration.restart.migration',
	StartMigration: 'sqlmigration.start',
	StartLoginMigration: 'sqlmigration.login.start',
	IssueReporter: 'workbench.action.openIssueReporter',
	OpenNotebooks: 'sqlmigration.openNotebooks',
	NewSupportRequest: 'sqlmigration.newsupportrequest',
	SendFeedback: 'sqlmigration.sendfeedback',
};

export enum MigrationTargetType {
	SQLVM = 'AzureSqlVirtualMachine',
	SQLMI = 'AzureSqlManagedInstance',
	SQLDB = 'AzureSqlDatabase'
}

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
	const supportedKind: string[] = [
		azure.AzureResourceKind.SQLDB,
		azure.AzureResourceKind.SQLMI,
		azure.AzureResourceKind.SQLVM,
	];

	let filteredMigration: azure.DatabaseMigration[] =
		databaseMigrations.filter(m => supportedKind.includes(m.properties?.kind)) ||
		[];

	if (columnTextFilter) {
		const filter = columnTextFilter.toLowerCase();
		filteredMigration = filteredMigration.filter(
			migration => migration.properties.sourceServerName?.toLowerCase().includes(filter)
				|| migration.properties.sourceDatabaseName?.toLowerCase().includes(filter)
				|| getMigrationStatus(migration)?.toLowerCase().includes(filter)
				|| getMigrationMode(migration)?.toLowerCase().includes(filter)
				|| getMigrationType(migration)?.toLocaleLowerCase().includes(filter)
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
				selectedIndex = dropDown.values?.findIndex((v: any) => (v as CategoryValue)?.displayName?.toLowerCase() === searchValue);
			} else {
				selectedIndex = dropDown.values?.findIndex((v: any) => (v as CategoryValue)?.name?.toLowerCase() === searchValue);
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

export function getSchemaMigrationStatusImage(migration: azure.DatabaseMigration): IconPath {
	const status = getSchemaMigrationStatus(migration);
	switch (status) {
		case constants.MigrationState.CollectionCompleted:
		case constants.MigrationState.PrefetchObjects:
		case constants.MigrationState.GetDependency:
		case constants.MigrationState.ScriptObjects:
		case constants.MigrationState.ScriptViewIndexes:
		case constants.MigrationState.ScriptOwnership:
		case constants.MigrationState.GeneratingScript:
		case constants.MigrationState.DeployingSchema:
		case constants.MigrationState.GeneratingScriptCompleted:
		case constants.MigrationState.DeploymentCompleted:
			return IconPathHelper.inProgressMigration;
		case constants.MigrationState.Completed:
			return IconPathHelper.completedMigration;
		case constants.MigrationState.Failed:
		case constants.MigrationState.CompletedWithError:
			return IconPathHelper.error;
		default:
			return IconPathHelper.notStartedMigration;
	}
}

export function getObjectsCollectionStatusImage(migration: azure.DatabaseMigration): IconPath {
	const status = getSchemaMigrationStatus(migration);
	switch (status) {
		case constants.MigrationState.CollectionCompleted:
		case constants.MigrationState.PrefetchObjects:
		case constants.MigrationState.GetDependency:
		case constants.MigrationState.ScriptObjects:
		case constants.MigrationState.ScriptViewIndexes:
		case constants.MigrationState.ScriptOwnership:
		case constants.MigrationState.GeneratingScript:
		case constants.MigrationState.GeneratingScriptCompleted:
		case constants.MigrationState.DeployingSchema:
		case constants.MigrationState.DeploymentCompleted:
		case constants.MigrationState.Completed:
		case constants.MigrationState.CompletedWithError:
			return IconPathHelper.completedMigration;
		default:
			return IconPathHelper.notStartedMigration;
	}
}

export function getScriptGenerationStatusImage(migration: azure.DatabaseMigration): IconPath {
	var scriptGeneration = migration?.properties.migrationStatusDetails?.sqlSchemaMigrationStatus?.scriptGeneration ?? undefined;
	var errors = scriptGeneration === undefined ? [] : scriptGeneration.errors ?? [];

	const status = getSchemaMigrationStatus(migration);
	switch (status) {
		case constants.MigrationState.PrefetchObjects:
		case constants.MigrationState.GetDependency:
		case constants.MigrationState.ScriptObjects:
		case constants.MigrationState.ScriptViewIndexes:
		case constants.MigrationState.ScriptOwnership:
		case constants.MigrationState.GeneratingScript:
			return IconPathHelper.inProgressMigration;
		case constants.MigrationState.Completed:
		case constants.MigrationState.CompletedWithError:
		case constants.MigrationState.GeneratingScriptCompleted:
		case constants.MigrationState.DeployingSchema:
		case constants.MigrationState.DeploymentCompleted:
			return errors.length > 0 ? IconPathHelper.error : IconPathHelper.completedMigration;
		default:
			return IconPathHelper.notStartedMigration;
	}
}

export function getScriptDeploymentStatusImage(migration: azure.DatabaseMigration): IconPath {
	var scriptDeployment = migration?.properties.migrationStatusDetails?.sqlSchemaMigrationStatus?.scriptDeployment ?? undefined;
	var errors = scriptDeployment === undefined ? [] : scriptDeployment.errors ?? [];

	const status = getSchemaMigrationStatus(migration);
	switch (status) {
		case constants.MigrationState.DeployingSchema:
			return IconPathHelper.inProgressMigration;
		case constants.MigrationState.Completed:
		case constants.MigrationState.DeploymentCompleted:
			return IconPathHelper.completedMigration;
		case constants.MigrationState.CompletedWithError:
			return errors.length > 0 ? IconPathHelper.error : IconPathHelper.completedMigration;
		default:
			return IconPathHelper.notStartedMigration;
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
			displayName: isAccountTokenStale(account)
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

export function isAccountTokenStale(account: Account | undefined): boolean {
	return account === undefined || account?.isStale === true;
}

export function getAzureTenants(account?: Account): Tenant[] {
	return account?.properties.tenants || [];
}

export async function getAzureSubscriptions(account?: Account, tenantId?: string): Promise<azureResource.AzureResourceSubscription[]> {
	let subscriptions: azureResource.AzureResourceSubscription[] = [];
	try {
		subscriptions = account && !isAccountTokenStale(account)
			? await azure.getSubscriptions(account)
			: [];
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getAzureSubscriptions', e);
	}
	const filtered = subscriptions.filter(subscription => subscription.tenant === tenantId);
	filtered.sort((a, b) => a.name.localeCompare(b.name));
	return filtered;
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

// retrieve the auth keys
export async function retrieveAuthKeys(migrationStateModel: MigrationStateModel): Promise<SqlMigrationServiceAuthenticationKeys> {

	let defaultKeys: SqlMigrationServiceAuthenticationKeys = {
		authKey1: '',
		authKey2: ''
	};

	const service = migrationStateModel._sqlMigrationService;
	if (service) {
		const account = migrationStateModel._azureAccount;
		const subscription = migrationStateModel._sqlMigrationServiceSubscription;
		const resourceGroup = service.properties.resourceGroup;
		const location = service.location;
		const serviceName = service.name;
		if (service?.properties?.integrationRuntimeState) {
			service.properties.integrationRuntimeState = undefined;
		}
		const keys = await getSqlMigrationServiceAuthKeys(
			account,
			subscription,
			resourceGroup,
			location,
			serviceName);

		return keys;
	}
	return defaultKeys;
}

// invoke and execute the script
export async function invokeScript(scriptPath: string): Promise<void> {

	var child = spawn("powershell.exe", [scriptPath]);
	child.stdout.on("data", function (data: string) {
		console.log("Powershell Data: " + data);
	});
	child.stderr.on("data", function (data: string) {
		console.log("Powershell Errors: " + data);
	});
	child.on("exit", function () {
		console.log("Powershell Script finished");
	});
	child.stdin.end(); //end input
}

// creates powershell script container
export async function createPowershellscriptContentContainer(view: azdata.ModelView, migrationStateModel: MigrationStateModel):
	Promise<azdata.Component> {
	const container = view.modelBuilder.flexContainer().withLayout({
		flexFlow: 'column',
	}).component();

	const def = view.modelBuilder.text().withProps({
		value: constants.POWERSHELL_SCRIPT_DESCRIPTION,
		CSSStyles: {
			'margin-top': '8px',
			'margin-bottom': '8px',
		},
	}).component();

	const saveScriptButton = view.modelBuilder.button().withProps({
		label: constants.SAVE_SCRIPT,
		ariaLabel: constants.SAVE_SCRIPT,
		iconWidth: '18px',
		iconHeight: '18px',
		height: '40px',
		width: '100px',
		iconPath: IconPathHelper.save,
		CSSStyles: {
			'padding': '8px 8px',
		},
	}).component();

	const scriptpath = path.join(__dirname, '../scripts/SHIR-auto-configuration.ps1');

	const scriptContent = await fs.readFile(scriptpath);

	// inject auth keys in the script
	const authKeys = await retrieveAuthKeys(migrationStateModel);
	const modifiedScriptContent = await injectKeysIntoShirScriptContent
		(authKeys.authKey1, authKeys.authKey2, scriptContent.toString());

	// write it back to different file
	const modifiedScriptPath = path.join(__dirname, '../scripts/SHIR-auto-configuration-with-auth-keys.ps1');
	await fs.writeFile(modifiedScriptPath, modifiedScriptContent);

	saveScriptButton.onDidClick(async () => {
		const options: vscode.SaveDialogOptions = {
			defaultUri: vscode.Uri.file(suggestReportFile(Date.now())),
			filters: { 'Windows PowerShell Script': ['ps1'] }
		};

		const choosenPath = await vscode.window.showSaveDialog(options);
		if (choosenPath !== undefined) {
			const value = modifiedScriptContent.toString();
			await fs.writeFile(choosenPath.fsPath, value);
			if (await vscode.window.showInformationMessage(
				constants.POWERSHELL_SCRIPT_SAVED,
				constants.OPEN, constants.CANCEL) === constants.OPEN) {
				await vscode.env.openExternal(choosenPath);
			}
		}
	});

	const scriptBox = view.modelBuilder.inputBox()
		.withProps({
			value: modifiedScriptContent.toString(),
			readOnly: true,
			multiline: true,
			height: 400,
			inputType: 'text',
			display: 'inline-block',
			CSSStyles:
			{
				'font': '12px "Monaco", "Menlo", "Consolas", "Droid Sans Mono", "Inconsolata", "Courier New", monospace',
				'margin': '0',
				'padding': '8px',
				'white-space': 'pre',
				'background-color': '#eeeeee',
				'overflow-x': 'hidden',
				'word-break': 'break-all'
			},
		})
		.component();

	container.addItems([def, saveScriptButton, scriptBox]);

	return container;
}

// inject the auth keys
export async function injectKeysIntoShirScriptContent(authKey1: string, authKey2: string,
	scriptContent: string): Promise<string> {
	if (!scriptContent)
		return ""; // If the script is null or empty, return empty string

	// Replace placeholders for authentication keys in the script
	if (authKey1) {
		scriptContent = scriptContent.replace(/\$AuthKey1 = \$null/, `$AuthKey1 = "${authKey1}"`);
	}
	if (authKey2) {
		scriptContent = scriptContent.replace(/\$AuthKey2 = \$null/, `$AuthKey2 = "${authKey2}"`);
	}

	return scriptContent; // Return the script with injected authentication keys
}



// creates manual IR config container
export async function createManualIRconfigContentContainer(view: azdata.ModelView, migrationStateModel: MigrationStateModel):
	Promise<azdata.FlexContainer> {
	const container = view.modelBuilder.flexContainer().withLayout({
		flexFlow: 'column',
	}).component();

	const instructions = createRegistrationInstructions(view, false);
	await instructions.updateCssStyles({
		...styles.BODY_CSS,
	})

	let migrationServiceAuthKeyTable: azdata.DeclarativeTableComponent;
	migrationServiceAuthKeyTable = createAuthenticationKeyTable(view, '50px', '100%');

	const service = migrationStateModel._sqlMigrationService;
	if (service) {
		const account = migrationStateModel._azureAccount;
		const subscription = migrationStateModel._sqlMigrationServiceSubscription;
		const resourceGroup = service.properties.resourceGroup;
		const location = service.location;
		const serviceName = service.name;
		if (service?.properties?.integrationRuntimeState) {
			service.properties.integrationRuntimeState = undefined;
		}

		const migrationService = await getSqlMigrationService(
			account,
			subscription,
			resourceGroup,
			location,
			serviceName);

		await refreshAuthenticationKeyTable(view,
			migrationServiceAuthKeyTable,
			account,
			subscription,
			resourceGroup,
			location,
			migrationService);

	}

	container.addItems([instructions, migrationServiceAuthKeyTable]);

	return container;
}

export async function getSourceLogins(migrationStateModel: MigrationStateModel) {
	var sourceLogins: LoginTableInfo[] = [];

	// execute a query against the source to get the logins
	sourceLogins.push(...await collectSourceLogins(
		await getSourceConnectionId(),
		migrationStateModel.isWindowsAuthMigrationSupported));

	// validate Login Eligibility result contains system logins in Exception map from which system login names can be extracted.
	// These system logins are not to be displayed in the source logins list
	var validateLoginEligibilityResult: contracts.StartLoginMigrationPreValidationResult | undefined = await migrationStateModel.migrationService.validateLoginEligibility(
		await getSourceConnectionString(),
		"",
		sourceLogins.map(row => row.loginName),
		""
	);

	var sourceSystemLoginsName: string[] = [];
	var sourceSystemLogins: LoginTableInfo[] = [];

	if (validateLoginEligibilityResult !== undefined) {
		sourceSystemLoginsName = Object.keys(validateLoginEligibilityResult.exceptionMap).map(loginName => loginName.toLocaleLowerCase());

		// separate out system logins from non system logins
		sourceSystemLogins = sourceLogins.filter(login => sourceSystemLoginsName.includes(login.loginName.toLocaleLowerCase()));
		sourceLogins = sourceLogins.filter(login => !sourceSystemLoginsName.includes(login.loginName.toLocaleLowerCase()));
	} else {
		logError(TelemetryViews.Utils, 'utils.getSourceLogins', new Error(constants.VALIDATE_LOGIN_ELIGIBILITY_FAILED));
	}

	migrationStateModel._loginMigrationModel.collectedSourceLogins = true;
	migrationStateModel._loginMigrationModel.loginsOnSource = sourceLogins;
	migrationStateModel._loginMigrationModel.systemLoginsOnSource = sourceSystemLogins;
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

export interface Blob {
	resourceGroup: azureResource.AzureResourceResourceGroup;
	storageAccount: azureResource.AzureGraphResource;
	blobContainer: azureResource.BlobContainer;
	storageKey: string;
	lastBackupFile?: string;
	folderName?: string;
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
			const blobs = await azure.getBlobs(account, subscription, storageAccount, blobContainer.name);

			blobs.forEach(blob => {
				// only show at most one folder deep
				if ((blob.name.split('/').length === 1 || blob.name.split('/').length === 2) && !lastFileNames.includes(blob)) {
					lastFileNames.push(blob);
				}
			});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getBlobLastBackupFileNames', e);
	}
	lastFileNames.sort((a, b) => a.name.localeCompare(b.name));
	return lastFileNames;
}

export async function getBlobFolders(account?: Account, subscription?: azureResource.AzureResourceSubscription, storageAccount?: azure.StorageAccount, blobContainer?: azureResource.BlobContainer): Promise<string[]> {
	let folders: string[] = [];
	try {
		if (account && subscription && storageAccount && blobContainer) {
			const blobs = await azure.getBlobs(account, subscription, storageAccount, blobContainer.name);

			blobs.forEach(blob => {
				let folder: string = '';

				if (blob.name.split('/').length === 1) {
					folder = '/';	// no folder (root)
				} else if (blob.name.split('/').length === 2) {
					folder = blob.name.split('/')[0];	// one folder deep
				}

				if (folder && !folders.includes(folder)) {
					folders.push(folder);
				}
			});
		}
	} catch (e) {
		logError(TelemetryViews.Utils, 'utils.getBlobLastBackupFolders', e);
	}
	folders.sort();
	return folders;
}

export function getBlobContainerNameWithFolder(blob: Blob, isOfflineMigration: boolean): string {
	const blobContainerName = blob.blobContainer.name;

	if (isOfflineMigration) {
		const lastBackupFile = blob.lastBackupFile;
		if (!lastBackupFile || lastBackupFile.split('/').length !== 2) {
			return blobContainerName;
		}

		// for offline scenario, take the folder name out of the blob name and add it to the container name instead
		return blobContainerName + '/' + lastBackupFile.split('/')[0];
	} else {
		const folderName = blob.folderName;
		if (!folderName || folderName === '/' || folderName === 'undefined') {
			return blobContainerName;
		}

		// for online scenario, take the explicitly provided folder name
		return blobContainerName + '/' + folderName;
	}
}

export function getLastBackupFileNameWithoutFolder(blob: Blob) {
	const lastBackupFile = blob.lastBackupFile;
	if (!lastBackupFile || lastBackupFile.split('/').length !== 2) {
		return lastBackupFile;
	}

	return lastBackupFile.split('/')[1];
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

export function getAzureTenantsDropdownValues(tenants: Tenant[]): CategoryValue[] {
	if (!tenants || !tenants.length) {
		return [{ name: '', displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR }];
	}

	return tenants?.map(tenant => { return { name: tenant.id, displayName: tenant.displayName }; })
		|| [{ name: '', displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR }];
}

export function getAzureLocationsDropdownValues(locations: azureResource.AzureLocation[]): CategoryValue[] {
	if (!locations || !locations.length) {
		return [{ name: '', displayName: constants.NO_LOCATION_FOUND }];
	}

	return locations?.map(location => { return { name: location.name, displayName: location.displayName }; })
		|| [{ name: '', displayName: constants.NO_LOCATION_FOUND }];
}

export function getBlobLastBackupFileNamesValues(blobs: azureResource.Blob[]): CategoryValue[] {
	if (!blobs || !blobs.length) {
		return [{ name: '', displayName: constants.NO_BLOBFILES_FOUND }];
	}

	return blobs?.map(blob => { return { name: blob.name, displayName: blob.name }; })
		|| [{ name: '', displayName: constants.NO_BLOBFILES_FOUND }];
}

export function getBlobFolderValues(folders: string[]): CategoryValue[] {
	if (!folders || !folders.length) {
		return [{ name: '', displayName: constants.NO_BLOBFOLDERS_FOUND }];
	}

	return folders?.map(folder => { return { name: folder, displayName: folder }; })
		|| [{ name: '', displayName: constants.NO_BLOBFOLDERS_FOUND }];
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

export function isWindows(): boolean { return (os.platform() === 'win32') }

export async function isAdmin(): Promise<boolean> {
	let isAdmin: boolean = false;
	try {
		if (isWindows()) {
			isAdmin = (await import('native-is-elevated'))();
		} else {
			isAdmin = process.getuid?.() === 0;
		}
	} catch (e) {
		//Ignore error and return false;
	}

	return isAdmin;
}

export function createAuthenticationKeyTable(view: ModelView, columnWidth: string, stretchWidth: string): DeclarativeTableComponent {
	const WIZARD_INPUT_COMPONENT_WIDTH = '600px';

	const authKeyTable = view.modelBuilder.declarativeTable()
		.withProps({
			ariaLabel: constants.DATABASE_MIGRATION_SERVICE_AUTHENTICATION_KEYS,
			columns: [
				{
					displayName: constants.NAME,
					valueType: DeclarativeDataType.string,
					width: columnWidth,
					isReadOnly: true,
					rowCssStyles: { ...styles.BODY_CSS },
					headerCssStyles: { ...styles.BODY_CSS, 'font-weight': '600' }
				},
				{
					displayName: constants.AUTH_KEY_COLUMN_HEADER,
					valueType: DeclarativeDataType.string,
					width: stretchWidth,
					isReadOnly: true,
					rowCssStyles: { ...styles.BODY_CSS },
					headerCssStyles: { ...styles.BODY_CSS, 'font-weight': '600' }
				},
				{
					displayName: '',
					valueType: DeclarativeDataType.component,
					width: columnWidth,
					isReadOnly: true,
					rowCssStyles: { ...styles.BODY_CSS },
					headerCssStyles: { ...styles.BODY_CSS }
				}
			],
			CSSStyles: { 'margin-top': '5px', 'width': WIZARD_INPUT_COMPONENT_WIDTH }
		}).component();
	return authKeyTable;
}

export async function refreshAuthenticationKeyTable(view: ModelView, table: DeclarativeTableComponent, account: Account, subscription: azureResource.AzureResourceSubscription, resourceGroup: string, location: string, service: SqlMigrationService): Promise<void> {
	var _disposables: vscode.Disposable[] = [];

	const copyKey1Button = view.modelBuilder.button().withProps({
		title: constants.COPY_KEY1,
		iconPath: IconPathHelper.copy,
		ariaLabel: constants.COPY_KEY1,
	}).component();

	_disposables.push(copyKey1Button.onDidClick(async (e) => {
		await vscode.env.clipboard.writeText(<string>table.dataValues![0][1].value);
		void vscode.window.showInformationMessage(constants.SERVICE_KEY1_COPIED_HELP);
	}));

	const copyKey2Button = view.modelBuilder.button().withProps({
		title: constants.COPY_KEY2,
		iconPath: IconPathHelper.copy,
		ariaLabel: constants.COPY_KEY2,
	}).component();

	_disposables.push(copyKey2Button.onDidClick(async (e) => {
		await vscode.env.clipboard.writeText(<string>table.dataValues![1][1].value);
		void vscode.window.showInformationMessage(constants.SERVICE_KEY2_COPIED_HELP);
	}));

	const refreshKey1Button = view.modelBuilder.button().withProps({
		title: constants.REFRESH_KEY1,
		iconPath: IconPathHelper.refresh,
		ariaLabel: constants.REFRESH_KEY1,
	}).component();

	_disposables.push(refreshKey1Button.onDidClick(async (e) => {
		const keys = await regenerateSqlMigrationServiceAuthKey(
			account,
			subscription,
			resourceGroup,
			location,
			service.name,
			'authKey1');

		const dataValues = table.dataValues!;
		dataValues![0][1].value = keys.authKey1;
		await table.setDataValues([]);
		await table.setDataValues(dataValues);
		await vscode.window.showInformationMessage(constants.AUTH_KEY_REFRESHED(constants.SERVICE_KEY1_LABEL));
	}));

	const refreshKey2Button = view.modelBuilder.button().withProps({
		title: constants.REFRESH_KEY2,
		iconPath: IconPathHelper.refresh,
		ariaLabel: constants.REFRESH_KEY2,
	}).component();

	_disposables.push(refreshKey2Button.onDidClick(async (e) => {
		const keys = await regenerateSqlMigrationServiceAuthKey(
			account,
			subscription,
			resourceGroup,
			location,
			service.name,
			'authKey2');

		const dataValues = table.dataValues!;
		dataValues![1][1].value = keys.authKey2;
		await table.setDataValues([]);
		await table.setDataValues(dataValues);
		await vscode.window.showInformationMessage(constants.AUTH_KEY_REFRESHED(constants.SERVICE_KEY2_LABEL));
	}));

	const keys = await getSqlMigrationServiceAuthKeys(
		account,
		subscription,
		resourceGroup,
		location,
		service.name);


	await table.updateProperties({
		dataValues: [
			[
				{
					value: constants.SERVICE_KEY1_LABEL
				},
				{
					value: keys.authKey1
				},
				{
					value: view.modelBuilder.flexContainer().withItems([copyKey1Button, refreshKey1Button]).component()
				}
			],
			[
				{
					value: constants.SERVICE_KEY2_LABEL
				},
				{
					value: keys.authKey2
				},
				{
					value: view.modelBuilder.flexContainer().withItems([copyKey2Button, refreshKey2Button]).component()
				}
			]
		]
	});
}

//Function that creates stage status table.
export function createIntegrationRuntimeTable(view: ModelView): DeclarativeTableComponent {
	const rowCssStyle: CssStyles = {
		'border': 'none',
		'text-align': 'left',
		'box-shadow': 'inset 0px -1px 0px #F3F2F1',
		'font-size': '13px',
		'line-height': '18px',
		'padding': '7px 0px',
		'margin': '0px',
	};

	const headerCssStyles: CssStyles = {
		'border': 'none',
		'text-align': 'left',
		'box-shadow': 'inset 0px -1px 0px #F3F2F1',
		'font-weight': 'bold',
		'padding-left': '0px',
		'padding-right': '0px',
		'font-size': '13px',
		'line-height': '18px'
	};
	const _integrationRuntimeTable: DeclarativeTableComponent = view.modelBuilder.declarativeTable().withProps({
		columns: [
			{
				displayName: constants.NODE_NAME,
				valueType: DeclarativeDataType.string,
				width: '200px',
				isReadOnly: true,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyles
			},
			{
				displayName: constants.STATUS,
				valueType: DeclarativeDataType.string,
				width: '120px',
				isReadOnly: true,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyles
			},
			{
				displayName: constants.IP_ADDRESS,
				valueType: DeclarativeDataType.string,
				width: '120px',
				isReadOnly: true,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyles
			},
			{
				displayName: constants.IR_VERSION,
				valueType: DeclarativeDataType.string,
				width: '120px',
				isReadOnly: true,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyles
			}
		],
		data: [],
		width: '440px',
		CSSStyles: {
			'margin-left': '41px',
			'margin-top': '16px'
		}
	}).component();

	return _integrationRuntimeTable;
}

export function createRegistrationInstructions(view: ModelView, testConnectionButton: boolean): FlexContainer {
	const setupIRHeadingText = view.modelBuilder.text().withProps({
		value: constants.SERVICE_CONTAINER_HEADING,
		CSSStyles: {
			...styles.LABEL_CSS
		}
	}).component();

	const setupIRdescription1 = view.modelBuilder.text().withProps({
		value: constants.SERVICE_CONTAINER_DESCRIPTION1,
		CSSStyles: {
			...styles.BODY_CSS
		}
	}).component();

	const setupIRdescription2 = view.modelBuilder.text().withProps({
		value: constants.SERVICE_CONTAINER_DESCRIPTION2,
		CSSStyles: {
			...styles.BODY_CSS
		}
	}).component();

	const irSetupStep1Text = view.modelBuilder.text().withProps({
		value: constants.SERVICE_STEP1,
		CSSStyles: {
			...styles.BODY_CSS
		},
		links: [
			{
				text: constants.SERVICE_STEP1_LINK,
				url: 'https://aka.ms/sql-migration-shir-download'
			}
		]
	}).component();

	const irSetupStep2Text = view.modelBuilder.text().withProps({
		value: constants.SERVICE_STEP2,
		CSSStyles: {
			...styles.BODY_CSS
		}
	}).component();

	const irSetupStep3Text = view.modelBuilder.text().withProps({
		value: constants.SERVICE_STEP3(testConnectionButton),
		CSSStyles: {
			'margin-top': '10px',
			'margin-bottom': '10px',
			...styles.BODY_CSS
		}
	}).component();

	return view.modelBuilder.flexContainer().withItems(
		[
			setupIRHeadingText,
			setupIRdescription1,
			setupIRdescription2,
			irSetupStep1Text,
			irSetupStep2Text,
			irSetupStep3Text,
		]
	).withLayout({
		flexFlow: 'column'
	}).component();
}

export async function clearDropDown(dropDown: DropDownComponent): Promise<void> {
	await dropDown.updateProperty('value', undefined);
	await dropDown.updateProperty('values', []);
}

export function suggestReportFile(date: number): string {
	const fileName = `ConfigureIR_${generateDefaultFileName(new Date(date))}.ps1`;
	return path.join(os.homedir(), fileName);
}

function generateDefaultFileName(resultDate: Date): string {
	return `${resultDate.toISOString().replace(/-/g, '').replace('T', '').replace(/:/g, '').split('.')[0]}`;
}

export async function getRecommendedConfiguration(targetType: MigrationTargetType, model: MigrationStateModel): Promise<string[]> {

	if (!hasRecommendations(model)) {
		return [];
	}
	let recommendation;
	switch (targetType) {
		case MigrationTargetType.SQLVM:
			// elastic model currently doesn't support SQL VM, so show the baseline model results regardless of user preference
			recommendation = model._skuRecommendationResults.recommendations?.sqlVmRecommendationResults[0];

			// result returned but no SKU recommended
			if (!recommendation?.targetSku) {
				return [constants.SKU_RECOMMENDATION_NO_RECOMMENDATION];
			}
			else {
				const vmConfiguration = constants.VM_CONFIGURATION(
					recommendation.targetSku.virtualMachineSize!.sizeName,
					recommendation.targetSku.virtualMachineSize!.vCPUsAvailable);

				return [vmConfiguration];
			}
		case MigrationTargetType.SQLDB:
			const recommendations = model._skuEnableElastic
				? model._skuRecommendationResults.recommendations!.elasticSqlDbRecommendationResults
				: model._skuRecommendationResults.recommendations!.sqlDbRecommendationResults;
			const successfulRecommendationsCount = recommendations.filter(r => r.targetSku !== null)?.length ?? 0;
			return [constants.RECOMMENDATIONS_AVAILABLE(successfulRecommendationsCount)];
		case MigrationTargetType.SQLMI:
			if (model._skuEnableElastic) {
				recommendation = model._skuRecommendationResults.recommendations?.elasticSqlMiRecommendationResults[0];
			} else {
				recommendation = model._skuRecommendationResults.recommendations?.sqlMiRecommendationResults[0];
			}

			// result returned but no SKU recommended
			if (!recommendation?.targetSku) {
				return [constants.SKU_RECOMMENDATION_NO_RECOMMENDATION];
			}
			else {
				const serviceTier = recommendation.targetSku.category?.sqlServiceTier === contracts.AzureSqlPaaSServiceTier.GeneralPurpose
					? constants.GENERAL_PURPOSE :
					recommendation.targetSku.category?.sqlServiceTier === contracts.AzureSqlPaaSServiceTier.NextGenGeneralPurpose ?
						constants.NEXTGEN_GENERAL_PURPOSE
						: constants.BUSINESS_CRITICAL;
				const hardwareType = recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.Gen5
					? constants.GEN5
					: recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.PremiumSeries
						? constants.PREMIUM_SERIES
						: constants.PREMIUM_SERIES_MEMORY_OPTIMIZED;

				return [constants.MI_CONFIGURATION_PREVIEW(
					hardwareType,
					serviceTier,
					recommendation.targetSku.computeSize!,
					recommendation.targetSku.storageMaxSizeInMb! / 1024)];
			}
	}
}

// Return true if Recommendations are ready and does not  have errors.
export function hasRecommendations(model: MigrationStateModel): boolean {
	return model._skuRecommendationResults?.recommendations
		&& !model._skuRecommendationResults?.recommendationError
		? true
		: false;
}

export async function clearDropDownWithLoading(dropDown: DropDownComponent): Promise<void> {
	dropDown.loading = true;
	await dropDown.updateProperty('value', undefined);
	await dropDown.updateProperty('values', []);
}

export async function promptUserForFile(filters: { [name: string]: string[] }): Promise<string> {
	const options: vscode.OpenDialogOptions = {
		defaultUri: vscode.Uri.file(getUserHome()!),
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		filters: filters,
	};

	const fileUris = await vscode.window.showOpenDialog(options);
	if (fileUris && fileUris.length > 0 && fileUris[0]) {
		return fileUris[0].fsPath;
	}

	return '';
}

export function generateTemplatePath(model: MigrationStateModel, targetType: MigrationTargetType, batchNumber: number): string {
	let date = new Date().toISOString().split('T')[0];
	let time = new Date().toLocaleTimeString('it-IT');
	let fileName;

	// source instance same would be same across all recommendations MI/DB/VM.
	let instanceName = model._skuRecommendationResults.recommendations?.sqlMiRecommendationResults[0].sqlInstanceName;

	if (model._armTemplateResult.templates?.length! > 1 && targetType === MigrationTargetType.SQLDB) {
		fileName = `ARMTemplate-${targetType}-${instanceName}-${date}-${time}-batch${batchNumber}.json`;
	}
	else {
		fileName = `ARMTemplate-${targetType}-${instanceName}-${date}-${time}.json`;
	}

	// replacing invalid characters for a file name.
	fileName = fileName.replace(/[/\\?%*:|"<>]/g, '-');
	return fileName;
}

export async function refreshIntegrationRuntimeTable(_view: ModelView, _integrationRuntimeTable: DeclarativeTableComponent,
	migrationServiceMonitoringStatus: azure.IntegrationRuntimeMonitoringData): Promise<void> {
	if (migrationServiceMonitoringStatus.nodes.length === 0) {
		const data: DeclarativeTableCellValue[][] = [
			[
				{ value: " " },
				{ value: constants.NO_NODE_FOUND },
				{ value: " " },
				{ value: " " }
			]
		];
		await _integrationRuntimeTable.setDataValues(data);
	}
	else {
		const data = migrationServiceMonitoringStatus.nodes.map(eachNode => {
			return [
				{ value: eachNode.nodeName },
				{ value: eachNode.status },
				{ value: eachNode.ipAddress === '' ? '--' : eachNode.ipAddress },
				{ value: eachNode.version }
			]
		});
		await _integrationRuntimeTable.setDataValues(data);
	}
}

