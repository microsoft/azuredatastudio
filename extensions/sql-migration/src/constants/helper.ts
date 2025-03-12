/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AzureResourceKind, DatabaseMigration } from '../api/azure';
import { DefaultSettingValue, MigrationTargetType } from '../api/utils';
import { FileStorageType, MigrationMode } from '../models/stateMachine';
import * as loc from './strings';

export enum SQLTargetAssetType {
	SQLMI = 'microsoft.sql/managedinstances',
	SQLVM = 'Microsoft.SqlVirtualMachine/sqlVirtualMachines',
	SQLDB = 'Microsoft.Sql/servers',
}

export const FileStorageTypeCodes = {
	FileShare: "FileShare",
	AzureBlob: "AzureBlob",
	None: "None",
};

export const BackupTypeCodes = {
	// Type of backup. The values match the output of a RESTORE HEADERONLY query.
	Unknown: "Unknown",
	Database: "Database",
	TransactionLog: "TransactionLog",
	File: "File",
	DifferentialDatabase: "DifferentialDatabase",
	DifferentialFile: "DifferentialFile",
	Partial: "Partial",
	DifferentialPartial: "DifferentialPartial",
};

export const InternalManagedDatabaseRestoreDetailsBackupSetStatusCodes = {
	None: "None",
	Skipped: "Skipped",
	Queued: "Queued",
	Restoring: "Restoring",
	Restored: "Restored",
};

export const InternalManagedDatabaseRestoreDetailsStatusCodes = {
	None: "None",                           // Something went wrong most likely.
	Initializing: "Initializing",           // Restore is initializing.
	NotStarted: "NotStarted",               // Restore not started
	SearchingBackups: "SearchingBackups",   // Searching for backups
	Restoring: "Restoring",                 // Restore is in progress
	RestorePaused: "RestorePaused",         // Restore is paused
	RestoreCompleted: "RestoreCompleted",   // Restore completed for all found log, but there may have more logs coming
	Waiting: "Waiting",                         // Waiting for new files to be uploaded or for Complete restore signal.
	CompletingMigration: "CompletingMigration", // Completing migration
	Cancelled: "Cancelled",                     // Restore cancelled.
	Failed: "Failed",                           // Restore failed.
	Completed: "Completed",                     // Database is restored and recovery is complete.
	Blocked: "Blocked",                         // Restore is temporarily blocked: "", awaiting for user to mitigate the issue.
};

export const ParallelCopyTypeCodes = {
	None: 'None',
	DynamicRange: 'DynamicRange',
	PhysicalPartitionsOfTable: 'PhysicalPartitionsOfTable',
};

export const PipelineStatusCodes = {
	// status codes: 'PreparingForCopy' | 'Copying' | 'CopyFinished' | 'RebuildingIndexes' | 'Succeeded' | 'Failed' |	'Canceled',
	PreparingForCopy: 'PreparingForCopy',
	Copying: 'Copying',
	CopyFinished: 'CopyFinished',
	RebuildingIndexes: 'RebuildingIndexes',
	Succeeded: 'Succeeded',
	Failed: 'Failed',
	Canceled: 'Canceled',

	// legacy status codes
	Queued: 'Queued',
	InProgress: 'InProgress',
	Cancelled: 'Cancelled',
};

export const LoginMigrationStatusCodes = {
	// status codes: 'InProgress' | 'Failed' | 'Succeeded'
	InProgress: 'InProgress',
	Succeeded: 'Succeeded',
	Failed: 'Failed',
};

export const ValidationErrorCodes = {
	// TODO: adding other error codes for troubleshooting
	SqlInfoValidationFailed: '2056'
};

// Color codes for Graph
export const ColorCodes = {
	NotReadyState_Red: "#E00B1C",
	ReadyState_Green: "#57A300",
	ReadyWithWarningState_Amber: "#DB7500"
}

export const IssueCategory = {
	Issue: "Issue",
	Warning: "Warning"
}

const _dateFormatter = new Intl.DateTimeFormat(
	undefined, {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
});

