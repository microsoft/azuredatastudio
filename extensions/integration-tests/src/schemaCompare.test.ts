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

let schemaCompareService: azdata.SchemaCompareServicesProvider;
let dacpac1: string = path.join(__dirname, 'testData/Database1.dacpac');
let dacpac2: string = path.join(__dirname, 'testData/Database2.dacpac');
let dummyDBName: string = 'ads_schemaCompareDB'; // This is used as fill in name and not created anywhere
const SERVER_CONNECTION_TIMEOUT: number = 3000;

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
			console.log(`Start schema compare tests`);
		});
		test('Schema compare dacpac to dacpac comparison', async function () {
			assert(schemaCompareService, 'Schema Compare Service Provider is not available');

			let source: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Dacpac,
				packageFilePath: dacpac1,
				serverName: '',
				databaseName: '',
				ownerUri: '',
			};
			let target: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Dacpac,
				packageFilePath: dacpac2,
				serverName: '',
				databaseName: '',
				ownerUri: '',
			};

			let schemaCompareResult = await schemaCompareService.schemaCompare(source, target, azdata.TaskExecutionMode.execute, null);
			assertSchemaCompareResult(schemaCompareResult);
		});

		test('Schema compare database to database comparison and script generation', async function () {

			let server = await getStandaloneServer();
			await utils.connectToServer(server, SERVER_CONNECTION_TIMEOUT);

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
					endpointType: azdata.SchemaCompareEndpointType.Database,
					packageFilePath: '',
					serverName: server.serverName,
					databaseName: sourceDB,
					ownerUri: ownerUri,
				};
				let target: azdata.SchemaCompareEndpointInfo = {
					endpointType: azdata.SchemaCompareEndpointType.Database,
					packageFilePath: '',
					serverName: server.serverName,
					databaseName: targetDB,
					ownerUri: ownerUri,
				};

				let schemaCompareResult = await schemaCompareService.schemaCompare(source, target, azdata.TaskExecutionMode.execute, null);
				assertSchemaCompareResult(schemaCompareResult);

				let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, server.serverName, dummyDBName, azdata.TaskExecutionMode.script);

				// TODO : add wait for tasks to complete
				// script generation might take too long and the 'success' status does not mean that script is created.
				await assertScriptGenerationResult(status);
			}
			finally {
				await utils.deleteDB(sourceDB, ownerUri);
				await utils.deleteDB(targetDB, ownerUri);
			}
		});

		test('Schema compare dacpac to database comparison and script generation', async function () {
			let server = await getStandaloneServer();
			await utils.connectToServer(server, SERVER_CONNECTION_TIMEOUT);

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
					endpointType: azdata.SchemaCompareEndpointType.Dacpac,
					packageFilePath: dacpac1,
					serverName: '',
					databaseName: '',
					ownerUri: ownerUri,
				};
				let target: azdata.SchemaCompareEndpointInfo = {
					endpointType: azdata.SchemaCompareEndpointType.Database,
					packageFilePath: '',
					serverName: server.serverName,
					databaseName: targetDB,
					ownerUri: ownerUri,
				};

				assert(schemaCompareService, 'Schema Compare Service Provider is not available');
				let schemaCompareResult = await schemaCompareService.schemaCompare(source, target, azdata.TaskExecutionMode.execute, null);
				assertSchemaCompareResult(schemaCompareResult);

				let status = await schemaCompareService.schemaCompareGenerateScript(schemaCompareResult.operationId, server.serverName, dummyDBName, azdata.TaskExecutionMode.script);
				await assertScriptGenerationResult(status);
			}
			finally {
				await utils.deleteDB(targetDB, ownerUri);
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

export async function assertScriptGenerationResult(resultstatus: azdata.ResultStatus): Promise<void> {
	// TODO add more validation
	assert(resultstatus.success === true, `Expected: success true Actual: "${resultstatus.success}" Error Message: "${resultstatus.errorMessage}`);
}
