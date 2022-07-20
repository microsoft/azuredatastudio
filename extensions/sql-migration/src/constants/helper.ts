/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DatabaseMigration } from '../api/azure';
import { MigrationStatus } from '../models/migrationLocalStorage';
import { FileStorageType, MigrationMode, MigrationTargetType } from '../models/stateMachine';
import * as loc from './strings';

export enum SQLTargetAssetType {
	SQLMI = 'microsoft.sql/managedinstances',
	SQLVM = 'Microsoft.SqlVirtualMachine/sqlVirtualMachines',
	SQLDB = 'Microsoft.Sql/servers',
}

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

const _dateFormatter = new Intl.DateTimeFormat(
	undefined, {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
});

const _numberFormatter = new Intl.NumberFormat(
	undefined, {
	style: 'decimal',
	useGrouping: true,
	minimumIntegerDigits: 1,
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

export function formatDateTimeString(dateTime: string): string {
	return dateTime
		? _dateFormatter.format(new Date(dateTime))
		: '';
}

export function formatTime(miliseconds: number): string {
	if (miliseconds > 0) {
		// hh:mm:ss
		const matches = (new Date(miliseconds))?.toUTCString()?.match(/(\d\d:\d\d:\d\d)/) || [];
		return matches?.length > 0 ? matches[0] : '';
	}
	return '';
}

export function formatNumber(value: number): string {
	return value >= 0
		? _numberFormatter.format(value)
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
	switch (migration?.type) {
		case SQLTargetAssetType.SQLMI:
			return MigrationTargetType.SQLMI;
		case SQLTargetAssetType.SQLVM:
			return MigrationTargetType.SQLVM;
		case SQLTargetAssetType.SQLDB:
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

export function getMigrationStatus(migration: DatabaseMigration | undefined): string | undefined {
	return migration?.properties.migrationStatus
		?? migration?.properties.provisioningState;
}

export function hasMigrationOperationId(migration: DatabaseMigration | undefined): boolean {
	const migrationId = migration?.id ?? '';
	const migationOperationId = migration?.properties?.migrationOperationId ?? '';
	return migrationId.length > 0
		&& migationOperationId.length > 0;
}

export function canCancelMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return hasMigrationOperationId(migration)
		&& (status === MigrationStatus.InProgress ||
			status === MigrationStatus.Retriable ||
			status === MigrationStatus.Creating);
}

export function canDeleteMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return status === MigrationStatus.Canceled
		|| status === MigrationStatus.Failed
		|| status === MigrationStatus.Retriable
		|| status === MigrationStatus.Succeeded;
}

export function canRetryMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return status === MigrationStatus.Canceled
		|| status === MigrationStatus.Retriable
		|| status === MigrationStatus.Failed
		|| status === MigrationStatus.Succeeded;
}

export function canCutoverMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return hasMigrationOperationId(migration)
		&& status === MigrationStatus.InProgress
		&& isOnlineMigration(migration)
		&& isFullBackupRestored(migration);
}

export function isActiveMigration(migration: DatabaseMigration | undefined): boolean {
	const status = getMigrationStatus(migration);
	return status === MigrationStatus.Completing
		|| status === MigrationStatus.Retriable
		|| status === MigrationStatus.Creating
		|| status === MigrationStatus.InProgress;
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
