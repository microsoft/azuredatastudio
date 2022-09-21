/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const Mocha = require('mocha');
const minimist = require('minimist');

const [, , ...args] = process.argv;
const opts = minimist(args, {
	boolean: 'web',
	string: ['f', 'g']
});

const suite = opts['web'] ? 'Browser Smoke Tests' : 'Smoke Tests';

const options = {
	color: true,
	timeout: 300000,
	slow: 30000,
	grep: opts['f'] || opts['g']
};

if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
	options.reporter = 'mocha-multi-reporters';
	options.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} ${process.platform}`,
			mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${process.arch}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
}

const mocha = new Mocha(options);

// {{SQL CARBON EDIT}} - If grep option is specified, only run the matching test cases (local test case development/debug scenario),
// otherwise the value of 'RUN_UNSTABLE_TESTS' environment variable will used to decide whether to run the stable test cases or the whole test suite.
// Unstable test cases have "@UNSTABLE@" in their full name (test suite name + test name).
if (!options.grep) {
	if (process.env.RUN_UNSTABLE_TESTS === 'true') {
		console.info('running all test cases.');
	} else {
		console.info('running stable test cases.');
		mocha.grep('@UNSTABLE@').invert();
	}
} else {
	console.info('running test cases match the grep option.');
}
// {{SQL CARBON EDIT}} - end of edit.

mocha.addFile('out/main.js');
mocha.run(failures => process.exit(failures ? -1 : 0));
