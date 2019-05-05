/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'mocha';
import { runOnCodeLoad, getSuiteType, SuiteType } from '../src/fmkUtils';
import { stressify, sleep, bear, StressResult } from '../src/stressutils';
import assert = require('assert');

class StressifyTester {
	static dop: number = 5;
	static iter: number = 6;

	t: number = 0;
	f: number = 0;
	e: number = 0;

	@runOnCodeLoad(StressifyTester.prototype.setup)
	setup() {
		process.env.SuiteType = 'Stress';
		console.log(`environment variable SuiteType set to ${process.env.SuiteType}`);
	}

	randomString(length: number = 8): string {
		// ~~ is double bitwise not operator which is a faster substitute for Math.floor() for positive numbers. Techinically ~~ just removes everything to the right of decimal point.
		//
		return [...Array(length)].map(i => (~~(Math.random() * 36)).toString(36)).join('');
	}

	envVariableTests() {
		let origSuiteType: string = process.env.SuiteType;

		const tests = [
			{
				'testDescription': `env SuiteType set to undefined should default to ${SuiteType.Integration}`,
				'envSuiteType': undefined,
				'expected': SuiteType.Integration
			},
			{
				'testMessage': `env SuiteType set to empty string should default to ${SuiteType.Integration}`,
				'envSuiteType': '',
				'expected': SuiteType.Integration
			},
			{
				'testDescription': `env SuiteType set to null should default to ${SuiteType.Integration}`,
				'envSuiteType': null,
				'expected': SuiteType.Integration
			},
			{
				'testDescription': `env SuiteType set to random string which is not ${SuiteType.Stress} or ${SuiteType.Perf} should default to ${SuiteType.Integration}`,
				'envSuiteType': `${this.randomString()}`,
				'expected': SuiteType.Integration
			},
			{
				'testDescription': `env SuiteType set to ${SuiteType.Stress} string should default to ${SuiteType.Integration}`,
				'envSuiteType': 'sTreSS',
				'expected': SuiteType.Stress
			},
			{
				'testDescription': `env SuiteType set to ${SuiteType.Stress} string should default to ${SuiteType.Integration}`,
				'envSuiteType': 'PErf',
				'expected': SuiteType.Perf
			},
		];
		delete process.env.SuiteType;
		assert.equal(getSuiteType(), SuiteType.Integration, `When env SuiteType is not set/present then SuiteType is set to ${SuiteType.Integration}`);
		tests.map(test => {
			process.env.SuiteType = test.envSuiteType;
			assert.equal(getSuiteType(), test.expected, test.testMessage);
		});

		process.env.SuiteType = origSuiteType;
	}

	@stressify({ dop: StressifyTester.dop, iterations: StressifyTester.iter })
	async basicTest() {
		await bear();	// yield to other operations.
		this.t++;
	}

	@stressify({ dop: StressifyTester.dop, iterations: StressifyTester.iter, passThreshold: 0 })
	async testStressStats() {
		this.t++;
		if (this.t % 5 === 0) { //for every 5th invocation
			this.f++;
			assert.fail(`failing the ${this.t}th invocation`);
		} else if (this.t % 7 === 0) { //for every 7th invocation
			this.e++;
			throw new Error(`Erroring out ${this.t}th invocation`);
		}
		await sleep(2); // sleep for 2 ms without spinning
	}
}

suite('StressUtils unit tests', function () {
	setup(function () {
		this.Tester = new StressifyTester();
	});
	test('basicTest', async function () {
		console.log('invoking basicTest()');
		let retVal: StressResult = await this.Tester.basicTest();
		console.log(`test basicTest done, total invocations=${this.Tester.t}`);
		console.log(`test retVal is ${JSON.stringify(retVal)}`);
		assert(retVal.numPasses === StressifyTester.dop * StressifyTester.iter, `total invocations should be ${StressifyTester.dop * StressifyTester.iter}`);
	});
	test('testStressStats', async function () {
		console.log('invoking testStressStats()');
		let retVal: StressResult = await this.Tester.testStressStats();
		console.log(`test testStressStats done, total invocations=${this.Tester.t}`);
		console.log(`test retVal is ${JSON.stringify(retVal)}`);
		assert(retVal.numPasses + retVal.fails.length + retVal.errors.length === StressifyTester.dop * StressifyTester.iter, `total invocations should be ${StressifyTester.dop * StressifyTester.iter}`);
		assert.equal(retVal.fails.length, this.Tester.f, `Number of failures does not match the expected`);
		assert.equal(retVal.errors.length, this.Tester.e, `Number of errors does not match the expected`);
	});
});
