/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

const { join } = require('path');
const Mocha = require('mocha');
const minimist = require('minimist');

const [, , ...args] = process.argv;
const opts = minimist(args, {
	boolean: ['web'],
	string: ['f', 'g']
});

const suite = opts['web'] ? 'Browser Smoke Tests' : 'Desktop Smoke Tests';

const options = {
	color: true,
	timeout: 2 * 60 * 1000,
	slow: 30 * 1000,
	grep: opts['f'] || opts['g']
};

if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
	options.reporter = 'mocha-multi-reporters';
	options.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} ${process.platform}`,
			mochaFile: join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${process.arch}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
}

// {{SQL CARBON EDIT}} - If grep option is specified, only run the matching test cases (local test case development/debug scenario),
// otherwise the value of 'RUN_UNSTABLE_TESTS' environment variable will be used to determine whether to run the stable test cases or the whole test suite.
// Unstable test cases have "@UNSTABLE@" in their full name (test suite name + test name).
if (!options.grep) {
	if (process.env.RUN_UNSTABLE_TESTS === 'true') {
		console.info('running all test cases.');
	} else {
		console.info('running stable test cases.');
		options.grep= '@UNSTABLE@';
		options.invert = true;
	}
} else {
	console.info('running test cases match the grep option.');
}
// {{SQL CARBON EDIT}} - end of edit.

const mocha = new Mocha(options);

mocha.addFile('out/main.js');
mocha.run(failures => {

	// Indicate location of log files for further diagnosis
	if (failures) {
		const rootPath = join(__dirname, '..', '..', '..');
		const logPath = join(rootPath, '.build', 'logs');

		if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
			console.log(`
###################################################################
#                                                                 #
# Logs are attached as build artefact and can be downloaded       #
# from the build Summary page (Summary -> Related -> N published) #
#                                                                 #
# Show playwright traces on: https://trace.playwright.dev/        #
#                                                                 #
###################################################################
		`);
		} else {
			console.log(`
#############################################
#
# Log files of client & server are stored into
# '${logPath}'.
#
# Logs of the smoke test runner are stored into
# 'smoke-test-runner.log' in respective folder.
#
#############################################
		`);
		}
	}

	process.exit(failures ? -1 : 0);
});
