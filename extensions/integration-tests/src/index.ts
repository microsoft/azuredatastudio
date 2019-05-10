/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { context } from './testContext';

const path = require('path');
import * as testRunner from 'vscodetestcover';

const suite = 'Integration Tests';

const testOptions: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 600000
};

const coverageConfig: any = {
	coverConfig: '../coverageConfig.json'
};

if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
	testOptions.reporter = 'mocha-multi-reporters';
	testOptions.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} ${process.platform}`,
			mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
}

if (!vscode.workspace.getConfiguration('test')['testSetupCompleted']) {
	context.RunTest = false;
}

testRunner.configure(testOptions, coverageConfig);

export = testRunner;