const _numberFormatterOneMinIntegers = new Intl.NumberFormat(
	undefined, {
	style: 'decimal',
	useGrouping: true,
	minimumIntegerDigits: 1,
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

const _numberFormatterTwoMinIntegers = new Intl.NumberFormat(
	undefined, {
	style: 'decimal',
	useGrouping: true,
	minimumIntegerDigits: 2,
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

export function formatSecondsIntoReadableTime(seconds: number) {
	const hours = seconds / (60 * 60);
	const absoluteHours = Math.floor(hours);
	const h = _numberFormatterTwoMinIntegers.format(absoluteHours);

	const minutesRemaining = (hours - absoluteHours) * 60;
	const absoluteMinutes = Math.floor(minutesRemaining);
	const m = _numberFormatterTwoMinIntegers.format(absoluteMinutes);

	const secondsRemaining = (minutesRemaining - absoluteMinutes) * 60;
	const absoluteSeconds = Math.floor(secondsRemaining);
	const s = _numberFormatterTwoMinIntegers.format(absoluteSeconds);

	return h + ':' + m + ':' + s;
}

export function formatDateTimeString(dateTime: string): string {
	return dateTime
		? _dateFormatter.format(new Date(dateTime))
		: '';
}

export function formatTime(miliseconds: number): string {
	if (miliseconds > 0) {
		// hh:mm:ss
		const matches = (new Date(miliseconds))?.toUTCString()?.match(/(\d\d:\d\d:\d\d)/) || [];
		return matches?.length > 0
			? matches[0] ?? ''
			: '';
	}
	return '';
}

export function formatNumber(value: number): string {
	return value >= 0
		? _numberFormatterOneMinIntegers.format(value)
		: '';
}

export function formatCopyThroughPut(value: number): string {
	return value >= 0
		? loc.sizeFormatter.format(value / 1024)
		: '';
}

export function formatSizeBytes(sizeBytes: number): string {
	return formatSizeKb(sizeBytes / 1024);
}

export function formatSizeKb(sizeKb: number): string {
	return loc.formatSizeMb(sizeKb / 1024);
}

export function getMigrationTargetType(migration: DatabaseMigration | undefined): string {
	const id = migration?.id?.toLowerCase() || '';
	if (id?.indexOf(SQLTargetAssetType.SQLMI.toLowerCase()) > -1) {
		return loc.SQL_MANAGED_INSTANCE;
	}
	else if (id?.indexOf(SQLTargetAssetType.SQLVM.toLowerCase()) > -1) {
		return loc.SQL_VIRTUAL_MACHINE;
	}
	else if (id?.indexOf(SQLTargetAssetType.SQLDB.toLowerCase()) > -1) {
		return loc.SQL_DATABASE;
	}
	return '';
}

export function getMigrationTargetTypeEnum(migration: DatabaseMigration | undefined): MigrationTargetType | undefined {
	switch (migration?.properties?.kind) {
		case AzureResourceKind.SQLMI:
			return MigrationTargetType.SQLMI;
		case AzureResourceKind.SQLVM:
			return MigrationTargetType.SQLVM;
		case AzureResourceKind.SQLDB:
			return MigrationTargetType.SQLDB;
		default:
			return undefined;
	}
}

export function getMigrationMode(migration: DatabaseMigration | undefined): string {
	return isOfflineMigation(migration)
		? loc.OFFLINE
		: loc.ONLINE;
}

export function getMigrationModeEnum(migration: DatabaseMigration | undefined): MigrationMode {
	return isOfflineMigation(migration)
		? MigrationMode.OFFLINE
		: MigrationMode.ONLINE;
}

export function isOfflineMigation(migration: DatabaseMigration | undefined): boolean {
	return migration?.properties?.offlineConfiguration?.offline === true;
}

export function isBlobMigration(migration: DatabaseMigration | undefined): boolean {
	return migration?.properties?.backupConfiguration?.sourceLocation?.fileStorageType === FileStorageType.AzureBlob;
}

export function isShirMigration(migration?: DatabaseMigration): boolean {
	return isLogicalMigration(migration)
		|| isFileShareMigration(migration);
}

export function isLogicalMigration(migration?: DatabaseMigration): boolean {
	return migration?.properties?.kind === AzureResourceKind.ORACLETOSQLDB
		|| migration?.properties?.kind === AzureResourceKind.SQLDB;
}

export function isFileShareMigration(migration?: DatabaseMigration): boolean {
	return migration?.properties?.backupConfiguration?.sourceLocation?.fileStorageType === FileStorageTypeCodes.FileShare;
}

export function isTargetType(migration?: DatabaseMigration, kind?: string): boolean {
	return migration?.properties?.kind === kind;
}

export function getMigrationStatus(migration: DatabaseMigration | undefined): string | undefined {
	return migration?.properties.migrationStatus
		?? migration?.properties.provisioningState;
}

export function getMigrationStatusString(migration: DatabaseMigration | undefined): string {
	const migrationStatus = getMigrationStatus(migration) ?? DefaultSettingValue;
	return loc.StatusLookup[migrationStatus] ?? migrationStatus;
}

export function hasMigrationOperationId(migration: DatabaseMigration | undefined): boolean {
	const migrationId = migration?.id ?? '';
	const migationOperationId = migration?.properties?.migrationOperationId ?? '';
	return migrationId.length > 0
		&& migationOperationId.length > 0;
}

export function getMigrationBackupLocation(migration: DatabaseMigration): string | undefined {
	return migration?.properties?.backupConfiguration?.sourceLocation?.fileShare?.path
		?? migration?.properties?.backupConfiguration?.sourceLocation?.azureBlob?.blobContainerName
		?? migration?.properties?.migrationStatusDetails?.blobContainerName;
}

export function getMigrationFullBackupFiles(migration: DatabaseMigration): string | undefined {
	return migration?.properties?.migrationStatusDetails?.fullBackupSetInfo?.listOfBackupFiles?.map(file => file.fileName).join(',');
}

export function hasRestoreBlockingReason(migration: DatabaseMigration | undefined): boolean {
	return (migration?.properties.migrationStatusWarnings?.restoreBlockingReason ?? '').length > 0;
}

export function canCancelMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return hasMigrationOperationId(migration)
		&& (status === loc.MigrationState.InProgress
			|| status === loc.MigrationState.Retriable
			|| status === loc.MigrationState.Creating
			|| status === loc.MigrationState.ReadyForCutover
			|| status === loc.MigrationState.UploadingFullBackup
			|| status === loc.MigrationState.UploadingLogBackup
			|| status === loc.MigrationState.Restoring);
}

export function canDeleteMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return status === loc.MigrationState.Canceled
		|| status === loc.MigrationState.Failed
		|| status === loc.MigrationState.Retriable
		|| status === loc.MigrationState.Succeeded;
}

export function canRetryMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return status === loc.MigrationState.Retriable;
}

export function canRestartMigrationWizard(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return status === loc.MigrationState.Canceled
		|| status === loc.MigrationState.Retriable
		|| status === loc.MigrationState.Failed
		|| status === loc.MigrationState.Succeeded;
}

export function canCutoverMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return hasMigrationOperationId(migration)
		&& isOnlineMigration(migration)
		&& (status === loc.MigrationState.ReadyForCutover || status === loc.MigrationState.InProgress)
		&& isFullBackupRestored(migration)
		// if MI migration, must have no restore blocking reason
		&& !(getMigrationTargetType(migration) === loc.SQL_MANAGED_INSTANCE && hasRestoreBlockingReason(migration));
}

