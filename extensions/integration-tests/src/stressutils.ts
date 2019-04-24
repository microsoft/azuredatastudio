/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
	This contains all the definitions for Stress decorators and the utility functions and definitions thereof
*/
import 'mocha';
import { AssertionError } from 'assert';
import { getSuiteType, SuiteType } from './fmkUtils';
import assert = require('assert');

export interface StressOptions {
	runtime?: number;
	dop?: number;
	iterations?: number;
	passThreshold?: number;
}

// This simulates a sleep where the thread is suspended for a given number of milliseconds before resuming
//
export function sleep(ms:number) {
	return (async () => {
		return await new Promise((undefined) => setTimeout(undefined, ms));
	})();
}

// This is just a synonym for sleep(0). This has the affect of yielding to other operations.
//
export function bear() {
	return sleep(0);
}

class Stress {
	// number of iterations.
	iterations: number = 25;
	// seconds
	runtime: number = 120;
	// degree of parallelism
	dop: number = 8;
	// threshold of individual test passes to declare the stress test passed. This is a fraction within 1.
	passThreshold?: number = 0.95;

	constructor({ runtime = process.env.StressRunTime, dop = process.env.StressDop, iterations = process.env.StressIterations, passThreshold = process.env.StressPassThreshold }: StressOptions) {
		//console.log (`runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		//console.log (`this.runtime=${this.runtime}, this.dop=${this.dop}, this.iterations=${this.iterations}, this.passThreshold=${this.passThreshold}`);
		this.runtime = this.nullCoalesce(runtime, this.runtime);
		this.dop = this.nullCoalesce(dop, this.dop);
		this.iterations = this.nullCoalesce(iterations, this.iterations);
		this.passThreshold = this.nullCoalesce(passThreshold, this.passThreshold);
		//console.log (`this.runtime=${this.runtime}, this.dop=${this.dop}, this.iterations=${this.iterations}, this.passThreshold=${this.passThreshold}`);
	}

	private nullCoalesce(value: number, defaultValue: number): number {
		return (value === undefined || value === null) ? defaultValue : value;
	}

	async Run(originalMethod: any, originalObject: any, functionName: string, args: any[], { runtime, dop, iterations, passThreshold }: StressOptions = null) {
		// TODO validation of parameter bounds for runtime, dop, iterations and passThreshold
		// TODO support for cutting of the iterator is runtime has exceeded needs to be implemented.
		//
		//console.log (`runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		runtime = this.nullCoalesce(runtime, this.runtime);
		dop = this.nullCoalesce(dop, this.dop);
		iterations = this.nullCoalesce(iterations, this.iterations);
		passThreshold = this.nullCoalesce(passThreshold, this.passThreshold);
		let noPasses: number = 0;
		let fails = [];
		let errors = [];

		let pendingPromises:Promise<void>[] = [];
		console.log(`Running Stress on ${functionName}(${args.join(',')}) with runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		//console.log (`runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		const IterativeLoop = async (tNo:number) => {
			for (let iNo = 0; iNo < iterations; iNo++) {
				console.log(`starting tNo=${tNo}:iNo=${iNo} instance`);
				try {
					//console.log(`this=${JSON.stringify(this)}`);
					//console.log(`originalObject=${JSON.stringify(originalObject)}`);
					await originalMethod.apply(originalObject, args);
					console.log(`tNo=${tNo}:iNo=${iNo} instance passed`);
				}
				catch (err) {
					// If failures can result in errors of other types apart from AssertionError then we need to augument here
					//
					err instanceof AssertionError ? fails.push(err) : errors.push(err);
					console.log(`tNo:iNo=${tNo}:${iNo} instance failed/errored`);
				}
				noPasses++;
			}
		};

		// Invoke the iterative loop defined above in parallel without awaiting each individually
		//
		for (let tNo=0; tNo < dop; tNo++) {
			pendingPromises.push(IterativeLoop(tNo));
		}

		// Now await all of the Promises for each of the above invocation.
		await Promise.all(pendingPromises);

		// TODO what if the above Promise.all exits out due to rejection of one of the promises. Need to handle that case.
		//
		let total = noPasses + errors.length + fails.length;
		assert(noPasses >= passThreshold * total, `Call Stressified: ${functionName}(${args.join(',')}) failed with a pass percent of ${passThreshold*100}`);
		return {noPasses, fails, errors};
	}
}

// Descriptor Factory to return the Method Descriptor function that will stressify any test class method.
// Using the descriptor factory allows us pass parameters to the discriptor itself separately from the arguments of the
// function being modified.
//
export function stressify ({ runtime, dop, iterations, passThreshold }: StressOptions = null) {
	// return the function that does the job of stressifying a test class method with descriptor @stressify
	//
	console.log(`stressifyFactory called runtime=${runtime}, dop=${dop}, iter=${iterations}, passThreshold=${passThreshold}`);
	const stress = new Stress({});
	return function(memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor) {
		// stressify the target function pointed to by the descriptor.value only if
		// SuiteType is stress
		//
		const suiteType = getSuiteType();
		console.log(`Stressified Decorator called for: ${memberName} and suiteType=${suiteType}`);
		if (suiteType === SuiteType.Stress)
		{
			// save a reference to the original method
			// this way we keep the values currently in the
			// descriptor and don't overwrite what another
			// decorator might have done to the descriptor.
			console.log(`Stressifying ${memberName} since env variable SuiteType is set to ${SuiteType.Stress}`);
			const originalMethod : Function = memberDescriptor.value;
			//editing the descriptor/value parameter
			memberDescriptor.value =  async function (...args: any[]) {
				// note usage of originalMethod here
				console.log(`this=${JSON.stringify(this)}`);
				var result = await stress.Run(originalMethod, this, memberName, args, {runtime, dop, iterations, passThreshold});
				var r = JSON.stringify(result);
				console.log(`Call Stressified: ${memberName}(${args.join(',')}) => ${r}`);
				return result;
			};
			// return edited descriptor that has stressified the original method pointed to by this descriptor
			//
			return memberDescriptor;
		}

		// return the original discriptor unedited so that the method pointed to it remains the same as before
		//
		return memberDescriptor;
	};
}
