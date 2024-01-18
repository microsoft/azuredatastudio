/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from 'azurecore';
import { AzureSqlDatabase, AzureSqlDatabaseServer, IntegrationRuntimeNode, SqlManagedInstance, SqlVMServer, StorageAccount, Subscription } from './azure';
import { generateGuid, MigrationTargetType } from './utils';
import * as utils from '../api/utils';
import { TelemetryAction, TelemetryViews, logError } from '../telemetry';
import * as constants from '../constants/strings';
import { NetworkInterfaceModel, PrivateEndpointConnection } from './dataModels/azure/networkInterfaceModel';

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

// NOTES: Converting the size to BIGINT is need to handle the large database scenarios.
// Size column in sys.master_files represents the number of pages and each page is 8 KB
// The end result is size in MB, 8/1024 = 1/128.
const query_databases_with_size = `
	WITH
		db_size
		AS
		(
			SELECT database_id, CAST(SUM(CAST(size as BIGINT)) / 128 AS BIGINT) size
			FROM sys.master_files with (nolock)
			GROUP BY database_id
		)
	SELECT name, state_desc AS state, db_size.size, collation_name
	FROM sys.databases with (nolock) LEFT JOIN db_size ON sys.databases.database_id = db_size.database_id
	WHERE sys.databases.state = 0
	`;

const query_login_tables_sql = `
	SELECT
		sp.name as login,
		sp.type_desc as login_type,
		sp.default_database_name,
		case when sp.is_disabled = 1 then 'Disabled' else 'Enabled' end as status
	FROM sys.server_principals sp
	LEFT JOIN sys.sql_logins sl ON sp.principal_id = sl.principal_id
	WHERE sp.type NOT IN ('G', 'R') AND sp.type_desc IN (
		'SQL_LOGIN'
	) AND sp.name NOT LIKE '##%##'
	ORDER BY sp.name;`;

const query_login_tables_include_windows_auth_sql = `
	SELECT
		sp.name as login,
		sp.type_desc as login_type,
		sp.default_database_name,
		case when sp.is_disabled = 1 then 'Disabled' else 'Enabled' end as status
	FROM sys.server_principals sp
	LEFT JOIN sys.sql_logins sl ON sp.principal_id = sl.principal_id
	WHERE sp.type NOT IN ('G', 'R') AND sp.type_desc IN (
		'SQL_LOGIN', 'WINDOWS_LOGIN'
	) AND sp.name NOT LIKE '##%##'
	ORDER BY sp.name;`;

const query_is_sys_admin_sql = `SELECT IS_SRVROLEMEMBER('sysadmin');`;

