/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import * as utils from './utils';
import { context } from './testContext';
import assert = require('assert');

if (context.RunTest) {
	suite('Schema compare integration test suite', () => {
		test('Schema compare tests', async function () {
			let service = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
			let source : azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.dacpac,
				packageFilePath: utils.combinePath(__dirname, 'testData/Database1.dacpac'),
				databaseName: 'database1',
				ownerUri: '',
			};
			let target : azdata.SchemaCompareEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.dacpac,
				packageFilePath: utils.combinePath(__dirname, 'testData/Database2.dacpac'),
				databaseName: 'database4',
				ownerUri: '',
			};

			let schemaCompareResult = await service.schemaCompare(source, target, azdata.TaskExecutionMode.execute);
			assert(schemaCompareResult.areEqual === false, `Expected: the schemas are not to be equal Actual: Equal`);
			assert(schemaCompareResult.errorMessage === null, `Expected: there should be no error. Actual Error message: "${schemaCompareResult.errorMessage}"`);
			assert(schemaCompareResult.success === true, `Expected: success in schema compare, Actual: Failre`);
			assert(schemaCompareResult.differences.length === 4, `Expected: 4 differences. Actual differences: "${schemaCompareResult.differences.length}"`);
		});
	});
}

