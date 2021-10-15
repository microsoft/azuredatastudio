/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MigrationContext } from '../models/migrationLocalStorage';
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
	return migration.migrationContext.properties.offlineConfiguration?.offline?.valueOf() ? loc.OFFLINE : loc.OFFLINE;
}
