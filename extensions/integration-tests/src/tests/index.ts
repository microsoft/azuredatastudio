/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as testRunner from 'vscode/lib/testrunner';
import * as path from 'path';

const suite = 'Extension Integration Tests';

const options: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 600000
};

// set relevant mocha options from the environment
if (process.env.ADS_TEST_GREP) {
	options.grep = process.env.ADS_TEST_GREP;
	console.log(`setting options.grep to: ${options.grep}`);
}
if (process.env.ADS_TEST_INVERT_GREP) {
	const value = parseInt(process.env.ADS_TEST_INVERT_GREP);
	options.invert = Boolean(value);
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
	console.log(`environment variable BUILD_ARTIFACTSTAGINGDIRECTORY is set to ${process.env.BUILD_ARTIFACTSTAGINGDIRECTORY} so configuring multiple reporters for test results.\n For this to work the ${process.env.BUILD_ARTIFACTSTAGINGDIRECTORY} must be fully qualified directory and must exist`);
	options.reporter = 'mocha-multi-reporters';
	options.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} Tests ${process.platform}`,
			mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
}

testRunner.configure(options);

export = testRunner;