export function isActiveMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return status === loc.MigrationState.Completing
		|| status === loc.MigrationState.Retriable
		|| status === loc.MigrationState.Creating
		|| status === loc.MigrationState.InProgress
		|| status === loc.MigrationState.ReadyForCutover
		|| status === loc.MigrationState.UploadingFullBackup
		|| status === loc.MigrationState.UploadingLogBackup
		|| status === loc.MigrationState.Restoring;
}

export function isFullBackupRestored(migration: DatabaseMigration | undefined): boolean {
	const fileName = migration?.properties?.migrationStatusDetails?.lastRestoredFilename ?? '';
	return migration?.properties?.migrationStatusDetails?.isFullBackupRestored
		|| fileName.length > 0;
}

export function isOnlineMigration(migration: DatabaseMigration | undefined): boolean {
	return getMigrationModeEnum(migration) === MigrationMode.ONLINE;
}

export function selectDatabasesFromList(selectedDbs: string[], databaseTableValues: azdata.DeclarativeTableCellValue[][]): azdata.DeclarativeTableCellValue[][] {
	const TABLE_CHECKBOX_INDEX = 0;
	const TABLE_DB_NAME_INDEX = 1;
	const sourceDatabaseNames = selectedDbs?.map(dbName => dbName.toLocaleLowerCase()) || [];
	if (sourceDatabaseNames?.length > 0) {
		for (let i in databaseTableValues) {
			const row = databaseTableValues[i];
			const dbName = (row[TABLE_DB_NAME_INDEX].value as string)?.toLocaleLowerCase();
			if (sourceDatabaseNames.indexOf(dbName) > -1) {
				row[TABLE_CHECKBOX_INDEX].value = true;
			}
		}
	}
	return databaseTableValues;
}

export function getMigrationType(migration: DatabaseMigration | undefined): string {
	// If MI or VM migration, the data type is schema + data
	var targetType = getMigrationTargetTypeEnum(migration);
	if (targetType === MigrationTargetType.SQLMI || targetType === MigrationTargetType.SQLVM) {
		return loc.BACKUP_AND_RESTORE;
	}

	var enableSchema = migration?.properties?.sqlSchemaMigrationConfiguration?.enableSchemaMigration ?? false;
	var enableData = migration?.properties?.sqlDataMigrationConfiguration?.enableDataMigration ?? false;
	return enableSchema && enableData
		? loc.SCHEMA_AND_DATA
		: enableSchema ? loc.SCHEMA_ONLY : loc.DATA_ONLY;
}

export function getSchemaMigrationStatus(migration: DatabaseMigration | undefined): string | undefined {
	return migration?.properties?.migrationStatusDetails?.sqlSchemaMigrationStatus?.status;
}

export function getSchemaMigrationStatusString(migration: DatabaseMigration | undefined): string {
	const schemaMigrationStatus = getSchemaMigrationStatus(migration) ?? DefaultSettingValue;
	return loc.SchemaMigrationStatusLookup[schemaMigrationStatus] ?? schemaMigrationStatus;
}

export const forbiddenStatusCode = 403;
