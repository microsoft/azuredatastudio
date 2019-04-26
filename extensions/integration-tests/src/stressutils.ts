/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * This module contains all the definitions for Stress decorators and the utility functions and definitions thereof
*/
import { Min, Max, IsInt, validateSync, validate } from 'class-validator';
import 'mocha';
import { AssertionError } from 'assert';
import { getSuiteType, SuiteType } from './fmkUtils';
import assert = require('assert');
import { isString } from 'util';


/**
 * Subclass of Error to wrap any Error objects caught during Stress Execution.
 */
export class StressError extends Error {
	inner: Error | any;
	static code: string = 'ERR_STRESS';

	constructor(error?: any) {
		super();
		//Object.setPrototypeOf(this, StressError);
		this.name = StressError.code;
		this.inner = error;
		if (error instanceof Error) {
			this.message = error.message;
			this.stack = error.stack;
		} else if (error instanceof String) {
			this.message = error.valueOf();
			try {
				throw new Error();
			} catch (e) {
				this.stack = e.stack;
			}
		} else if (isString(error)) {
			this.message = error;
			try {
				throw new Error();
			} catch (e) {
				this.stack = e.stack;
			}
		} else {
			this.message = 'unknown stress error';
		}
	}
}

/**
 * Defines an interface to specify the stress options for stress tests.
 * @param runtime - the number of minutes for which the stress runs. Once this 'runtime' expires stress is terminated even if we have not exceeded {@link iterations} count yet. NYI. This is here for future use to allow really long running stress tests. Default value is provided by environment variable: StressRuntime and if undefined then by {@link DefaultStressOptions}.
 * @param dop - the number of parallel instances of the decorated method to run. Default value is provided by environment variable: StressDop and if undefined then by {@link DefaultStressOptions}.
 * @param iterations - the number of iterations to run in each parallel invocation for the decorated method. {@link runtime} can limit the number of iterations actually run. Default value is provided by environment variable: StressIterations and if undefined then by {@link DefaultStressOptions}.
 * @param passThreshold - the fractional number of all invocations of the decorated method that must pass to declared the stress invocation of that method to be declared passed. Range: 0.0-1.0. Default value is provided by environment variable: StressPassThreshold and if undefined then by {@link DefaultStressOptions}.
 */
export interface StressOptions {
	runtime?: number;
	dop?: number;
	iterations?: number;
	passThreshold?: number;
}

/**
 * The default values for StressOptions.
 */
export const DefaultStressOptions: StressOptions = { runtime: 120, dop: 4, iterations: 10, passThreshold: 0.95 };

/**
 * Defines the shape of stress result object
 */
export interface StressResult {
	numPasses: number;
	fails: Error[];
	errors: Error[];
}


/**
* This simulates a sleep where the thread is suspended without spinning for a given number of milliseconds before resuming
*/
export async function sleep(ms: number) {
	return await (async () => {
		return await new Promise((undefined) => setTimeout(undefined, ms));
	})();
}

/**
* This is just a synonym for sleep(0). This has the affect of yielding to other operations.
*/
export async function bear() {
	return await sleep(0);
}

/**
 * A class with methods that help to implement the stressify decorator.
 * Keeping the core logic of stressification in one place as well as allowing this code to use
 * other decorators if needed.
 */
class Stress {
	// number of iterations.
	@IsInt()
	@Min(0)
	@Max(1000000)
	iterations?: number = DefaultStressOptions.iterations;

	// seconds
	@IsInt()
	@Min(0)
	@Max(72000)
	runtime?: number = DefaultStressOptions.runtime;

	// degree of parallelism
	@IsInt()
	@Min(1)
	@Max(20)
	dop?: number = DefaultStressOptions.dop;

	// threshold for fractional number of individual test passes fo total executed to declare the stress test passed. This is a fraction between 0 and 1.
	@Min(0)
	@Max(1)
	passThreshold?: number = DefaultStressOptions.passThreshold;

