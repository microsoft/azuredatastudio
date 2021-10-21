/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
