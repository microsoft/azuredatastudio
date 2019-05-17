/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'mocha';
import { sleep, bear, getSuiteType, SuiteType } from '../utils';
import { stressify, StressResult } from '../stress';
import assert = require('assert');

const debug = require('debug')('unittest:stress');
const trace = require('debug')('unittest:stress:trace');

/**
 * decorator function to run some code at decorator load time before other code is evaluated. Invoke the {@link func} method with given {@link args}
 * 		and then return a decorator function that does not modify the method for which it is called.
 * @param func - the {@link Function} to be invoked at load time.
 * @param args - the argument array to be passed as parameters to the {@link func}.
 */
function runOnCodeLoad(func: Function, ...args) {
	func.apply(this, args);
	return function (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor) {
		trace(`Decorator runOnCodeLoad called for function: ${memberName}, on object: ${JSON.stringify(this)} with args: (${args.join(',')})`);
		return memberDescriptor;
	};
}

class StressifyTester {
	static dop: number = 5;
	static iter: number = 6;

	t: number = 0;
	f: number = 0;
	e: number = 0;

	@runOnCodeLoad(StressifyTester.prototype.setEnvVariableSuiteType, 'Stress')
	setEnvVariableSuiteType(suiteType: string) {
		process.env.SuiteType = suiteType;
		debug(`environment variable SuiteType set to ${process.env.SuiteType}`);
	}

	static randomString(length: number = 8): string {
		// ~~ is double bitwise not operator which is a faster substitute for Math.floor() for positive numbers.
		//	Techinically ~~ just removes everything to the right of decimal point.
		//
		return [...Array(length)].map(i => (~~(Math.random() * 36)).toString(36)).join('');
	}

	envVariableTest(tst: { 'testDescription': string; 'envSuiteType': string; 'expected': SuiteType; }) {
		let origSuiteType: string = process.env.SuiteType;
		try {
			process.env.SuiteType = tst.envSuiteType;
			trace(`setting env.SuiteType to: ${process.env.SuiteType}`);
			const suiteType = getSuiteType();
			trace(`suiteType evaluated to: ${suiteType} by getSuiteType() function`);
			assert.equal(suiteType, tst.expected);
		}
		finally {
			process.env.SuiteType = origSuiteType;
		}
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
			assert.strictEqual(true, false, `failing the ${this.t}th invocation`);
		} else if (this.t % 7 === 0) { //for every 7th invocation
			this.e++;
			throw new Error(`Erroring out ${this.t}th invocation`);
		}
		await sleep(2); // sleep for 2 ms without spinning
	}
}

suite('Stress Fmks unit tests', function () {
	setup(function () {
		this.Tester = new StressifyTester();
	});

	const envSuiteTypeTests = [
		{
			'testDescription': `EnvVar Test:1:: env SuiteType set to undefined should default to ${SuiteType.Integration}`,
			'envSuiteType': undefined,
			'expected': SuiteType.Integration
		},
		{
			'testDescription': `EnvVar Test:2:: env SuiteType set to empty string should default to ${SuiteType.Integration}`,
			'envSuiteType': '',
			'expected': SuiteType.Integration
		},
		{
			'testDescription': `EnvVar Test:3::env SuiteType set to null should default to ${SuiteType.Integration}`,
			'envSuiteType': null,
			'expected': SuiteType.Integration
		},
		{
			'testDescription': `EnvVar Test:4::env SuiteType set to random string which is not ${SuiteType.Stress} or ${SuiteType.Perf} should default to ${SuiteType.Integration}`,
			'envSuiteType': `${StressifyTester.randomString()}`,
			'expected': SuiteType.Integration
		},
		{
			'testDescription': `EnvVar:5::env SuiteType set to ${SuiteType.Stress} string should default to ${SuiteType.Integration}`,
			'envSuiteType': 'sTreSS', // Casing is mixed on purpose
			'expected': SuiteType.Stress
		},
		{
			'testDescription': `EnvVar:6::env SuiteType set to ${SuiteType.Stress} string should default to ${SuiteType.Integration}`,
			'envSuiteType': 'PErf', // Casing is mixed on purpose
			'expected': SuiteType.Perf
		},
	];

	//Environment Variable Tests
	//
	test(`EnvVar Test:1:: env SuiteType is not set/present should default to ${SuiteType.Integration}`, async function () {
		delete process.env.SuiteType;
		assert.equal(getSuiteType(), SuiteType.Integration);
	});
	envSuiteTypeTests.forEach(tst => {
		test(tst.testDescription, async function () {
			this.Tester.envVariableTest(tst);
		});
	});

	// TODO Parameter validation tests for Stress constructor and Stress.Ru()) method.
	//
	//


	// Basic Positive test for canonical use case.
	//
	test('Basic Positive Test, ensures multiple threads and iterations gets performed as expected', async function () {
		debug('invoking basicTest()');
		let retVal: StressResult = await this.Tester.basicTest();
		debug(`test basicTest done, total invocations=${this.Tester.t}`);
		debug(`test retVal is ${JSON.stringify(retVal, undefined, '\t')}`);
		assert(retVal.numPasses === StressifyTester.dop * StressifyTester.iter, `total invocations should be ${StressifyTester.dop * StressifyTester.iter}`);
	});

	// Basic Positive test for canonical use case.
	//
	test('Verifies Pass, Fail, Error counts of stress execution', async function () {
		debug('invoking testStressStats()');
		let retVal: StressResult = await this.Tester.testStressStats();
		debug(`test testStressStats done, total invocations=${this.Tester.t}`);
		debug(`test retVal is ${JSON.stringify(retVal, undefined, '\t')}`);
		assert(retVal.numPasses + retVal.fails.length + retVal.errors.length === StressifyTester.dop * StressifyTester.iter, `total invocations should be ${StressifyTester.dop * StressifyTester.iter}`);
		assert.equal(retVal.fails.length, this.Tester.f, `Number of failures does not match the expected`);
		assert.equal(retVal.errors.length, this.Tester.e, `Number of errors does not match the expected`);
	});
});


