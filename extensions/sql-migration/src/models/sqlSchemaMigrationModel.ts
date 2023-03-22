/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getSourceConnectionString, getTargetConnectionString } from '../api/sqlUtils';
import { MigrationStateModel } from './stateMachine';

export enum SchemaMigrationState {
	NotStarted = 'NotStarted',
	CollectingObjects = 'CollectingObjects',
	GeneratingScript = 'GeneratingScript',
	DeployingSchema = 'DeployingSchema',
	SchemaMigrationInProgress = 'SchemaMigrationInProgress',
	DeploymentCompleted = 'DeploymentCompleted',
	Completed = 'Completed',
	CompletedWithError = 'CompletedWithError',
}

export class SqlSchemaMigrationModel {

	public async MigrateSchema(sourceDatabaseName: string, stateMachine: MigrationStateModel,
		reportSchemaMigrationComplete: (sourceDbName: string, status: string) => Promise<void>): Promise<void> {
		const sourceConnectionString = await getSourceConnectionString();
		const targetDatabaseName = stateMachine._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? ""
		const targetConnectionString = await getTargetConnectionString(
			stateMachine.targetServerName,
			stateMachine._targetServerInstance.id,
			stateMachine._targetUserName,
			stateMachine._targetPassword,
			// to-do: take as input from the user, should be true/false for DB/MI but true/true for VM
			true /* encryptConnection */,
			false /* trustServerCertificate */);
		// Start async schema migration call
		void stateMachine.migrationService.migrateSqlSchema(
			sourceConnectionString,
			sourceDatabaseName,
			targetConnectionString,
			targetDatabaseName,
			reportSchemaMigrationComplete
		);
	}
}

