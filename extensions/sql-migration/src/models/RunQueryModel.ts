/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableInfo, getSourceConnectionString, getTargetConnectionString } from '../api/sqlUtils';
import { NotificationType } from 'vscode-languageclient';
import { MigrationStateModel } from './stateMachine';

export namespace RunQueryEvent {
	export const type = new NotificationType<RunQueryParams, void>('migration/runquery');
}

export namespace RunQueryResultEvent {
	export const type = new NotificationType<RunQueryResult, void>('migration/runqueryresult');
}

export namespace RunQueryDatabaseTableInfoResult {
	export const type = new NotificationType<DatabaseTableInfoResult, void>('migration/runqueryresult');
}

export namespace RunQueryErrorEvent {
	export const type = new NotificationType<RunQueryError, void>('migration/runqueryerror');
}

export interface RunQueryParams {
	connectionString: string;
	databases: string[];
	queryResultType: QueryResultType;
	isAzureSqlDb: boolean;
}

export interface RunQueryError {
	DatabaseName: string;
	Error: string;
	isAzureSqlDb: boolean;
}

export interface RunQueryResult {
	error: string;
}

export interface DatabaseTableInfoResult extends RunQueryResult {
	databaseName: string,
	databaseTableInfo: TableInfo[],
	isAzureSqlDb: boolean
}

export const enum QueryResultType {
	DatabaseTableInfo = "DatabaseTableInfo"
}

export class RunQueryModel {
	//extends (...args: Parameters<any>) => ReturnType<any>
	public async RunQueryAsync<F extends Function>(
		stateMachine: MigrationStateModel,
		databases: string[],
		queryResultType: QueryResultType,
		isAzureSqlDb: boolean,
		callback: F): Promise<void> {
		let connectionString: string;
		if (!isAzureSqlDb) {
			connectionString = await getSourceConnectionString();
		}
		else {
			connectionString = await getTargetConnectionString(
				stateMachine.targetServerName,
				stateMachine._targetServerInstance.id,
				stateMachine._targetUserName,
				stateMachine._targetPassword,
				// to-do: take as input from the user, should be true/false for DB/MI but true/true for VM
				true /* encryptConnection */,
				false /* trustServerCertificate */);
		}
		// Start async schema migration call
		await stateMachine.migrationService.runQueryAsync<F>(
			connectionString,
			databases,
			queryResultType,
			isAzureSqlDb,
			callback
		);
	}
}
