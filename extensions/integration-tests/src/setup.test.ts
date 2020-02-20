/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import { isTestSetupCompleted } from './testContext';
import * as assert from 'assert';
import { getConfigValue, EnvironmentVariable_BDC_SERVER, EnvironmentVariable_BDC_USERNAME, EnvironmentVariable_BDC_PASSWORD, EnvironmentVariable_AZURE_PASSWORD, EnvironmentVariable_AZURE_SERVER, EnvironmentVariable_AZURE_USERNAME, EnvironmentVariable_STANDALONE_PASSWORD, EnvironmentVariable_STANDALONE_SERVER, EnvironmentVariable_STANDALONE_USERNAME, EnvironmentVariable_PYTHON_PATH } from './testConfig';

assert(getConfigValue(EnvironmentVariable_BDC_SERVER) !== undefined &&
	getConfigValue(EnvironmentVariable_BDC_USERNAME) !== undefined &&
	getConfigValue(EnvironmentVariable_BDC_PASSWORD) !== undefined &&
	getConfigValue(EnvironmentVariable_AZURE_PASSWORD) !== undefined &&
	getConfigValue(EnvironmentVariable_AZURE_SERVER) !== undefined &&
	getConfigValue(EnvironmentVariable_AZURE_USERNAME) !== undefined &&
	getConfigValue(EnvironmentVariable_STANDALONE_PASSWORD) !== undefined &&
	getConfigValue(EnvironmentVariable_STANDALONE_SERVER) !== undefined &&
	getConfigValue(EnvironmentVariable_STANDALONE_USERNAME) !== undefined &&
	getConfigValue(EnvironmentVariable_PYTHON_PATH) !== undefined, 'Required environment variables are not set, if you see this error in the build pipeline, make sure the environment variables are set properly in the build definition, otherwise for local dev environment make sure you follow the instructions in the readme file.');

if (!isTestSetupCompleted()) {
	suite('integration test setup', () => {
		test('test setup', async function () {
			this.timeout(5 * 60 * 1000);
			// Prepare the environment and make it ready for testing
			await vscode.commands.executeCommand('test.setupIntegrationTest');
			// Wait for the extensions to load
			await vscode.commands.executeCommand('test.waitForExtensionsToLoad');
			// Reload the window, this is required for some changes made by the 'test.setupIntegrationTest' to work
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
		});
	});
}