export const excludeDatabases: string[] = [
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

export interface SourceDatabaseInfo {
	databaseName: string;
	databaseCollation: string;
	databaseState: number;
	databaseSizeInMB: string;
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
	enableSchemaMigration: boolean;
	hasMissingTables: boolean;
	isSchemaMigrationSupported: boolean;
}

export interface LoginTableInfo {
	loginName: string;
	loginType: string;
	defaultDatabaseName: string;
	status: string;
}

export const SchemaMigrationRequiredIntegrationRuntimeMinimumVersion: IntegrationRuntimeVersionInfo = {
	major: "5",
	minor: "37",
	build: "8767",
	revision: "4"
}

export interface IntegrationRuntimeVersionInfo {
	major: string;
	minor: string;
	build: string;
	revision: string;
}

export async function getSourceConnectionProfile(): Promise<azdata.connection.ConnectionProfile> {
	return await azdata.connection.getCurrentConnection();
}

export async function getSourceConnectionId(): Promise<string> {
	return (await getSourceConnectionProfile()).connectionId;
}

export async function getSourceConnectionServerInfo(): Promise<azdata.ServerInfo> {
	return await azdata.connection.getServerInfo(await getSourceConnectionId());
}

export async function getSourceConnectionUri(): Promise<string> {
	return await azdata.connection.getUriForConnection(await getSourceConnectionId());
}

export async function getSourceConnectionCredentials(): Promise<{ [name: string]: string }> {
	return await azdata.connection.getCredentials(await getSourceConnectionId());
}

export async function getSourceConnectionQueryProvider(): Promise<azdata.QueryProvider> {
	return azdata.dataprotocol.getProvider<azdata.QueryProvider>(
		(await getSourceConnectionProfile()).providerId,
		azdata.DataProviderType.QueryProvider);
}

export function getEncryptConnectionValue(connection: azdata.connection.ConnectionProfile): boolean {
	return connection?.options?.encrypt === true || connection?.options?.encrypt === 'true';
}

export function getTrustServerCertificateValue(connection: azdata.connection.ConnectionProfile): boolean {
	return connection?.options?.trustServerCertificate === true || connection?.options?.trustServerCertificate === 'true';
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
			connectionName: '',
			server: serverName,
			database: databaseName,
			authenticationType: azdata.connection.AuthenticationType.SqlLogin,
			user: userName,
			password: password,
			connectionTimeout: 60,
			columnEncryptionSetting: 'Enabled',
			// when connecting to a target Azure SQL DB, use true/false
			encrypt: true,
			trustServerCertificate: false,
			connectRetryCount: '1',
			connectRetryInterval: '10',
			applicationName: 'azdata-sqlMigration',
			azureTenantId: tenantId,
			originalDatabase: databaseName,
			databaseDisplayName: databaseName,
		},
	};
}

/**
 * This function returns the Target Connection profile with port
 * @param serverName Target server name
 * @param azureResourceId Azure resource Id
 * @param userName Target username
 * @param password Target password
 * @param port Target port
 * @param encryptConnection Encrypt connection
 * @param trustServerCert Trust server certificate
 * @returns Target Connection Profile
 */
export function getTargetConnectionProfileWithPort(
	serverName: string,
	azureResourceId: string,
	userName: string,
	password: string,
	port: string,
	encryptConnection: boolean,
	trustServerCert: boolean): azdata.IConnectionProfile {

	let targetConnectionProfile = getTargetConnectionProfile(
		serverName,
		azureResourceId,
		userName,
		password,
		encryptConnection,
		trustServerCert);

	targetConnectionProfile.options.port = port;
	return targetConnectionProfile
}

/**
 * This function returns the Target Connection profile
 * @param serverName Target server name
 * @param azureResourceId Azure resource Id
 * @param userName Target username
 * @param password Target password
 * @param encryptConnection Encrypt connection
 * @param trustServerCert Trust server certificate
 * @returns Target Connection Profile
 */
export function getTargetConnectionProfile(
	serverName: string,
	azureResourceId: string,
	userName: string,
	password: string,
	encryptConnection: boolean,
	trustServerCert: boolean): azdata.IConnectionProfile {

	const connectId = generateGuid();
	return {
		serverName: serverName,
		id: connectId,
		connectionName: connectId,
		azureResourceId: azureResourceId,
		userName: userName,
		password: password,
		authenticationType: azdata.connection.AuthenticationType.SqlLogin,
		savePassword: false,
		groupFullName: connectId,
		groupId: connectId,
		providerName: 'MSSQL',
		saveProfile: false,
		options: {
			connectionName: connectId,
			server: serverName,
			authenticationType: azdata.connection.AuthenticationType.SqlLogin,
			user: userName,
			password: password,
			connectionTimeout: 60,
			columnEncryptionSetting: 'Enabled',
			encrypt: encryptConnection,
			trustServerCertificate: trustServerCert,
			connectRetryCount: '1',
			connectRetryInterval: '10',
			applicationName: 'azdata-sqlMigration',
		},
	}
}

export async function getSourceConnectionString(): Promise<string> {
	return await azdata.connection.getConnectionString((await getSourceConnectionProfile()).connectionId, true);
}

