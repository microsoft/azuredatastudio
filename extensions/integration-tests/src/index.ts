/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { context } from './testContext';
import { getSuiteType, SuiteType } from './fmkUtils'

const path = require('path');
const testRunner = require('vscode/lib/testrunner');

const options: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 600000 	// 600 seconds
};
const suite = getSuiteType();
if (suite === SuiteType.Stress)
{
	options.timeout = 7200000;	// 2 hours
}

//setTimeout(function(){debugger;}, 10000);
if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
	console.log(`environment variable BUILD_ARTIFACTSTAGINGDIRECTORY is set to ${process.env.BUILD_ARTIFACTSTAGINGDIRECTORY} so configuring multiple reporters for test results.\n For this to work the ${process.env.BUILD_ARTIFACTSTAGINGDIRECTORY} must be fully qualified directory and must exist`);
	options.reporter = 'mocha-multi-reporters';
	options.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} ${process.platform}`,
			mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
	console.log(`updated testrunner options to:${JSON.stringify(options)}`);
}

if (!vscode.workspace.getConfiguration('test')['testSetupCompleted']) {
	context.RunTest = false;
}

testRunner.configure(options);

export = testRunner;
