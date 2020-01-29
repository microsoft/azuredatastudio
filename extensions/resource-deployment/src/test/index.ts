/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const testRunner = require('vscode/lib/testrunner');

const suite = 'resource-deployment Extension Tests';

const testOptions: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 10000
};

// set relevant mocha options from the environment
if (process.env.ADS_TEST_GREP) {
	testOptions.grep = process.env.ADS_TEST_GREP;
	console.log(`setting options.grep to: ${testOptions.grep}`);
}
if (process.env.ADS_TEST_INVERT_GREP) {
	testOptions.invert = parseInt(process.env.ADS_TEST_INVERT_GREP);
	console.log(`setting options.invert to: ${testOptions.invert}`);
}
if (process.env.ADS_TEST_TIMEOUT) {
	testOptions.timeout = parseInt(process.env.ADS_TEST_TIMEOUT);
	console.log(`setting options.timeout to: ${testOptions.timeout}`);
}
if (process.env.ADS_TEST_RETRIES) {
	testOptions.retries = parseInt(process.env.ADS_TEST_RETRIES);
	console.log(`setting options.retries to: ${testOptions.retries}`);
}

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

testRunner.configure(testOptions);

export = testRunner;
