/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const Mocha = require('mocha');
const minimist = require('minimist');

const suite = 'Smoke Tests';

const [, , ...args] = process.argv;
const opts = minimist(args, {
	string: [
		'f'
	]
});

const options = {
	useColors: true,
	//{{SQL CARBON EDIT}}
	timeout: 60000 * 2,
	//{{END}}
	slow: 30000,
	grep: opts['f']
};
//{{SQL CARBON EDIT}}
options.reporter = 'mocha-multi-reporters';
options.reporterOptions = {
	reporterEnabled: 'spec, mocha-junit-reporter',
	mochaJunitReporterReporterOptions: {
		testsuitesTitle: `${suite} ${process.platform}`,
		mochaFile: path.join(__dirname,'../../../', `smoke-test-results.xml`)
	}
};
//{{END}}

const mocha = new Mocha(options);
mocha.addFile('out/main.js');
mocha.run(failures => process.exit(failures ? -1 : 0));