export async function getTargetConnectionString(
	serverName: string,
	azureResourceId: string,
	username: string,
	password: string,
	port: string,
	encryptConnection: boolean,
	trustServerCertificate: boolean): Promise<string> {

	const connectionProfile = getTargetConnectionProfileWithPort(
		serverName,
		azureResourceId,
		username,
		password,
		port,
		encryptConnection,
		trustServerCertificate);

	const result = await azdata.connection.connect(connectionProfile, false, false);
	if (result.connected && result.connectionId) {
		return azdata.connection.getConnectionString(result.connectionId, true);
	}

	return '';
}

export async function collectSourceDatabaseTableInfo(sourceDatabase: string): Promise<TableInfo[]> {
	const ownerUri = await azdata.connection.getUriForConnection((await getSourceConnectionProfile()).connectionId);
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

	const connectionProfile = getTargetConnectionProfile(
		targetServer.properties.fullyQualifiedDomainName,
		targetServer.id,
		userName,
		password,
		// when connecting to a target Azure SQL DB, use true/false
		true /* encryptConnection */,
		false /* trustServerCertificate */);

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
				enableSchemaMigration: false,
				// Default as true so that the initial text is 'Not selected'
				// in the schema column
				hasMissingTables: true,
				// Default as true. Assume that the active IR node is latest version.
				isSchemaMigrationSupported: true
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
		database => !excludeDatabases.includes(database.name)) ?? [];
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

export async function getDatabasesList(connectionProfile: azdata.connection.ConnectionProfile): Promise<azdata.DatabaseInfo[]> {
	const ownerUri = await azdata.connection.getUriForConnection(connectionProfile.connectionId);
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
		connectionProfile.providerId,
		azdata.DataProviderType.QueryProvider);

	try {
		const queryResult = await queryProvider.runQueryAndReturn(ownerUri, query_databases_with_size);

		const result = queryResult.rows.map(row => {
			return {
				options: {
					name: getSqlString(row[0]),
					state: getSqlString(row[1]),
					sizeInMB: getSqlString(row[2]),
					collation: getSqlString(row[3])
				}
			};
		}) ?? [];

		return result;
	} catch (error) {
		logError(TelemetryViews.Utils, TelemetryAction.GetDatabasesListFailed, error);

		return [];
	}
}

export async function collectSourceLogins(
	sourceConnectionId: string,
	includeWindowsAuth: boolean = true): Promise<LoginTableInfo[]> {
	const ownerUri = await azdata.connection.getUriForConnection(sourceConnectionId);
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
		'MSSQL',
		azdata.DataProviderType.QueryProvider);

	const query = includeWindowsAuth ? query_login_tables_include_windows_auth_sql : query_login_tables_sql;
	const results = await queryProvider.runQueryAndReturn(
		ownerUri,
		query);

	return results.rows.map(row => {
		return {
			loginName: getSqlString(row[0]),
			loginType: getSqlString(row[1]),
			defaultDatabaseName: getSqlString(row[2]),
			status: getSqlString(row[3]),
		};
	}) ?? [];
}

export async function collectTargetLogins(
	serverName: string,
	azureResourceId: string,
	userName: string,
	password: string,
	port: string,
	includeWindowsAuth: boolean = true): Promise<string[]> {

	const connectionProfile = getTargetConnectionProfileWithPort(
		serverName,
		azureResourceId,
		userName,
		password,
		port,
		// for login migration, connect to target Azure SQL with true/true
		// to-do: take as input from the user, should be true/false for DB/MI but true/true for VM
		true /* encryptConnection */,
		true /* trustServerCertificate */);

	const result = await azdata.connection.connect(connectionProfile, false, false);
	if (result.connected && result.connectionId) {
		const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
			'MSSQL',
			azdata.DataProviderType.QueryProvider);

		const query = includeWindowsAuth ? query_login_tables_include_windows_auth_sql : query_login_tables_sql;
		const ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
		const results = await queryProvider.runQueryAndReturn(
			ownerUri,
			query);

		return results.rows.map(row => getSqlString(row[0])) ?? [];
	}

	const errorMessage = constants.COLLECTING_TARGET_LOGINS_FAILED(result.errorCode ?? 0);
	const error = new Error(result.errorMessage);
	logError(TelemetryViews.LoginMigrationWizard, errorMessage, error);
	throw error;
}

