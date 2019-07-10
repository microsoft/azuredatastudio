/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import * as utils from './utils';
const path = require('path');
import { context } from './testContext';
import assert = require('assert');
import { getStandaloneServer } from './testConfig';
import { stressify } from 'adstest';

let schemaCompareService: azdata.SchemaCompareServicesProvider;
let schemaCompareTester: SchemaCompareTester;
let dacpac1: string = path.join(__dirname, 'testData/Database1.dacpac');
let dacpac2: string = path.join(__dirname, 'testData/Database2.dacpac');
const SERVER_CONNECTION_TIMEOUT: number = 3000;
const retryCount = 24; // 2 minutes

if (context.RunTest) {
	suite('Schema compare integration test suite', () => {
		suiteSetup(async function () {
			let attempts: number = 20;
			while (attempts > 0) {
				schemaCompareService = await azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>('MSSQL', azdata.DataProviderType.SchemaCompareServicesProvider);
				if (schemaCompareService) {
					break;
				}
				attempts--;
				await utils.sleep(1000); // To ensure the providers are registered.
			}
			schemaCompareTester = new SchemaCompareTester();
			console.log(`Start schema compare tests`);
		});
		test('Schema compare dacpac to dacpac comparison', async function () {
			await schemaCompareTester.SchemaCompareDacpacToDacpac();
		});
		test('Schema compare database to database comparison and script generation', async function () {
			await schemaCompareTester.SchemaCompareDatabaseToDatabase();
		});
		test('Schema compare dacpac to database comparison and script generation', async function () {
			await schemaCompareTester.SchemaCompareDacpacToDatabase();
		});
	});
}

class SchemaCompareTester {
	private static ParallelCount = 1;

