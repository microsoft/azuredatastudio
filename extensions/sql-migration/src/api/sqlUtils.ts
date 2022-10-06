/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from 'azurecore';
import { AzureSqlDatabase, AzureSqlDatabaseServer } from './azure';
import { generateGuid } from './utils';
import * as utils from '../api/utils';
import { TelemetryAction, TelemetryViews, logError } from '../telemtery';

const query_database_tables_sql = `
	SELECT
		DB_NAME() as database_name,
		QUOTENAME(SCHEMA_NAME(o.schema_id)) + '.' + QUOTENAME(o.name) AS table_name,
		SUM(p.Rows) AS row_count
	FROM
		sys.objects AS o
	INNER JOIN sys.partitions AS p
		ON o.object_id = p.object_id
	WHERE
		o.type = 'U'
		AND o.is_ms_shipped = 0x0
		AND index_id < 2
	GROUP BY
		o.schema_id,
		o.name
	ORDER BY table_name;`;

const query_target_databases_sql = `
	SELECT
		('servername') as server_name,
		SERVERPROPERTY ('collation') as server_collation,
		db.database_id as database_id,
		db.name as database_name,
		db.collation_name as database_collation,
		CASE WHEN 'A' = 'a' THEN 0 ELSE 1 END as is_server_case_sensitive,
		db.state as database_state,
		db.is_read_only	as is_read_only
	FROM sys.databases db
	WHERE
		db.name not in ('master', 'tempdb', 'model', 'msdb')
		AND is_distributor <> 1
	ORDER BY db.name;`;

const query_databases_with_size = `
	WITH
		db_size
		AS
		(
			SELECT database_id, CAST(SUM(size) * 8.0 / 1024 AS INTEGER) size
			FROM sys.master_files with (nolock)
			GROUP BY database_id
		)
	SELECT name, state_desc AS state, db_size.size
	FROM sys.databases with (nolock) LEFT JOIN db_size ON sys.databases.database_id = db_size.database_id
	WHERE sys.databases.state = 0
	`;

export const excludeDatabses: string[] = [
	'master',
	'tempdb',
	'msdb',
	'model'
];

export interface TableInfo {
	databaseName: string;
	tableName: string;
	rowCount: number;
	selectedForMigration: boolean;
}

export interface TargetDatabaseInfo {
	serverName: string;
	serverCollation: string;
	databaseId: string;
	databaseName: string;
	databaseCollation: string;
	isServerCaseSensitive: boolean;
	databaseState: number;
	isReadOnly: boolean;
	sourceTables: Map<string, TableInfo>;
	targetTables: Map<string, TableInfo>;
}

function getSqlDbConnectionProfile(
	serverName: string,
	tenantId: string,
	databaseName: string,
	userName: string,
	password: string): azdata.IConnectionProfile {
	return {
		id: generateGuid(),
		providerName: 'MSSQL',
		connectionName: '',
		serverName: serverName,
		databaseName: databaseName,
		userName: userName,
		password: password,
		authenticationType: azdata.connection.AuthenticationType.SqlLogin,
		savePassword: false,
		saveProfile: false,
		options: {
			conectionName: '',
			server: serverName,
			database: databaseName,
			authenticationType: azdata.connection.AuthenticationType.SqlLogin,
			user: userName,
			password: password,
			connectionTimeout: 60,
			columnEncryptionSetting: 'Enabled',
			encrypt: true,
			trustServerCertificate: false,
			connectRetryCount: '1',
			connectRetryInterval: '10',
			applicationName: 'azdata',
			azureTenantId: tenantId,
			originalDatabase: databaseName,
			databaseDisplayName: databaseName,
		},
	};
}

function getConnectionProfile(
	serverName: string,
	azureResourceId: string,
	userName: string,
	password: string): azdata.IConnectionProfile {
	return {
		serverName: serverName,
		id: generateGuid(),
		connectionName: undefined,
		azureResourceId: azureResourceId,
		userName: userName,
		password: password,
		authenticationType: azdata.connection.AuthenticationType.SqlLogin,
		savePassword: false,
		groupFullName: '',
		groupId: '',
		providerName: 'MSSQL',
		saveProfile: false,
		options: {
			conectionName: '',
			server: serverName,
			authenticationType: azdata.connection.AuthenticationType.SqlLogin,
			user: userName,
			password: password,
			connectionTimeout: 60,
			columnEncryptionSetting: 'Enabled',
			encrypt: true,
			trustServerCertificate: false,
			connectRetryCount: '1',
			connectRetryInterval: '10',
			applicationName: 'azdata',
		},
	};
}