export async function isSourceConnectionSysAdmin(): Promise<boolean> {
	const sourceConnectionId = await getSourceConnectionId();
	const ownerUri = await azdata.connection.getUriForConnection(sourceConnectionId);
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
		'MSSQL',
		azdata.DataProviderType.QueryProvider);

	const results = await queryProvider.runQueryAndReturn(
		ownerUri,
		query_is_sys_admin_sql);

	return getSqlBoolean(results.rows[0][0]);
}

export async function canTargetConnectToStorageAccount(
	targetType: MigrationTargetType,
	targetServer: SqlManagedInstance | SqlVMServer | AzureSqlDatabaseServer,
	storageAccount: StorageAccount,
	account: azdata.Account,
	subscription: Subscription): Promise<boolean> {

	// additional ARM properties of storage accounts which aren't exposed in azurecore
	interface StorageAccountAdditionalProperties {
		publicNetworkAccess: string,
		networkAcls: NetworkRuleSet,
		privateEndpointConnections: PrivateEndpointConnection[]
	}
	interface NetworkRuleSet {
		virtualNetworkRules: VirtualNetworkRule[],
		defaultAction: string
	}
	interface VirtualNetworkRule {
		id: string,
		state: string,
		action: string
	}

	const ENABLED = 'Enabled';
	const ALLOW = 'Allow';

	const storageAccountProperties: StorageAccountAdditionalProperties = (storageAccount as any)['properties'];
	const storageAccountPublicAccessEnabled: boolean = storageAccountProperties.publicNetworkAccess ? storageAccountProperties.publicNetworkAccess.toLowerCase() === ENABLED.toLowerCase() : true;
	const storageAccountDefaultIsAllow: boolean = storageAccountProperties.networkAcls ? storageAccountProperties.networkAcls.defaultAction.toLowerCase() === ALLOW.toLowerCase() : true;
	const storageAccountWhitelistedVNets: string[] = storageAccountProperties.networkAcls ? storageAccountProperties.networkAcls.virtualNetworkRules.filter(rule => rule.action.toLowerCase() === ALLOW.toLowerCase()).map(rule => rule.id) : [];

	var enabledFromAllNetworks: boolean = false;
	var enabledFromWhitelistedVNet: boolean = false;
	var enabledFromPrivateEndpoint: boolean = false;

	// 1) check for access from all networks
	enabledFromAllNetworks = storageAccountPublicAccessEnabled && storageAccountDefaultIsAllow;

	switch (targetType) {
		case MigrationTargetType.SQLMI:
			const targetManagedInstanceVNet: string = (targetServer.properties as any)['subnetId'] ?? '';
			const targetManagedInstancePrivateEndpointConnections: PrivateEndpointConnection[] = (targetServer.properties as any)['privateEndpointConnections'] ?? [];
			const storageAccountPrivateEndpointConnections: PrivateEndpointConnection[] = storageAccountProperties.privateEndpointConnections ?? [];

			// 2) check for access from whitelisted vnet
			if (storageAccountWhitelistedVNets.length > 0) {
				enabledFromWhitelistedVNet = storageAccountWhitelistedVNets.some(vnet => vnet.toLowerCase() === targetManagedInstanceVNet.toLowerCase());
			}

			// 3) check for access from private endpoint
			if (targetManagedInstancePrivateEndpointConnections.length > 0) {
				enabledFromPrivateEndpoint = storageAccountPrivateEndpointConnections.some(async privateEndpointConnection => {
					const privateEndpoint = await NetworkInterfaceModel.getPrivateEndpoint(account, subscription, privateEndpointConnection.id);
					const privateEndpointSubnet = privateEndpoint.properties.subnet ? privateEndpoint.properties.subnet.id : '';
					return NetworkInterfaceModel.getVirtualNetworkFromSubnet(privateEndpointSubnet).toLowerCase() === NetworkInterfaceModel.getVirtualNetworkFromSubnet(targetManagedInstanceVNet).toLowerCase();
				});
			}

			break;
		case MigrationTargetType.SQLVM:
			const targetVmNetworkInterfaces = Array.from((await NetworkInterfaceModel.getVmNetworkInterfaces(account, subscription, (targetServer as SqlVMServer))).values());
			const targetVmSubnets = targetVmNetworkInterfaces.map(networkInterface => {
				const ipConfigurations = networkInterface.properties.ipConfigurations ?? [];
				return ipConfigurations.map(ipConfiguration => ipConfiguration.properties.subnet.id.toLowerCase());
			}).flat();

			// 2) check for access from whitelisted vnet
			if (storageAccountWhitelistedVNets.length > 0) {
				enabledFromWhitelistedVNet = storageAccountWhitelistedVNets.some(vnet => targetVmSubnets.some(targetVnet => vnet.toLowerCase() === targetVnet.toLowerCase()));
			}

			break;
		default:
			return true;
	}

	return enabledFromAllNetworks || enabledFromWhitelistedVNet || enabledFromPrivateEndpoint;
}