	@stressify({ dop: SchemaCompareTester.ParallelCount })
	async SchemaCompareDacpacToDacpac(): Promise<void> {
		assert(schemaCompareService, 'Schema Compare Service Provider is not available');
		const now = new Date();
		const operationId = 'testOperationId_' + now.getTime().toString();

		let source: azdata.SchemaCompareEndpointInfo = {
			endpointType: azdata.SchemaCompareEndpointType.Dacpac,
			packageFilePath: dacpac1,
			serverDisplayName: '',
			serverName: '',
			databaseName: '',
			ownerUri: '',
			connectionDetails: undefined
		};
		let target: azdata.SchemaCompareEndpointInfo = {
			endpointType: azdata.SchemaCompareEndpointType.Dacpac,
			packageFilePath: dacpac2,
			serverDisplayName: '',
			serverName: '',
			databaseName: '',
			ownerUri: '',
			connectionDetails: undefined
		};

		let schemaCompareResult = await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, null);
		this.assertSchemaCompareResult(schemaCompareResult, operationId);
	}

	@stressify({ dop: SchemaCompareTester.ParallelCount })
	async SchemaCompareDatabaseToDatabase(): Promise<void> {
		let server = await getStandaloneServer();
		await utils.connectToServer(server, SERVER_CONNECTION_TIMEOUT);

		let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

		const ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
		const now = new Date();

		const operationId = 'testOperationId_' + now.getTime().toString();
		const sourceDB: string = 'ads_schemaCompare_sourceDB_' + now.getTime().toString();
		const targetDB: string = 'ads_schemaCompare_targetDB_' + now.getTime().toString();

		try {
			let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
			assert(dacfxService, 'DacFx Service Provider is not available');
			let result1 = await dacfxService.deployDacpac(dacpac1, sourceDB, true, ownerUri, azdata.TaskExecutionMode.execute);
			let result2 = await dacfxService.deployDacpac(dacpac2, targetDB, true, ownerUri, azdata.TaskExecutionMode.execute);

			assert(result1.success === true, 'Deploy source database should succeed');
			assert(result2.success === true, 'Deploy target database should succeed');
			utils.assertDatabaseCreationResult(sourceDB, ownerUri, retryCount);
			utils.assertDatabaseCreationResult(targetDB, ownerUri, retryCount);

			assert(schemaCompareService, 'Schema Compare Service Provider is not available');

			let source: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Database,
				packageFilePath: '',
				serverDisplayName: '',
				serverName: server.serverName,
				databaseName: sourceDB,
				ownerUri: ownerUri,
				connectionDetails: undefined
			};
			let target: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Database,
				packageFilePath: '',
				serverDisplayName: '',
				serverName: server.serverName,
				databaseName: targetDB,
				ownerUri: ownerUri,
				connectionDetails: undefined
			};

			let schemaCompareResult = await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, null);
			this.assertSchemaCompareResult(schemaCompareResult, operationId);

			let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, server.serverName, targetDB, azdata.TaskExecutionMode.script);

			// TODO : add wait for tasks to complete
			// script generation might take too long and the 'success' status does not mean that script is created.
			await this.assertScriptGenerationResult(status, target.serverName, target.databaseName);
		}
		finally {
			await utils.deleteDB(sourceDB, ownerUri);
			await utils.deleteDB(targetDB, ownerUri);
		}
	}

	@stressify({ dop: SchemaCompareTester.ParallelCount })
	async SchemaCompareDacpacToDatabase(): Promise<void> {
		let server = await getStandaloneServer();
		await utils.connectToServer(server, SERVER_CONNECTION_TIMEOUT);

		let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

		const ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
		const now = new Date();
		const operationId = 'testOperationId_' + now.getTime().toString();
		const targetDB: string = 'ads_schemaCompare_targetDB_' + now.getTime().toString();

		try {
			let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
			assert(dacfxService, 'DacFx Service Provider is not available');
			let result = await dacfxService.deployDacpac(path.join(__dirname, 'testData/Database2.dacpac'), targetDB, true, ownerUri, azdata.TaskExecutionMode.execute);

			assert(result.success === true, 'Deploy database 2 (target) should succeed');

			let source: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Dacpac,
				packageFilePath: dacpac1,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: ownerUri,
				connectionDetails: undefined
			};
			let target: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Database,
				packageFilePath: '',
				serverDisplayName: '',
				serverName: server.serverName,
				databaseName: targetDB,
				ownerUri: ownerUri,
				connectionDetails: undefined
			};

			assert(schemaCompareService, 'Schema Compare Service Provider is not available');

			let schemaCompareResult = await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, null);
			this.assertSchemaCompareResult(schemaCompareResult, operationId);

			let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, server.serverName, targetDB, azdata.TaskExecutionMode.script);
			await this.assertScriptGenerationResult(status, target.serverName, target.databaseName);
		}
		finally {
			await utils.deleteDB(targetDB, ownerUri);
		}
	}

	private assertSchemaCompareResult(schemaCompareResult: azdata.SchemaCompareResult, operationId: string): void {
		assert(schemaCompareResult.areEqual === false, `Expected: the schemas are not to be equal Actual: Equal`);
		assert(schemaCompareResult.errorMessage === null, `Expected: there should be no error. Actual Error message: "${schemaCompareResult.errorMessage}"`);
		assert(schemaCompareResult.success === true, `Expected: success in schema compare, Actual: Failure`);
		assert(schemaCompareResult.differences.length === 4, `Expected: 4 differences. Actual differences: "${schemaCompareResult.differences.length}"`);
		assert(schemaCompareResult.operationId === operationId, `Operation Id Expected to be same as passed. Expected : ${operationId}, Actual ${schemaCompareResult.operationId}`)
	}

	private async assertScriptGenerationResult(resultstatus: azdata.ResultStatus, server: string, database: string): Promise<void> {
		// TODO add more validation
		assert(resultstatus.success === true, `Expected: success true Actual: "${resultstatus.success}" Error Message: "${resultstatus.errorMessage}`);
		const taskService = await azdata.dataprotocol.getProvider<azdata.TaskServicesProvider>('MSSQL', azdata.DataProviderType.TaskServicesProvider);
		const tasks = await taskService.getAllTasks({ listActiveTasksOnly: true });
		let foundTask: azdata.TaskInfo;
		tasks.tasks.forEach(t => {
			if (t.serverName === server && t.databaseName === database && t.taskExecutionMode === azdata.TaskExecutionMode.script) {
				foundTask = t;
			}
		});
		assert(foundTask, 'Could not find Script task');
		assert(foundTask.isCancelable, 'The task should be cancellable');

		if (foundTask.status !== azdata.TaskStatus.Succeeded) {
			// wait for all tasks completion before exiting test and cleaning up db otherwise tasks fail
			let retry = 10;
			let allCompleted = false;
			while (retry > 0 && !allCompleted) {
				retry--;
				await utils.sleep(1000);
				allCompleted = true;
				let tasks = await taskService.getAllTasks({ listActiveTasksOnly: true });
				tasks.tasks.forEach(t => {
					if (t.status !== azdata.TaskStatus.Succeeded) {
						allCompleted = false;
					}
				});
			}
			assert(tasks !== null && tasks.tasks.length > 0, 'Tasks should still show in list. This is to ensure that the tasks actually complete.');
			assert(allCompleted === true, 'All tasks should be completed.');
		}
	}
}