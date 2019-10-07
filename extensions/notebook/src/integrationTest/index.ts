/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const testRunner = require('vscode/lib/testrunner');

const suite = 'notebook Extension Integration Tests';

const options: any = {
	ui: 'bdd',
	useColors: true,
	timeout: 600000
};

// set relevant mocha options from the environment
if (process.env.ADS_TEST_GREP) {
	options.grep = process.env.ADS_TEST_GREP;
	console.log(`setting options.grep to: ${options.grep}`);
}
if (process.env.ADS_TEST_INVERT_GREP) {
	options.invert = parseInt(process.env.ADS_TEST_INVERT_GREP);
	console.log(`setting options.invert to: ${options.invert}`);
}
if (process.env.ADS_TEST_TIMEOUT) {
	options.timeout = parseInt(process.env.ADS_TEST_TIMEOUT);
	console.log(`setting options.timeout to: ${options.timeout}`);
}
if (process.env.ADS_TEST_RETRIES) {
	options.retries = parseInt(process.env.ADS_TEST_RETRIES);
	console.log(`setting options.retries to: ${options.retries}`);
}

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

testRunner.configure(options);

export = testRunner;
