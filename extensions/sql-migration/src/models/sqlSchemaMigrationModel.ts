/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getSourceConnectionString, getSqlDbConnectionString } from '../api/sqlUtils';
import { MigrationStateModel } from './stateMachine';

export enum SchemaMigrationState {
	NotStarted = 'NotStarted',
	InProgress = 'InProgress',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
}

export enum SchemaMigrationDbState {
	InProgress = 'InProgress',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
}

export interface SchemaMigrationResult {
	perDbResult: SchemaMigrationPerDbResult[];
	state: SchemaMigrationState;
}

export interface SchemaMigrationPerDbResult {
	sourceDbName: string;
	targetDbName: string;
	status: SchemaMigrationDbState;
}

export class SqlSchemaMigrationModel {
	public schemaMigrationResult: SchemaMigrationResult;

	constructor() {
		this.schemaMigrationResult = {
			perDbResult: [],
			state: SchemaMigrationState.NotStarted
		}
	}

	public async MigrateSchema(sourceDatabaseName: string, stateMachine: MigrationStateModel,
		reportSchemaMigrationComplete: (sourceDbName: string, succeeded: boolean) => Promise<void>): Promise<SchemaMigrationResult> {
		const sourceConnectionString = await getSourceConnectionString();
		const targetDbName = stateMachine._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? ""
		const targetConnectionString = await getSqlDbConnectionString(
			stateMachine.targetServerName,
			stateMachine._azureTenant.id,
			targetDbName,
			stateMachine._targetUserName,
			stateMachine._targetPassword)

		// Start async schema migration call
		const result = await stateMachine.migrationService.migrateSqlSchema(
			sourceConnectionString,
			targetConnectionString,
			reportSchemaMigrationComplete
		);

		this.schemaMigrationResult.perDbResult.push
		{
			result?.sourceDbName;
			result?.targetDbname;
			result?.succeeded;
		}

		return this.schemaMigrationResult;
	}
}

