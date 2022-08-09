/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from 'azurecore';
import { AzureSqlDatabase, AzureSqlDatabaseServer } from './azure';
import { generateGuid } from './utils';
import * as utils from '../api/utils';

// private readonly sqldb_object_count_sql_query: string = `
// SELECT type, COUNT(*) AS objectCount FROM [sys].[objects]
//   GROUP BY type
// UNION ALL
// 	SELECT 'index', COUNT(*) FROM sys.indexes
// UNION ALL
// 	SELECT 'trigger', COUNT(*) FROM sys.triggers
// UNION ALL
// 	SELECT 'role', COUNT(*) FROM sys.database_principals
// 		WHERE type='R'
// UNION ALL
// 	SELECT 'database_audit_spec', COUNT(*) FROM sys.database_audit_specifications";`;

const query_target_databases_sql = `
	select
		('servername') as server_name,
		SERVERPROPERTY ('collation') as server_collation,
		db.database_id as database_id,
		db.name as database_name,
		db.collation_name as database_collation,
		CASE WHEN 'A' = 'a' THEN 0 ELSE 1 END as is_server_case_sensitive,
		db.state as database_state,
		db.is_read_only	as is_read_only
	from sys.databases db
	where db.name not in ('master', 'tempdb', 'model', 'msdb')
	and is_distributor <> 1
	order by db.name;`;

export const excludeDatabses: string[] = [
	'master',
	'tempdb',
	'msdb',
	'model'
];

export interface TargetDatabaseInfo {
	server_name: string;
	server_collation: string;
	database_id: string;
	database_name: string;
	database_collation: string;
	is_server_case_sensitive: boolean;
	database_state: number;
	is_read_only: boolean;
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
		authenticationType: 'SqlLogin',
		savePassword: false,
		groupFullName: '',
		groupId: '',
		providerName: 'MSSQL',
		saveProfile: false,
		options: {},
	};
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
				server_name: getSqlString(row[0]),
				server_collation: getSqlString(row[1]),
				database_id: getSqlString(row[2]),
				database_name: getSqlString(row[3]),
				database_collation: getSqlString(row[4]),
				is_server_case_sensitive: getSqlBoolean(row[5]),
				database_state: getSqlNumber(row[6]),
				is_read_only: getSqlBoolean(row[7]),
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
