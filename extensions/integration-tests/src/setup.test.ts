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

			assert(process.env.BDC_BACKEND_HOSTNAME !== undefined &&
				process.env.BDC_BACKEND_USERNAME !== undefined &&
				process.env.BDC_BACKEND_PWD !== undefined &&
				process.env.PYTHON_TEST_PATH, 'BDC_BACKEND_HOSTNAME, BDC_BACKEND_USERNAME, BDC_BACKEND_PWD, and PYTHON_TEST_PATH must be set using ./scripts/setbackenvariables.sh or .\\scripts\\setbackendvaraibles.bat');

			assert(process.env.STANDALONE_SQL !== undefined &&
				process.env.STANDALONE_SQL_USERNAME !== undefined &&
				process.env.STANDALONE_SQL_PWD !== undefined, 'STANDALONE_SQL, STANDALONE_SQL_USERNAME and STANDALONE_SQL_PWD must be set using ./scripts/setbackenvariables.sh or .\\scripts\\setbackendvaraibles.bat');

			assert(process.env.AZURE_SQL !== undefined &&
				process.env.AZURE_SQL_USERNAME !== undefined &&
				process.env.AZURE_SQL_PWD !== undefined, 'AZURE_SQL, AZURE_SQL_USERNAME and AZURE_SQL_PWD must be set using ./scripts/setbackenvariables.sh or .\\scripts\\setbackendvaraibles.bat');

		});
	});
}