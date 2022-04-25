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

export function getMigrationTargetType(migration: DatabaseMigration): string {
	const id = migration.id?.toLowerCase();
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

export function getMigrationTargetTypeEnum(migration: DatabaseMigration): MigrationTargetType | undefined {
	switch (migration.type) {
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

export function getMigrationMode(migration: DatabaseMigration): string {
	return isOfflineMigation(migration)
		? loc.OFFLINE
		: loc.ONLINE;
}

export function getMigrationModeEnum(migration: DatabaseMigration): MigrationMode {
	return isOfflineMigation(migration)
		? MigrationMode.OFFLINE
		: MigrationMode.ONLINE;
}

export function isOfflineMigation(migration: DatabaseMigration): boolean {
	return migration.properties.offlineConfiguration?.offline === true;
}

export function isBlobMigration(migration: DatabaseMigration): boolean {
	return migration?.properties?.backupConfiguration?.sourceLocation?.fileStorageType === FileStorageType.AzureBlob;
}

export function getMigrationStatus(migration: DatabaseMigration): string {
	return migration.properties.migrationStatus
		?? migration.properties.provisioningState;
}


export function canRetryMigration(status: string | undefined): boolean {
	return status === undefined ||
		status === MigrationStatus.Failed ||
		status === MigrationStatus.Succeeded ||
		status === MigrationStatus.Canceled;
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
