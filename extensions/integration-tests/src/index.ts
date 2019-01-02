/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { context } from './testContext';

const path = require('path');
const testRunner = require('vscode/lib/testrunner');

const suite = 'ADS Integration Tests';

const options: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 600000
};


options.reporter = 'mocha-multi-reporters';
options.reporterOptions = {
	reporterEnabled: 'spec, mocha-junit-reporter',
	mochaJunitReporterReporterOptions: {
		testsuitesTitle: `${suite} ${process.platform}`,
		mochaFile: path.join(__dirname, '../../../', `/extension-test-results.xml`)
	}
};

if (!vscode.workspace.getConfiguration('test')['testSetupCompleted']) {
	context.RunTest = false;
}

testRunner.configure(options);

export = testRunner;
