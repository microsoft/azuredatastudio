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
import { exists, readFileSync, unlinkSync } from 'fs';

if (context.RunTest) {
	suite('Schema compare integration test suite', () => {
		suiteSetup(async function () {
			await utils.sleep(5000); // To ensure the providers are registered.
			console.log(`Start schema compare tests`);

		});
		test('Schema compare dacpac comparision and script generation', async function () {
			let service = await azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>('MSSQL', azdata.DataProviderType.SchemaCompareServicesProvider);
			assert(service, 'Schema Compare Service Provider is not available');

			let source: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.dacpac,
				packageFilePath: path.join(__dirname, 'testData/Database1.dacpac'),
				databaseName: 'database1',
				ownerUri: '',
			};
			let target: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.dacpac,
				packageFilePath: path.join(__dirname, 'testData/Database2.dacpac'),
				databaseName: 'database2',
				ownerUri: '',
			};

			let schemaCompareResult = await service.schemaCompare(source, target, azdata.TaskExecutionMode.execute);
			assertSchemaCompareResult(schemaCompareResult);

			let status = await service.schemaCompareGenerateScript(schemaCompareResult.operationId, 'testDb', path.join(__dirname, 'testScript_dacpac.sql'), azdata.TaskExecutionMode.execute);
			assertScriptGenerationResult(status, path.join(__dirname, 'testScript_dacpac.sql'));
		});

		test('Schema compare database comparision and script generation', async function () {
			let server = await getStandaloneServer();
			await utils.connectToServer(server, 300);

			let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

			let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

			let ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);

			let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
			assert(dacfxService, 'DacFx Service Provider is not available');

			let now = new Date();
			let result1 = await dacfxService.deployDacpac(path.join(__dirname, 'testData/Database1.dacpac'), 'database1_' + now.getTime().toString(), true, ownerUri, azdata.TaskExecutionMode.execute);
			let result2 = await dacfxService.deployDacpac(path.join(__dirname, 'testData/Database2.dacpac'), 'database2_' + now.getTime().toString(), true, ownerUri, azdata.TaskExecutionMode.execute);

			assert(result1.success === true, 'Deploy database 1 should succeed');
			assert(result2.success === true, 'Deploy database 2 should succeed');

			let service = await azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>('MSSQL', azdata.DataProviderType.SchemaCompareServicesProvider);
			assert(service, 'Schema Compare Service Provider is not available');

			let source: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.database,
				packageFilePath: '',
				databaseName: 'database1_' + now.getTime().toString(),
				ownerUri: ownerUri,
			};
			let target: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.database,
				packageFilePath: '',
				databaseName: 'database2_' + now.getTime().toString(),
				ownerUri: ownerUri,
			};

			let schemaCompareResult = await service.schemaCompare(source, target, azdata.TaskExecutionMode.execute);
			assertSchemaCompareResult(schemaCompareResult);

			let status = await service.schemaCompareGenerateScript(schemaCompareResult.operationId, 'testDb1', path.join(__dirname, 'testScript_database.sql'), azdata.TaskExecutionMode.execute);
			assertScriptGenerationResult(status, path.join(__dirname, 'testScript_database.sql'));

			utils.deleteDB('database1_' + now.getTime().toString(), ownerUri);
			utils.deleteDB('database2_' + now.getTime().toString(), ownerUri);
		});
	});
}

export function assertSchemaCompareResult(schemaCompareResult: azdata.SchemaCompareResult): void {
	assert(schemaCompareResult.areEqual === false, `Expected: the schemas are not to be equal Actual: Equal`);
	assert(schemaCompareResult.errorMessage === null, `Expected: there should be no error. Actual Error message: "${schemaCompareResult.errorMessage}"`);
	assert(schemaCompareResult.success === true, `Expected: success in schema compare, Actual: Failure`);
	assert(schemaCompareResult.differences.length === 4, `Expected: 4 differences. Actual differences: "${schemaCompareResult.differences.length}"`);
}

export function assertScriptGenerationResult(resultstatus: azdata.ResultStatus, filepath: string): void {
	assert(resultstatus.success === true, `Expected: success true Actual: "${resultstatus.success}" Error Message: "${resultstatus.errorMessage}`);
	exists(filepath, (exist) => {
		assert(exist, `script file ${filepath} is expected to be present`);
	});
	let script = readFileSync(filepath, 'utf8');
	assert(script.length > 0, `script file should ${filepath} not be empty`);
	unlinkSync(filepath);
}

