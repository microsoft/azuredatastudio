/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as vscode from 'vscode';
import { context } from './testContext';
import assert = require('assert');

if (!context.RunTest) {
	suite('integration test setup', () => {
		test('test setup', async function () {
			//Prepare the environment and make it ready for testing
			await vscode.commands.executeCommand('test.setupIntegrationTest');
			//Reload the window, this is required for some changes made by the 'test.setupIntegrationTest' to work
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
		});
		test('test setup verify BDC instance variables', async function () {
			console.log(`BDC_BACKEND_HOSTNAME: '${process.env.BDC_BACKEND_HOSTNAME}', BDC_BACKEND_USERNAME: '${process.env.BDC_BACKEND_USERNAME}'`);
			console.log(`PYTHON_TEST_PATH: '${process.env.PYTHON_TEST_PATH}'`);
			assert(process.env.BDC_BACKEND_HOSTNAME !== undefined &&
				process.env.BDC_BACKEND_USERNAME !== undefined &&
				process.env.BDC_BACKEND_PWD !== undefined &&
				process.env.PYTHON_TEST_PATH !== undefined, 'Test setup requirs BDC_BACKEND_HOSTNAME, BDC_BACKEND_USERNAME, BDC_BACKEND_PWD, and PYTHON_TEST_PATH must be set using ./scripts/setbackenvariables.sh or .\\scripts\\setbackendvaraibles.bat');
			console.log('BDC instance variables are verified.');
		});
		test('test setup verify standalone instance variables', async function () {
			console.log(`STANDALONE_SQL: '${process.env.STANDALONE_SQL}', STANDALONE_SQL_USERNAME: '${process.env.STANDALONE_SQL_USERNAME}'`);
			assert(process.env.STANDALONE_SQL !== undefined &&
				process.env.STANDALONE_SQL_USERNAME !== undefined &&
				process.env.STANDALONE_SQL_PWD !== undefined, 'Test setup requirs STANDALONE_SQL, STANDALONE_SQL_USERNAME and STANDALONE_SQL_PWD must be set using ./scripts/setbackenvariables.sh or .\\scripts\\setbackendvaraibles.bat');

			console.log('Standalone instance variables are verified.');
		});

		test('test setup verify azure instance variables', async function () {
			console.log(`AZURE_SQL: '${process.env.AZURE_SQL}', AZURE_SQL_USERNAME: '${process.env.AZURE_SQL_USERNAME}'`);
			assert(process.env.AZURE_SQL !== undefined &&
				process.env.AZURE_SQL_USERNAME !== undefined &&
				process.env.AZURE_SQL_PWD !== undefined, 'Test setup requirs AZURE_SQL, AZURE_SQL_USERNAME and AZURE_SQL_PWD must be set using ./scripts/setbackenvariables.sh or .\\scripts\\setbackendvaraibles.bat');

			console.log('Azure instance variables are verified.');
		});
	});
}