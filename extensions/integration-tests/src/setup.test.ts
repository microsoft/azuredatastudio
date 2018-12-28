/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as vscode from 'vscode';
import { context } from './testContext';

suite('test setup', () => {
	test('test setup', async function () {
		if (!context.RunTest) {
			vscode.commands.executeCommand('test.setupIntegrationTest');
		}
	});
});