	/**
	 * Constructor allows for construction with a bunch of optional parameters
	 *
	 * @param runtime - see {@link StressOptions}.
	 * @param dop - see {@link StressOptions}.
	 * @param iterations - see {@link StressOptions}.
	 * @param passThreshold - see {@link StressOptions}.
	 */
	constructor({ runtime = parseInt(process.env.StressRuntime), dop = parseInt(process.env.StressDop), iterations = parseInt(process.env.StressIterations), passThreshold = parseFloat(process.env.StressPassThreshold) }: StressOptions = DefaultStressOptions) {
		//console.log (`runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		//console.log (`this.runtime=${this.runtime}, this.dop=${this.dop}, this.iterations=${this.iterations}, this.passThreshold=${this.passThreshold}`);
		let x: number;
		x = this.nullCoalesce(runtime, this.runtime); this.runtime = x;
		x = this.nullCoalesce(dop, this.dop); this.dop = x;
		x = this.nullCoalesce(iterations, this.iterations); this.iterations = x;
		x = this.nullCoalesce(passThreshold, this.passThreshold); this.passThreshold = x;

		// validate this object
		//
		validateSync(this).map((error) => { throw error; });
		validate(this).then(errors => {
			if (errors.length > 0) {
				errors.map(error => { throw error; });
				console.log(`validation error in stress object: ${JSON.stringify(errors)}`);
				throw errors;
			}
		}).catch(fatalErrors => {
			if (fatalErrors.length > 0) {
				fatalErrors.map(error => { throw error; });
				console.log(`fatal error while validating stress object: ${JSON.stringify(fatalErrors)}`);
				throw fatalErrors;
			}
		});

		//console.log (`this.runtime=${this.runtime}, this.dop=${this.dop}, this.iterations=${this.iterations}, this.passThreshold=${this.passThreshold}`);
	}

	private nullCoalesce(value: number, defaultValue: number): number {
		//console.log (`nullCoalesce called with value:${value}, defaultValue:${defaultValue}`);
		const retVal = (value === null || value === undefined || isNaN(value)) ? defaultValue : value;
		//console.log (`nullCoalesce will return:${retVal}`);
		return retVal;
	}

