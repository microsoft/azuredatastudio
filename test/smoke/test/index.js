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
mocha.addFile('out/main.js');
mocha.run(failures => process.exit(failures ? -1 : 0));
