/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as utils from './utils';
import * as mssql from '../../../mssql';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { getStandaloneServer } from './testConfig';
import { promisify } from 'util';

let schemaCompareService: mssql.ISchemaCompareService;
let dacfxService: mssql.IDacFxService;
const dacpac1: string = path.join(__dirname, '..', '..', 'testData', 'Database1.dacpac');
const dacpac2: string = path.join(__dirname, '..', '..', 'testData', 'Database2.dacpac');
const includeExcludeSourceDacpac: string = path.join(__dirname, '..', '..', 'testData', 'SchemaCompareIncludeExcludeSource.dacpac');
const includeExcludeTargetDacpac: string = path.join(__dirname, '..', '..', 'testData', 'SchemaCompareIncludeExcludeTarget.dacpac');
const SERVER_CONNECTION_TIMEOUT: number = 3000;
const retryCount = 24; // 2 minutes
const folderPath = path.join(os.tmpdir(), 'SchemaCompareTest');

suite('Schema compare integration test suite', () => {
	suiteSetup(async function () {
		let attempts: number = 20;
		while (attempts > 0) {
			schemaCompareService = ((await vscode.extensions.getExtension(mssql.extension.name).activate() as mssql.IExtension)).schemaCompare;
			if (schemaCompareService) {
				break;
			}
			attempts--;
			await utils.sleep(1000); // To ensure the providers are registered.
		}
		dacfxService = ((await vscode.extensions.getExtension(mssql.extension.name).activate() as mssql.IExtension)).dacFx;
		console.log(`Start schema compare tests`);
	});
	test('Schema compare dacpac to dacpac comparison and scmp', async function () {
		assert(schemaCompareService, 'Schema Compare Service Provider is not available');
		const now = new Date();
		const operationId = 'testOperationId_' + now.getTime().toString();

		let source: mssql.SchemaCompareEndpointInfo = {
			endpointType: mssql.SchemaCompareEndpointType.Dacpac,
			packageFilePath: dacpac1,
			serverDisplayName: '',
			serverName: '',
			databaseName: '',
			ownerUri: '',
			connectionDetails: undefined
		};
		let target: mssql.SchemaCompareEndpointInfo = {
			endpointType: mssql.SchemaCompareEndpointType.Dacpac,
			packageFilePath: dacpac2,
			serverDisplayName: '',
			serverName: '',
			databaseName: '',
			ownerUri: '',
			connectionDetails: undefined
		};

		let schemaCompareResult = await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, null);
		assertSchemaCompareResult(schemaCompareResult, operationId, 4);

		// save to scmp
		const filepath = path.join(folderPath, `ads_schemaCompare_${now.getTime().toString()}.scmp`);
		if (!(await promisify(fs.exists)(folderPath))) {
			await fs.promises.mkdir(folderPath);
		}
		const saveScmpResult = await schemaCompareService.schemaCompareSaveScmp(source, target, azdata.TaskExecutionMode.execute, null, filepath, [], []);
		assert(saveScmpResult.success && !saveScmpResult.errorMessage, `Save scmp should succeed. Expected: there should be no error. Actual Error message: "${saveScmpResult.errorMessage}`);
		assert(await promisify(fs.exists)(filepath), `File ${filepath} is expected to be present`);

		// open scmp
		const openScmpResult = await schemaCompareService.schemaCompareOpenScmp(filepath);
		assert(openScmpResult.success && !openScmpResult.errorMessage, `Open scmp should succeed. Expected: there should be no error. Actual Error message: "${openScmpResult.errorMessage}`);
		assert(openScmpResult.sourceEndpointInfo.packageFilePath === source.packageFilePath, `Expected: source packageFilePath to be ${source.packageFilePath}, Actual: ${openScmpResult.sourceEndpointInfo.packageFilePath}`);
		assert(openScmpResult.targetEndpointInfo.packageFilePath === target.packageFilePath, `Expected: target packageFilePath to be ${target.packageFilePath}, Actual: ${openScmpResult.targetEndpointInfo.packageFilePath}`);
	});
	test('Schema compare database to database comparison, script generation, and scmp @UNSTABLE@', async function () {
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
			assert(dacfxService, 'DacFx Service Provider is not available');
			let result1 = await dacfxService.deployDacpac(dacpac1, sourceDB, true, ownerUri, azdata.TaskExecutionMode.execute);
			let result2 = await dacfxService.deployDacpac(dacpac2, targetDB, true, ownerUri, azdata.TaskExecutionMode.execute);

			assert(result1.success === true, 'Deploy source database should succeed');
			assert(result2.success === true, 'Deploy target database should succeed');
			await utils.assertDatabaseCreationResult(sourceDB, ownerUri, retryCount);
			await utils.assertDatabaseCreationResult(targetDB, ownerUri, retryCount);

			assert(schemaCompareService, 'Schema Compare Service Provider is not available');

			let source: mssql.SchemaCompareEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				packageFilePath: '',
				serverDisplayName: '',
				serverName: server.serverName,
				databaseName: sourceDB,
				ownerUri: ownerUri,
				connectionDetails: undefined
			};
			let target: mssql.SchemaCompareEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				packageFilePath: '',
				serverDisplayName: '',
				serverName: server.serverName,
				databaseName: targetDB,
				ownerUri: ownerUri,
				connectionDetails: undefined
			};

			let schemaCompareResult = await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, null);
			assertSchemaCompareResult(schemaCompareResult, operationId, 4);

			let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, server.serverName, targetDB, azdata.TaskExecutionMode.script);

			// TODO : add wait for tasks to complete
			// script generation might take too long and the 'success' status does not mean that script is created.
			await assertScriptGenerationResult(status, target.serverName, target.databaseName);

			// save to scmp
			const filepath = path.join(folderPath, `ads_schemaCompare_${now.getTime().toString()}.scmp`);
			if (!(await promisify(fs.exists)(folderPath))) {
				await fs.promises.mkdir(folderPath);
			}
			const saveScmpResult = await schemaCompareService.schemaCompareSaveScmp(source, target, azdata.TaskExecutionMode.execute, null, filepath, [], []);
			assert(saveScmpResult.success && !saveScmpResult.errorMessage, `Save scmp should succeed. Expected: there should be no error. Actual Error message: "${saveScmpResult.errorMessage}`);
			assert(promisify(fs.exists)(filepath), `File ${filepath} is expected to be present`);

			// open scmp
			const openScmpResult = await schemaCompareService.schemaCompareOpenScmp(filepath);
			assert(openScmpResult.success && !openScmpResult.errorMessage, `Open scmp should succeed. Expected: there should be no error. Actual Error message: "${openScmpResult.errorMessage}`);
			assert(openScmpResult.sourceEndpointInfo.databaseName === source.databaseName, `Expected: source database to be ${source.databaseName}, Actual: ${openScmpResult.sourceEndpointInfo.databaseName}`);
			assert(openScmpResult.targetEndpointInfo.databaseName === target.databaseName, `Expected: target database to be ${target.databaseName}, Actual: ${openScmpResult.targetEndpointInfo.databaseName}`);

			await fs.promises.unlink(filepath);
		}
		finally {
			await utils.tryDeleteDB(server, sourceDB, ownerUri);
			await utils.tryDeleteDB(server, targetDB, ownerUri);
		}
	});
	test('Schema compare dacpac to database comparison, script generation, and scmp', async function () {
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
			assert(dacfxService, 'DacFx Service Provider is not available');
			let result = await dacfxService.deployDacpac(dacpac2, targetDB, true, ownerUri, azdata.TaskExecutionMode.execute);

			assert(result.success === true, 'Deploy database 2 (target) should succeed');

			let source: mssql.SchemaCompareEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Dacpac,
				packageFilePath: dacpac1,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: ownerUri,
				connectionDetails: undefined
			};
			let target: mssql.SchemaCompareEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				packageFilePath: '',
				serverDisplayName: '',
				serverName: server.serverName,
				databaseName: targetDB,
				ownerUri: ownerUri,
				connectionDetails: undefined
			};

			assert(schemaCompareService, 'Schema Compare Service Provider is not available');

			let schemaCompareResult = await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, null);
			assertSchemaCompareResult(schemaCompareResult, operationId, 4);

			let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, server.serverName, targetDB, azdata.TaskExecutionMode.script);
			await assertScriptGenerationResult(status, target.serverName, target.databaseName);

			// save to scmp
			const filepath = path.join(folderPath, `ads_schemaCompare_${now.getTime().toString()}.scmp`);
			if (!(await promisify(fs.exists)(folderPath))) {
				await fs.promises.mkdir(folderPath);
			}
			const saveScmpResult = await schemaCompareService.schemaCompareSaveScmp(source, target, azdata.TaskExecutionMode.execute, null, filepath, [], []);
			assert(saveScmpResult.success && !saveScmpResult.errorMessage, `Save scmp should succeed. Expected: there should be no error. Actual Error message: "${saveScmpResult.errorMessage}`);
			assert(await promisify(fs.exists)(filepath), `File ${filepath} is expected to be present`);

			// open scmp
			const openScmpResult = await schemaCompareService.schemaCompareOpenScmp(filepath);
			assert(openScmpResult.success && !openScmpResult.errorMessage, `Open scmp should succeed. Expected: there should be no error. Actual Error message: "${openScmpResult.errorMessage}`);
			assert(openScmpResult.sourceEndpointInfo.packageFilePath === source.packageFilePath, `Expected: source packageFilePath to be ${source.packageFilePath}, Actual: ${openScmpResult.sourceEndpointInfo.packageFilePath}`);
			assert(openScmpResult.targetEndpointInfo.databaseName === target.databaseName, `Expected: target database to be ${target.databaseName}, Actual: ${openScmpResult.targetEndpointInfo.databaseName}`);
		}
		finally {
			await utils.tryDeleteDB(server, targetDB, ownerUri);
		}
	});
	test('Schema compare dacpac to dacpac comparison with include exclude', async function () {
		assert(schemaCompareService, 'Schema Compare Service Provider is not available');
		const operationId = 'testOperationId_' + new Date().getTime().toString();

		let source: mssql.SchemaCompareEndpointInfo = {
			endpointType: mssql.SchemaCompareEndpointType.Dacpac,
			packageFilePath: includeExcludeSourceDacpac,
			serverDisplayName: '',
			serverName: '',
			databaseName: '',
			ownerUri: '',
			connectionDetails: undefined
		};
		let target: mssql.SchemaCompareEndpointInfo = {
			endpointType: mssql.SchemaCompareEndpointType.Dacpac,
			packageFilePath: includeExcludeTargetDacpac,
			serverDisplayName: '',
			serverName: '',
			databaseName: '',
			ownerUri: '',
			connectionDetails: undefined
		};

		const deploymentOptionsResult = await schemaCompareService.schemaCompareGetDefaultOptions();
		let deploymentOptions = deploymentOptionsResult.defaultDeploymentOptions;
		const schemaCompareResult = await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, deploymentOptions);
		assertSchemaCompareResult(schemaCompareResult, operationId, 5);

		// try to exclude table t2 and it should fail because a dependency is still included
		const t2Difference = schemaCompareResult.differences.find(e => e.sourceValue && e.sourceValue[1] === 't2' && e.name === 'SqlTable');
		assert(t2Difference !== undefined, 'The difference Table t2 should be found. Should not be undefined');
		const excludeResult = await schemaCompareService.schemaCompareIncludeExcludeNode(operationId, t2Difference, false, azdata.TaskExecutionMode.execute);
		assertIncludeExcludeResult(excludeResult, false, 1, 0);
		assert(excludeResult.blockingDependencies[0].sourceValue[1] === 'v1', `Blocking dependency should be view v1. Actual: ${excludeResult.blockingDependencies[0].sourceValue[1]}`);

		// Exclude the view v1 that t2 was a dependency for and it should succeed and t2 should also be excluded
		const v1Difference = schemaCompareResult.differences.find(e => e.sourceValue && e.sourceValue[1] === 'v1' && e.name === 'SqlView');
		assert(v1Difference !== undefined, 'The difference View v1 should be found. Should not be undefined');
		const excludeResult2 = await schemaCompareService.schemaCompareIncludeExcludeNode(operationId, v1Difference, false, azdata.TaskExecutionMode.execute);
		assertIncludeExcludeResult(excludeResult2, true, 0, 1);
		assert(excludeResult2.affectedDependencies[0].sourceValue[1] === 't2', `Table t2 should be the affected dependency. Actual: ${excludeResult2.affectedDependencies[0].sourceValue[1]}`);
		assert(excludeResult2.affectedDependencies[0].included === false, 'Table t2 should be excluded as a result of excluding v1. Actual: true');

		// including the view v1 should also include the table t2
		const includeResult = await schemaCompareService.schemaCompareIncludeExcludeNode(operationId, v1Difference, true, azdata.TaskExecutionMode.execute);
		assertIncludeExcludeResult(includeResult, true, 0, 1);
		assert(includeResult.affectedDependencies[0].sourceValue[1] === 't2', `Table t2 should be the affected dependency. Actual: ${includeResult.affectedDependencies[0].sourceValue[1]}`);
		assert(includeResult.affectedDependencies[0].included === true, 'Table t2 should be included as a result of including v1. Actual: false');

		// excluding views from the comparison should make it so t2 can be excluded
		deploymentOptions.excludeObjectTypes.push(mssql.SchemaObjectType.Views);
		await schemaCompareService.schemaCompare(operationId, source, target, azdata.TaskExecutionMode.execute, deploymentOptions);
		const excludeResult3 = await schemaCompareService.schemaCompareIncludeExcludeNode(operationId, t2Difference, false, azdata.TaskExecutionMode.execute);
		assertIncludeExcludeResult(excludeResult3, true, 0, 0);
	});
});

