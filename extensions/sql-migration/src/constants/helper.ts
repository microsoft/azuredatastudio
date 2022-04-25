/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationContext, MigrationStatus } from '../models/migrationLocalStorage';
import { MigrationMode, MigrationTargetType } from '../models/stateMachine';
import * as loc from './strings';

export enum SQLTargetAssetType {
	SQLMI = 'microsoft.sql/managedinstances',
	SQLVM = 'Microsoft.SqlVirtualMachine/sqlVirtualMachines',
}

export function getMigrationTargetType(migration: MigrationContext): string {
	switch (migration.targetManagedInstance.type) {
		case SQLTargetAssetType.SQLMI:
			return loc.SQL_MANAGED_INSTANCE;
		case SQLTargetAssetType.SQLVM:
			return loc.SQL_VIRTUAL_MACHINE;
		default:
			return '';
	}
}

export function getMigrationTargetTypeEnum(migration: MigrationContext): MigrationTargetType | undefined {
	switch (migration.targetManagedInstance.type) {
		case SQLTargetAssetType.SQLMI:
			return MigrationTargetType.SQLMI;
		case SQLTargetAssetType.SQLVM:
			return MigrationTargetType.SQLVM;
		default:
			return undefined;
	}
}

export function getMigrationMode(migration: MigrationContext): string {
	return migration.migrationContext.properties.offlineConfiguration?.offline?.valueOf() ? loc.OFFLINE : loc.ONLINE;
}

export function getMigrationModeEnum(migration: MigrationContext): MigrationMode {
	return migration.migrationContext.properties.offlineConfiguration?.offline?.valueOf() ? MigrationMode.OFFLINE : MigrationMode.ONLINE;
}

export function canRetryMigration(status: string | undefined): boolean {
	return status === undefined ||
		status === MigrationStatus.Failed ||
		status === MigrationStatus.Succeeded ||
		status === MigrationStatus.Canceled;
}


const TABLE_CHECKBOX_INDEX = 0;
const TABLE_DB_NAME_INDEX = 1;
export function selectDatabasesFromList(selectedDbs: string[], databaseTableValues: azdata.DeclarativeTableCellValue[][]): azdata.DeclarativeTableCellValue[][] {
	const sourceDatabaseNames = selectedDbs?.map(dbName => dbName.toLocaleLowerCase()) || [];
	if (sourceDatabaseNames?.length > 0) {
		for (let i in databaseTableValues) {
			const row = databaseTableValues[i];
			const dbName = (row[TABLE_DB_NAME_INDEX].value as string).toLocaleLowerCase();
			if (sourceDatabaseNames.indexOf(dbName) > -1) {
				row[TABLE_CHECKBOX_INDEX].value = true;
			}
		}
	}
	return databaseTableValues;
}
