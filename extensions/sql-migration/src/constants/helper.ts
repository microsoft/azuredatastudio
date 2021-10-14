/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MigrationContext } from '../models/migrationLocalStorage';
import { MigrationMode } from '../models/stateMachine';
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

export function getMigrationMode(migration: MigrationContext): string {
	return migration.migrationContext.properties.autoCutoverConfiguration?.autoCutover?.valueOf() ? loc.OFFLINE : loc.OFFLINE;
}

export function getMigrationModeEnum(migration: MigrationContext): MigrationMode {
	return migration.migrationContext.properties.autoCutoverConfiguration?.autoCutover?.valueOf() ? MigrationMode.OFFLINE : MigrationMode.OFFLINE;
}
