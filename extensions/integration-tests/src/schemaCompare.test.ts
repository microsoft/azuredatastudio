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
import { readFileSync, unlinkSync, existsSync } from 'fs';

let schemaCompareService: azdata.SchemaCompareServicesProvider;
let dacpac1: string = path.join(__dirname, 'testData/Database1.dacpac');
let dacpac2: string = path.join(__dirname, 'testData/Database2.dacpac');
let dummyDBName: string = 'ads_schemaCompareDB'; // This is used as fill in name and not created anywhere

if (context.RunTest) {
	suite('Schema compare integration test suite', () => {
		suiteSetup(async function () {
			let attemps: number = 20;
			while (attemps > 0) {
				schemaCompareService = await azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>('MSSQL', azdata.DataProviderType.SchemaCompareServicesProvider);
				if (schemaCompareService) {
					break;
				}
				attemps--;
				await utils.sleep(1000); // To ensure the providers are registered.
			}
			console.log(`Start schema compare tests`);
		});
		test('Schema compare dacpac to dacpac comparision and script generation', async function () {
			assert(schemaCompareService, 'Schema Compare Service Provider is not available');

			let source: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.dacpac,
				packageFilePath: dacpac1,
				databaseName: '',
				ownerUri: '',
			};
			let target: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.dacpac,
				packageFilePath: dacpac2,
				databaseName: '',
				ownerUri: '',
			};

			let schemaCompareResult = await schemaCompareService.schemaCompare(source, target, azdata.TaskExecutionMode.execute);
			assertSchemaCompareResult(schemaCompareResult);
		});

		test('Schema compare database to database comparision and script generation', async function () {

			let server = await getStandaloneServer();
			await utils.connectToServer(server, 300);

			let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

			let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

			let ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
			let now = new Date();

			let sourceDB: string = 'ads_schemaCompare_sourceDB_' + now.getTime().toString();
			let targetDB: string = 'ads_schemaCompare_targetDB_' + now.getTime().toString();

			try {
				let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
				assert(dacfxService, 'DacFx Service Provider is not available');
				let result1 = await dacfxService.deployDacpac(dacpac1, sourceDB, true, ownerUri, azdata.TaskExecutionMode.execute);
				let result2 = await dacfxService.deployDacpac(dacpac2, targetDB, true, ownerUri, azdata.TaskExecutionMode.execute);

				assert(result1.success === true, 'Deploy source database should succeed');
				assert(result2.success === true, 'Deploy target database should succeed');

				assert(schemaCompareService, 'Schema Compare Service Provider is not available');

				let source: azdata.SchemaCompareEndpointInfo = {
					endpointType: azdata.SchemaCompareEndpointType.database,
					packageFilePath: '',
					databaseName: sourceDB,
					ownerUri: ownerUri,
				};
				let target: azdata.SchemaCompareEndpointInfo = {
					endpointType: azdata.SchemaCompareEndpointType.database,
					packageFilePath: '',
					databaseName: targetDB,
					ownerUri: ownerUri,
				};

				let schemaCompareResult = await schemaCompareService.schemaCompare(source, target, azdata.TaskExecutionMode.execute);
				assertSchemaCompareResult(schemaCompareResult);


				let scriptFile: string = path.join(__dirname, 'schemaCompare_DBtoDB_TestScript' + now.getTime().toString() + '.sql');
				let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, dummyDBName, scriptFile, azdata.TaskExecutionMode.execute);
				
				// TODO : add wait for tasks to complete
				// script generation might take too long and the 'success' status does not mean that script is created.
				await assertScriptGenerationResult(status, scriptFile);
			}
			finally {
				utils.deleteDB(sourceDB, ownerUri);
				utils.deleteDB(targetDB, ownerUri);
			}
		});

		test('Schema compare dacpac to database comparision and script generation', async function () {
			let server = await getStandaloneServer();
			await utils.connectToServer(server, 300);

			let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

			let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

			let ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
			let now = new Date();
			let targetDB: string = 'ads_schemaCompare_targetDB_' + now.getTime().toString();

			try {
				let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
				assert(dacfxService, 'DacFx Service Provider is not available');
				let result = await dacfxService.deployDacpac(path.join(__dirname, 'testData/Database2.dacpac'), targetDB, true, ownerUri, azdata.TaskExecutionMode.execute);

				assert(result.success === true, 'Deploy database 2 (target) should succeed');

				let source: azdata.SchemaCompareEndpointInfo = {
					endpointType: azdata.SchemaCompareEndpointType.dacpac,
					packageFilePath: dacpac1,
					databaseName: '',
					ownerUri: ownerUri,
				};
				let target: azdata.SchemaCompareEndpointInfo = {
					endpointType: azdata.SchemaCompareEndpointType.database,
					packageFilePath: '',
					databaseName: targetDB,
					ownerUri: ownerUri,
				};

				assert(schemaCompareService, 'Schema Compare Service Provider is not available');
				let schemaCompareResult = await schemaCompareService.schemaCompare(source, target, azdata.TaskExecutionMode.execute);
				assertSchemaCompareResult(schemaCompareResult);

				let scriptFile: string = path.join(__dirname, 'schemaCompare_DPtoDB_TestScript' + now.getTime().toString() + '.sql');
				let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, dummyDBName, scriptFile, azdata.TaskExecutionMode.execute);
				await assertScriptGenerationResult(status, scriptFile);
			}
			finally {
				utils.deleteDB(targetDB, ownerUri);
			}
		});
	});
}

export function assertSchemaCompareResult(schemaCompareResult: azdata.SchemaCompareResult): void {
	assert(schemaCompareResult.areEqual === false, `Expected: the schemas are not to be equal Actual: Equal`);
	assert(schemaCompareResult.errorMessage === null, `Expected: there should be no error. Actual Error message: "${schemaCompareResult.errorMessage}"`);
	assert(schemaCompareResult.success === true, `Expected: success in schema compare, Actual: Failure`);
	assert(schemaCompareResult.differences.length === 4, `Expected: 4 differences. Actual differences: "${schemaCompareResult.differences.length}"`);
}

export async function assertScriptGenerationResult(resultstatus: azdata.ResultStatus, filepath: string): Promise<void> {
	assert(resultstatus.success === true, `Expected: success true Actual: "${resultstatus.success}" Error Message: "${resultstatus.errorMessage}`);

	let retry = 10; // file takes quite long time to get created
	let exists = false;
	while (retry > 0 && !exists) {
		exists = existsSync(filepath);
		await utils.sleep(2000);
		retry--;
	}
	assert(exists, `script file ${filepath} is expected to be present`);
	let script = readFileSync(filepath, 'utf8');
	assert(script.length > 0, `script file should ${filepath} not be empty`);
	unlinkSync(filepath);
}
