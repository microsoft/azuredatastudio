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
			assert(schemaCompareResult.areEqual === false, `Expected: the schemas are not to be equal Actual: Equal`);
			assert(schemaCompareResult.errorMessage === null, `Expected: there should be no error. Actual Error message: "${schemaCompareResult.errorMessage}"`);
			assert(schemaCompareResult.success === true, `Expected: success in schema compare, Actual: Failre`);
			assert(schemaCompareResult.differences.length === 4, `Expected: 4 differences. Actual differences: "${schemaCompareResult.differences.length}"`);

			let status = await service.schemaCompareGenerateScript(schemaCompareResult.operationId, 'testDb', path.join(__dirname, 'testScript_dacpac.sql'), azdata.TaskExecutionMode.execute);
			assert(status.success === true, `Expected: success true Actual: "${status.success}" Error Message: "${status.errorMessage}`);
		});
		test('Schema compare database comparision and script generation', async function () {
			let server = await getStandaloneServer();
			let connection = await utils.connectToServerReturnResult(server, 3000);
			let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);

			let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
			assert(dacfxService, 'DacFx Service Provider is not available');

			let now = new Date();
			let result1 = await dacfxService.deployDacpac(path.join(__dirname, 'testData/Database1.dacpac'), 'database1' + now.getTime().toString(), true, ownerUri, azdata.TaskExecutionMode.execute);
			let result2 = await dacfxService.deployDacpac(path.join(__dirname, 'testData/Database2.dacpac'), 'database2' + now.getTime().toString(), true, ownerUri, azdata.TaskExecutionMode.execute);

			assert(result1.success === true, 'Deploy database 1 should succeed');
			assert(result2.success === true, 'Deploy database 2 should succeed');

			let service = await azdata.dataprotocol.getProvider<azdata.SchemaCompareServicesProvider>('MSSQL', azdata.DataProviderType.SchemaCompareServicesProvider);
			assert(service, 'Schema Compare Service Provider is not available');

			let source: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.database,
				packageFilePath: '',
				databaseName: 'database1',
				ownerUri: ownerUri,
			};
			let target: azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.database,
				packageFilePath: '',
				databaseName: 'database2',
				ownerUri: ownerUri,
			};

			let schemaCompareResult = await service.schemaCompare(source, target, azdata.TaskExecutionMode.execute);
			assert(schemaCompareResult.areEqual === false, `Expected: the schemas are not to be equal Actual: Equal`);
			assert(schemaCompareResult.errorMessage === null, `Expected: there should be no error. Actual Error message: "${schemaCompareResult.errorMessage}"`);
			assert(schemaCompareResult.success === true, `Expected: success in schema compare, Actual: Failre`);
			assert(schemaCompareResult.differences.length === 4, `Expected: 4 differences. Actual differences: "${schemaCompareResult.differences.length}"`);

			let status = await service.schemaCompareGenerateScript(schemaCompareResult.operationId, 'testDb', path.join(__dirname, 'testScript_database.sql'), azdata.TaskExecutionMode.execute);
			assert(status.success === true, `Expected: success true Actual: "${status.success} Error Message: "${status.errorMessage}"`);
		});
	});
}

