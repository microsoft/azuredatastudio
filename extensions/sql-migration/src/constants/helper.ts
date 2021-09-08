
import * as azdata from 'azdata';
import { getSqlServerName } from '../api/utils';
import { MigrationContext } from '../models/migrationLocalStorage';
import * as loc from './strings';

export function getMigrationTargetType(migration: MigrationContext): string {
	return migration.targetManagedInstance.type === 'microsoft.sql/managedinstances'
		? loc.SQL_MANAGED_INSTANCE
		: loc.SQL_VIRTUAL_MACHINE;
}

export function getMigrationMode(migration: MigrationContext): string {
	return migration.migrationContext.properties.autoCutoverConfiguration?.autoCutover?.valueOf() ? loc.OFFLINE : loc.OFFLINE;
}

export async function getSqlServerVersion(): Promise<string> {
	const sqlServerInfo = await azdata.connection.getServerInfo((await azdata.connection.getCurrentConnection()).connectionId);
	const versionName = getSqlServerName(sqlServerInfo.serverMajorVersion!);
	const sqlServerVersion = versionName ? versionName : sqlServerInfo.serverVersion;
	return sqlServerVersion;
}
