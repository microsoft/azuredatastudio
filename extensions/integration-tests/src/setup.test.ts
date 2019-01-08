/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as vscode from 'vscode';
import { context } from './testContext';
import { waitForCompletion } from './utils';
if (!context.RunTest) {
	suite('integration test setup', () => {
		test('test setup', async function () {
			//Prepare the environment and make it ready for testing
			await waitForCompletion(vscode.commands.executeCommand('test.setupIntegrationTest'));
			//Reload the window, this is required for some changes made by the 'test.setupIntegrationTest' to work
			await waitForCompletion(vscode.commands.executeCommand('workbench.action.reloadWindow'));
		});
	});
}