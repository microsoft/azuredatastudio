/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
const testRunner = require('vscodetestcover');

const suite = 'Database Projects Extension Tests';

const mochaOptions: any = {
	ui: 'bdd',
	useColors: true,
	timeout: 10000
};

// set relevant mocha options from the environment
if (process.env.ADS_TEST_GREP) {
	mochaOptions.grep = process.env.ADS_TEST_GREP;
	console.log(`setting options.grep to: ${mochaOptions.grep}`);
}
if (process.env.ADS_TEST_INVERT_GREP) {
	mochaOptions.invert = parseInt(process.env.ADS_TEST_INVERT_GREP);
	console.log(`setting options.invert to: ${mochaOptions.invert}`);
}
if (process.env.ADS_TEST_TIMEOUT) {
	mochaOptions.timeout = parseInt(process.env.ADS_TEST_TIMEOUT);
	console.log(`setting options.timeout to: ${mochaOptions.timeout}`);
}
if (process.env.ADS_TEST_RETRIES) {
	mochaOptions.retries = parseInt(process.env.ADS_TEST_RETRIES);
	console.log(`setting options.retries to: ${mochaOptions.retries}`);
}

if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
	mochaOptions.reporter = 'mocha-multi-reporters';
	mochaOptions.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} ${process.platform}`,
			mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
}

testRunner.configure(mochaOptions, { coverConfig: '../../coverConfig.json' });

export = testRunner;
