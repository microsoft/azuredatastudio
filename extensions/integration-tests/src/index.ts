/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as testRunner from 'vscode/lib/testrunner';
import { SuiteType, getSuiteType } from 'adstest';
import * as path from 'path';

const suite = getSuiteType();

const options: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 600000
};

if (suite === SuiteType.Stress) {
	options.timeout = 7200000;	// 2 hours
	// StressRuntime sets the default run time in stress/perf mode for those suites. By default ensure that there is sufficient timeout available.
	// if ADS_TEST_TIMEOUT is also defined then that value overrides this calculated timeout value. User needs to ensure that ADS_TEST_GREP > StressRuntime if
	// both are set.
	if (process.env.StressRuntime) {
		options.timeout = (120 + 1.2 * parseInt(process.env.StressRuntime)) * 1000; // allow sufficient timeout based on StressRuntime setting
		console.log(`setting options.timeout to: ${options.timeout} based on process.env.StressRuntime value of ${process.env.StressRuntime} seconds`);
	}
}

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