	/**
	 *
	 * @param originalMethod - The reference to the originalMethod that is being stressfied.The name of this method is {@link functionName}
	 * @param originalObject - The reference to the object on which the {@link originalMethod} is invoked.
	 * @param functionName - The name of the originalMethod that is being stressfied.
	 * @param args - The invocation argument for the {@link originalMethod}
	 * @param runtime - The desconstructed {@link StressOptions} parameter. see {@link StressOptions} for details.
	 * @param dop - The desconstructed {@link StressOptions} parameter. see {@link StressOptions} for details.
	 * @param iterations - The desconstructed {@link StressOptions} parameter. see {@link StressOptions} for details.
	 * @param passThreshold - The desconstructed {@link StressOptions} parameter. see {@link StressOptions} for details.
	 *
	 * @returns - {@link StressResult}.
	 */
	async Run(
		originalMethod: Function,
		originalObject: any,
		functionName: string,
		args: any[],
		{ runtime, dop, iterations, passThreshold }: StressOptions = DefaultStressOptions
	): Promise<StressResult> {
		// TODO support for cutting of the iterator if runtime has exceeded needs to be implemented.
		//
		//console.log (`runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		runtime = this.nullCoalesce(runtime, this.runtime);
		dop = this.nullCoalesce(dop, this.dop);
		iterations = this.nullCoalesce(iterations, this.iterations);
		passThreshold = this.nullCoalesce(passThreshold, this.passThreshold);
		let numPasses: number = 0;
		let fails = [];
		let errors = [];

		let pendingPromises: Promise<void>[] = [];
		console.log(`Running Stress on ${functionName} or ${JSON.stringify(originalMethod.prototype)} with args: ('${args.join('\',\'')}') with runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		//console.log (`runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		const IterativeLoop = async (t: number) => {
			for (let i = 0; i < iterations; i++) {
				console.log(`starting thread number=${t}:iteration number=${i} instance`);
				try {
					//console.log(`this=${JSON.stringify(this)}`);
					//console.log(`originalObject=${JSON.stringify(originalObject)}`);
					await originalMethod.apply(originalObject, args);
					console.log(`thread number=${t}:iteration number=${i} instance passed`);
					numPasses++;
				}
				catch (err) {
					// If failures can result in errors of other types apart from AssertionError then we need to augument here
					//
					err instanceof AssertionError
						? fails.push(err)
						: errors.push(new StressError(err));
					console.log(`thread number=${t}:iteration number=${i} instance failed/errored with error: ${err}`);
				}
			}
		};

		// Invoke the iterative loop defined above in parallel without awaiting each individually
		//
		for (let t = 0; t < dop; t++) {
			pendingPromises.push(IterativeLoop(t));
		}

		// Now await all of the Promises for each of the above invocation.
		//
		await Promise.all(pendingPromises);

		// TODO what if the above Promise.all exits out due to rejection of one of the promises. Kindly note, that due to the try/catch swallowing and collecting all errors, I currently do not expect this case to happen, but perhaps some defensive code like throwing if that does ever happen is not a bad idea.
		//
		let total = numPasses + errors.length + fails.length;
		assert(numPasses >= passThreshold * total, `Call Stressified: ${functionName}(${args.join(',')}) failed with a pass percent of ${passThreshold * 100}`);
		return { numPasses: numPasses, fails, errors };
	}
}

// the singleton Stress object.
//
const stresser = new Stress();

/**
 * Decorator Factory to return the Method Descriptor function that will stressify any test class method.
		* Using the descriptor factory allows us pass options to the discriptor itself separately from the arguments
		* of the function being modified.
 * @param runtime - The desconstructed {@link StressOptions} option. see {@link StressOptions} for details.
 * @param dop - The desconstructed {@link StressOptions} option. see {@link StressOptions} for details.
 * @param iterations - The desconstructed {@link StressOptions} option. see {@link StressOptions} for details.
 * @param passThreshold - The desconstructed {@link StressOptions} option. see {@link StressOptions} for details.
 */
export function stressify({ runtime, dop, iterations, passThreshold }: StressOptions = DefaultStressOptions): (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor) => PropertyDescriptor {
	// return the function that does the job of stressifying a test class method with decorator @stressify
	//
	console.log(`stressify FactoryDecorator called with runtime=${runtime}, dop=${dop}, iter=${iterations}, passThreshold=${passThreshold}`);

	// The actual decorator function that modifies the original target method pointed to by the memberDiscriptor
	return function (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor): PropertyDescriptor {
		// stressify the target function pointed to by the descriptor.value only if
		// SuiteType is stress
		//
		const suiteType = getSuiteType();
		console.log(`Stressified Decorator called for: ${memberName} and suiteType=${suiteType}`);
		if (suiteType === SuiteType.Stress) {
			// save a reference to the original method
			// this way we keep the values currently in the
			// descriptor and don't overwrite what another
			// decorator might have done to the descriptor.
			console.log(`Stressifying ${memberName} since env variable SuiteType is set to ${SuiteType.Stress}`);
			const originalMethod: Function = memberDescriptor.value;
			//editing the descriptor/value parameter
			memberDescriptor.value = async function (...args: any[]): Promise<StressResult> {
				// note usage of originalMethod here
				//
				assert(stresser !== null && stresser !== undefined, 'stresser object must be defined');
				const result: StressResult = await stresser.Run(originalMethod, this, memberName, args, { runtime, dop, iterations, passThreshold });
				console.log(`Stressified: ${memberName}(${args.join(',')}) returned: ${JSON.stringify(result)}`);
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