export function getActiveIrVersions(irNodes: IntegrationRuntimeNode[]): IntegrationRuntimeVersionInfo[] {
	var irVersions: IntegrationRuntimeVersionInfo[] = [];
	irNodes.forEach(node => {
		if (node.status === constants.ONLINE) {
			const version = node.version.split(".");
			irVersions.push({ major: version[0], minor: version[1], build: version[2], revision: version[3] });
		}
	})
	return irVersions;
}

export function getActiveIrVersionsSupportingSchemaMigration(irNodes: IntegrationRuntimeNode[]): IntegrationRuntimeVersionInfo[] {
	var irVersions = getActiveIrVersions(irNodes);
	var irVersionsSupportingSchema: IntegrationRuntimeVersionInfo[] = [];
	irVersions.forEach(version => {
		if (isSchemaMigrationSupportedByVersion(version)) {
			irVersionsSupportingSchema.push(version);
		}
	})
	return irVersionsSupportingSchema;
}

export function getActiveIrVersionsNotSupportingSchemaMigration(irNodes: IntegrationRuntimeNode[]): IntegrationRuntimeVersionInfo[] {
	var irVersions = getActiveIrVersions(irNodes);
	var irVersionsNotSupportingSchema: IntegrationRuntimeVersionInfo[] = [];
	irVersions.forEach(version => {
		if (!isSchemaMigrationSupportedByVersion(version)) {
			irVersionsNotSupportingSchema.push(version);
		}
	})
	return irVersionsNotSupportingSchema;
}

export function isSchemaMigrationSupportedByVersion(version: IntegrationRuntimeVersionInfo): boolean {
	return version.major > SchemaMigrationRequiredIntegrationRuntimeMinimumVersion.major ||
		(version.major === SchemaMigrationRequiredIntegrationRuntimeMinimumVersion.major && version.minor >= SchemaMigrationRequiredIntegrationRuntimeMinimumVersion.minor);
}

export function areVersionsSame(irVersions: IntegrationRuntimeVersionInfo[]): boolean {
	const versions = irVersions.map(v => `${v.major}.${v.minor}.${v.build}.${v.revision}`);
	return versions.filter((n, i) => versions.indexOf(n) === i).length === 1;
}
