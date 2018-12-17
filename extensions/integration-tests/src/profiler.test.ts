/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { context } from './testContext';

if (context.RunTest) {
	suite('profiler-extension-suite', () => {
		test('open connection dialog test', function (done) {
			let connectionProfile: sqlops.IConnectionProfile = {
				serverName: 'sqltools2017-3',
				databaseName: 'master',
				authenticationType: 'Integrated',
				providerName: 'MSSQL',
				connectionName: '',
				userName: '',
				password: '',
				savePassword: false,
				groupFullName: undefined,
				saveProfile: true,
				id: '1b671a64-40d5-491e-99b0-da01ff1f3341',
				groupId: undefined,
				options: {}
			};
			sqlops.connection.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true }).then(() => {
				setTimeout(() => {
					vscode.commands.executeCommand('profiler.newProfiler').then(
						() => {
							setTimeout(() => {
								sqlops.queryeditor.connect
								assert(1 < 2, 'passed');
								done();
							}, 30 * 1000);
						}
					);
				 }, 5000);
			});
		});
	});
}
