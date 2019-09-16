/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { SuiteType, getSuiteType } from 'adstest';

import { context } from './testContext';

import path = require('path');
import testRunner = require('vscode/lib/testrunner');

const suite = getSuiteType();

const options: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 600000 	// 600 seconds
};

if (suite === SuiteType.Stress) {
	options.timeout = 7200000;	// 2 hours
	if (process.env.StressRuntime) {
		options.timeout = (120 + 1.2 * parseInt(process.env.StressRuntime)) * 1000; // allow sufficient timeout based on StressRuntime setting
		console.log(`setting options.timeout to:${options.timeout} based on process.env.StressRuntime value of ${process.env.StressRuntime} seconds`);
	}
}

// set relevant mocha options from the environment
if (process.env.mochaGrep) {
	console.log(`setting options.grep to:${process.env.mochaGrep}`);
	options.grep = process.env.mochaGrep;
}
if (process.env.mochaFgrep) {
	console.log(`setting options.fgrep to:${process.env.mochaFgrep}`);
	options.fgrep = process.env.mochaFgrep;
}
if (process.env.mochaInvert) {
	console.log(`setting options.fgrep to:${process.env.mochaInvert}`);
	options.invert = process.env.mochaInvert;
}
if (process.env.mochaSlow) {
	console.log(`setting options.slow to:${process.env.mochaSlow}`);
	options.slow = process.env.mochaSlow;
}
if (process.env.mochaTimeout) {
	console.log(`setting options.slow to:${process.env.mochaTimeout}`);
	options.timeout = process.env.mochaTimeout;
}
if (process.env.mochaRetries) {
	console.log(`setting options.fgrep to:${process.env.mochaRetries}`);
	options.retries = process.env.mochaRetries;
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

if (!vscode.workspace.getConfiguration('test')['testSetupCompleted']) {
	context.RunTest = false;
}

testRunner.configure(options);

export = testRunner;
