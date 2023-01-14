/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as IstanbulTestRunner from 'vscodetestcover';
import * as fs from 'fs-extra';
let testRunner: any = IstanbulTestRunner;

// Use an optional test filter to only run some tests. This file is added to .gitignore
// so should never be included in any checkin, otherwise we'll disable most tests for everyone
let testFilter = fs.readJsonSync(__dirname + '/../../.vscode/dev.testfilter.json').grep;
// You can directly control Mocha options by uncommenting the following lines
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure(
	// Mocha Options
	{
		ui: 'bdd', // the TDD UI is being used in extension.test.ts (suite, test, etc.)
		reporter: 'pm-mocha-jenkins-reporter',
		reporterOptions: {
			junit_report_name: 'Extension Tests',
			junit_report_path: __dirname + '/../../test-reports/extension_tests.xml',
			junit_report_stack: 1
		},
		grep: testFilter,
		useColors: true // colored output from test results
	},
	// Coverage configuration options
	{
		coverConfig: '../../coverconfig.json'
	});

module.exports = testRunner;