function assertIncludeExcludeResult(result: mssql.SchemaCompareIncludeExcludeResult, expectedSuccess: boolean, expectedBlockingDependenciesLength: number, expectedAffectedDependenciesLength: number): void {
	assert(result.success === expectedSuccess, `Operation success should have been ${expectedSuccess}. Actual: ${result.success}`);
	if (result.blockingDependencies) {
		assert(result.blockingDependencies.length === expectedBlockingDependenciesLength, `Expected ${expectedBlockingDependenciesLength} blocking dependencies. Actual: ${result.blockingDependencies}`);
	} else if (expectedBlockingDependenciesLength !== 0) {
		throw new Error(`ExpectedBlockingDependencies length was ${expectedBlockingDependenciesLength} but blockingDependencies was undefined`);
	}
	if (result.affectedDependencies) {
		assert(result.affectedDependencies.length === expectedAffectedDependenciesLength, `Expected ${expectedAffectedDependenciesLength} affected dependencies. Actual: ${result.affectedDependencies}`);
	} else if (expectedAffectedDependenciesLength !== 0) {
		throw new Error(`ExpectedAffectedDependencies length was ${expectedAffectedDependenciesLength} but affectedDependencies was undefined`);
	}
}

function assertSchemaCompareResult(schemaCompareResult: mssql.SchemaCompareResult, operationId: string, expectedDifferenceCount: number): void {
	assert(schemaCompareResult.areEqual === false, `Expected: the schemas are not to be equal Actual: Equal`);
	assert(schemaCompareResult.errorMessage === null, `Expected: there should be no error. Actual Error message: "${schemaCompareResult.errorMessage}"`);
	assert(schemaCompareResult.success === true, `Expected: success in schema compare, Actual: Failure`);
	assert(schemaCompareResult.differences.length === expectedDifferenceCount, `Expected: ${expectedDifferenceCount} differences. Actual differences: "${schemaCompareResult.differences.length}"`);
	assert(schemaCompareResult.operationId === operationId, `Operation Id Expected to be same as passed. Expected : ${operationId}, Actual ${schemaCompareResult.operationId}`);
}

async function assertScriptGenerationResult(resultstatus: azdata.ResultStatus, server: string, database: string): Promise<void> {
	// TODO add more validation
	assert(resultstatus.success === true, `Expected: success true Actual: "${resultstatus.success}" Error Message: "${resultstatus.errorMessage}`);
	const taskService = azdata.dataprotocol.getProvider<azdata.TaskServicesProvider>('MSSQL', azdata.DataProviderType.TaskServicesProvider);
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
		// TODO: add proper validation for task completion to ensure all tasks successfully complete before exiting test
		assert(tasks !== null && tasks.tasks.length > 0, 'Tasks should still show in list. This is to ensure that the tasks actually complete.');
	}
}
