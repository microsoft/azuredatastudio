/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

suite('profiler-extension-suite', () => {
	test('open connection dialog test', function (done) {
		vscode.commands.executeCommand('profiler.newProfiler').then(
			() => {
				sqlops.connection.openConnectionDialog().then(() => {
					assert(1 < 2, 'passed');
					done();
				});
			}
		);
	});
});