export async function collectSourceDatabaseTableInfo(sourceConnectionId: string, sourceDatabase: string): Promise<TableInfo[]> {
	const ownerUri = await azdata.connection.getUriForConnection(sourceConnectionId);
	const connectionProvider = azdata.dataprotocol.getProvider<azdata.ConnectionProvider>(
		'MSSQL',
		azdata.DataProviderType.ConnectionProvider);
	await connectionProvider.changeDatabase(ownerUri, sourceDatabase);
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
		'MSSQL',
		azdata.DataProviderType.QueryProvider);

	const results = await queryProvider.runQueryAndReturn(
		ownerUri,
		query_database_tables_sql);

	return results.rows.map(row => {
		return {
			databaseName: getSqlString(row[0]),
			tableName: getSqlString(row[1]),
			rowCount: getSqlNumber(row[2]),
			selectedForMigration: false,
		};
	}) ?? [];
}

export async function collectTargetDatabaseTableInfo(
	targetServer: AzureSqlDatabaseServer,
	targetDatabaseName: string,
	tenantId: string,
	userName: string,
	password: string): Promise<TableInfo[]> {
	const connectionProfile = getSqlDbConnectionProfile(
		targetServer.properties.fullyQualifiedDomainName,
		tenantId,
		targetDatabaseName,
		userName,
		password);

	const result = await azdata.connection.connect(connectionProfile, false, false);
	if (result.connected && result.connectionId) {
		const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
			'MSSQL',
			azdata.DataProviderType.QueryProvider);

		const ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
		const results = await queryProvider.runQueryAndReturn(
			ownerUri,
			query_database_tables_sql);

		return results.rows.map(row => {
			return {
				databaseName: getSqlString(row[0]),
				tableName: getSqlString(row[1]),
				rowCount: getSqlNumber(row[2]),
				selectedForMigration: false,
			};
		}) ?? [];
	}

	throw new Error(result.errorMessage);
}

export async function collectTargetDatabaseInfo(
	targetServer: AzureSqlDatabaseServer,
	userName: string,
	password: string): Promise<TargetDatabaseInfo[]> {

	const connectionProfile = getConnectionProfile(
		targetServer.properties.fullyQualifiedDomainName,
		targetServer.id,
		userName,
		password);

	const result = await azdata.connection.connect(connectionProfile, false, false);
	if (result.connected && result.connectionId) {
		const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
			'MSSQL',
			azdata.DataProviderType.QueryProvider);

		const ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
		const results = await queryProvider.runQueryAndReturn(
			ownerUri,
			query_target_databases_sql);

		return results.rows.map(row => {
			return {
				serverName: getSqlString(row[0]),
				serverCollation: getSqlString(row[1]),
				databaseId: getSqlString(row[2]),
				databaseName: getSqlString(row[3]),
				databaseCollation: getSqlString(row[4]),
				isServerCaseSensitive: getSqlBoolean(row[5]),
				databaseState: getSqlNumber(row[6]),
				isReadOnly: getSqlBoolean(row[7]),
				sourceTables: new Map(),
				targetTables: new Map(),
			};
		}) ?? [];
	}

	throw new Error(result.errorMessage);
}

export async function collectAzureTargetDatabases(
	account: azdata.Account,
	subscription: azureResource.AzureResourceSubscription,
	resourceGroup: string,
	targetServerName: string,
): Promise<AzureSqlDatabase[]> {
	const databaseList: AzureSqlDatabase[] = [];
	if (resourceGroup && targetServerName) {
		databaseList.push(...
			await utils.getAzureSqlDatabases(
				account,
				subscription,
				resourceGroup,
				targetServerName));
	}
	return databaseList.filter(
		database => !excludeDatabses.includes(database.name)) ?? [];
}

export function getSqlString(value: azdata.DbCellValue): string {
	return value.isNull ? '' : value.displayValue;
}

export function getSqlNumber(value: azdata.DbCellValue): number {
	return value.isNull ? 0 : parseInt(value.displayValue);
}

export function getSqlBoolean(value: azdata.DbCellValue): boolean {
	return value.isNull ? false : value.displayValue === '1';
}

export async function getDatabasesList(sourceConnectionId: string): Promise<azdata.DatabaseInfo[]> {
	const ownerUri = await azdata.connection.getUriForConnection(sourceConnectionId);
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
		'MSSQL',
		azdata.DataProviderType.QueryProvider);

	try {
		const queryResult = await queryProvider.runQueryAndReturn(ownerUri, query_databases_with_size);

		const result = queryResult.rows.map(row => {
			return {
				options: {
					name: getSqlString(row[0]),
					state: getSqlString(row[1]),
					sizeInMB: getSqlString(row[2]),
				}
			};
		}) ?? [];

		return result;
	} catch (error) {
		logError(TelemetryViews.Utils, TelemetryAction.GetDatabasesListFailed, error);

		return [];
	}
}
