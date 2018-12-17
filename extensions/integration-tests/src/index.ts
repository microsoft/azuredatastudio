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

if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
	options.reporter = 'mocha-multi-reporters';
	options.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} ${process.platform}`,
			mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
}

if (!vscode.workspace.getConfiguration('adstest')['testSetupCompleted']) {
	context.RunTest = false;
	vscode.workspace.getConfiguration().update('workbench.enablePreviewFeatures', true, true);
	vscode.workspace.getConfiguration().update('workbench.showConnectDialogOnStartup', false, true);
	vscode.workspace.getConfiguration().update('adstest.testSetupCompleted', true, true);
}

testRunner.configure(options);

export = testRunner;
