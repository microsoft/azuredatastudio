/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * This module contains all the definitions for Stress decorators and the utility functions and definitions thereof
*/
import { Min, Max, IsInt, validate } from 'class-validator';
import 'mocha';
import { AssertionError } from 'assert';
import { getSuiteType, SuiteType, bear } from './utils';
import assert = require('assert');
import { isString } from 'util';

const logPrefix = 'testfmks:stress';
const debug = require('debug')(logPrefix);
const trace = require('debug')(`${logPrefix}:trace`);
/**
 * Subclass of Error to wrap any Error objects caught during Stress Execution.
 */
export class StressError extends Error {
	inner: Error | any;
	static code: string = 'ERR_STRESS';

	constructor(error?: any) {
		super();
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
 * @param runtime - the number of seconds (fractional values are allowed, least count is 1 millisecond) for which the stress runs. Once this 'runtime' expires stress is terminated even if we have not exceeded {@link iterations} count yet. Default value is provided by environment variable: StressRuntime and if undefined then by {@link DefaultStressOptions}.
 * @param dop - the number of parallel instances of the decorated method to run. Default value is provided by environment variable: StressDop and if undefined then by {@link DefaultStressOptions}.
 * @param iterations - the number of iterations to run in each parallel invocation for the decorated method. {@link runtime} can limit the number of iterations actually run. Default value is provided by environment variable: StressIterations and if undefined then by {@link DefaultStressOptions}.
 * @param passThreshold - the fractional number of all invocations of the decorated method that must pass to declared the stress invocation of that method to be declared passed. Range: 0.0-1.0. Default value is provided by environment variable: StressPassThreshold and if undefined then by {@link DefaultStressOptions}.
 */

export interface StressOptionsType {
	runtime?: number;
	dop?: number;
	iterations?: number;
	passThreshold?: number;
}

/**
 * The default values for StressOptions.
 */
export const DefaultStressOptions: StressOptionsType = { runtime: 7200, dop: 4, iterations: 50, passThreshold: 0.95 };

/**
 * Defines an implementation of StressOptionsType. The constructor of this implementation merges the
 * {@link DefaultStressOptions} with the values defined by environment variable where corresponding environment variables are:
 * 		StressRuntime - corresponds to {@link StressOptionsType.runtime}
 *	 	StressDop - corresponds to {@link StressOptionsType.dop}
 *	 	StressIterations - corresponds to {@link StressOptionsType.iterations}
 *	 	StressPassThreshold - corresponds to {@link StressOptionsType.passThreshold}
 * The environment variable where defined wins and precedes the value defined by {@link DefaultStressOptions}
 */
class StressOptions implements StressOptionsType {
	public runtime?: number;
	public dop?: number;
	public iterations?: number;
	public passThreshold?: number;

	constructor(runtime = parseFloat(process.env.StressRuntime), dop = parseInt(process.env.StressDop), iterations = parseInt(process.env.StressIterations), passThreshold = parseFloat(process.env.StressPassThreshold)) {
		this.runtime = nullCoalesce(runtime, DefaultStressOptions.runtime);
		this.dop = nullCoalesce(dop, DefaultStressOptions.dop);
		this.iterations = nullCoalesce(iterations, DefaultStressOptions.iterations);
		this.passThreshold = nullCoalesce(passThreshold, DefaultStressOptions.passThreshold);
		assert(this.runtime !== undefined && this.dop !== undefined && this.iterations !== undefined && this.passThreshold !== undefined);
	}
}


const MergedStressOptions: StressOptionsType = new StressOptions();
/**
 * Defines the shape of stress result object
 */
export interface StressResult {
	numPasses: number;
	fails: Error[];
	errors: Error[];
}

/**
 * A class with methods that help to implement the stressify decorator.
 * Keeping the core logic of stressification in one place as well as allowing this code to use
 * other decorators if needed.
 */
class Stress {
	// Number of iterations.
	@IsInt()
	@Min(0)
	@Max(1000000)
	iterations?: number = MergedStressOptions.iterations;

	// Seconds. Fractional values are allowed.
	@Min(0)
	@Max(72000)
	runtime?: number = MergedStressOptions.runtime;

	// Degree of parallelism
	@IsInt()
	@Min(1)
	@Max(20)
	dop?: number = MergedStressOptions.dop;

	// Threshold for fractional number of individual test passes fo total executed to declare the stress test passed. This is a fraction between 0 and 1.
	@Min(0)
	@Max(1)
	passThreshold?: number = MergedStressOptions.passThreshold;

	/**
	 * Constructor allows for construction with a bunch of optional parameters
	 *
	 * @param runtime - see {@link StressOptionsType}.
	 * @param dop - see {@link StressOptionsType}.
	 * @param iterations - see {@link StressOptionsType}.
	 * @param passThreshold - see {@link StressOptionsType}.
	 */
	constructor({ runtime = parseFloat(process.env.StressRuntime), dop = parseInt(process.env.StressDop), iterations = parseInt(process.env.StressIterations), passThreshold = parseFloat(process.env.StressPassThreshold) }: StressOptionsType = MergedStressOptions) {
		const trace = require('debug')(`${logPrefix}:constructor:trace`);
		trace(`parameters: runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		trace(`default properties this stress object at beginning of constructor: this.runtime=${this.runtime}, this.dop=${this.dop}, this.iterations=${this.iterations}, this.passThreshold=${this.passThreshold}`);
		this.runtime = nullCoalesce(runtime, this.runtime);
		this.dop = nullCoalesce(dop, this.dop);
		this.iterations = nullCoalesce(iterations, this.iterations);
		this.passThreshold = nullCoalesce(passThreshold, this.passThreshold);

		// validate this object
		//
		validate(this).then(errors => {
			if (errors.length > 0) {
				debug(`validation error in stress object: ${JSON.stringify(errors, undefined, '\t')}`);
				throw errors;
			}
		}).catch(fatalErrors => {
			if (fatalErrors.length > 0) {
				debug(`fatal error while validating stress object: ${JSON.stringify(fatalErrors, undefined, '\t')}`);
				throw fatalErrors;
			}
		});

		trace(`properties of this stress object post full construction with given parameters are: this.runtime=${this.runtime}, this.dop=${this.dop}, this.iterations=${this.iterations}, this.passThreshold=${this.passThreshold}`);
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
	async run(
		originalMethod: Function,
		originalObject: any,
		functionName: string,
		args: any[],
		{ runtime, dop, iterations, passThreshold }: StressOptions = MergedStressOptions
	): Promise<StressResult> {
		trace(`run method called with parameters: originalMethod=${JSON.stringify(originalMethod, undefined, '\t')} originalObject=${JSON.stringify(originalObject, undefined, '\t')} functionName=${JSON.stringify(functionName, undefined, '\t')}  args=${JSON.stringify(args, undefined, '\t')}`);
		trace(`run method called with StressOptions: runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		runtime = nullCoalesce(runtime, this.runtime);
		dop = nullCoalesce(dop, this.dop);
		iterations = nullCoalesce(iterations, this.iterations);
		passThreshold = nullCoalesce(passThreshold, this.passThreshold);
		let numPasses: number = 0;
		let fails = [];
		let errors = [];

		let pendingPromises: Promise<void>[] = [];
		const debug = require('debug')(`${logPrefix}:${functionName}`);
		debug(`Running Stress on ${functionName} with args: ('${args.join('\',\'')}') with runtime=${runtime}, dop=${dop}, iterations=${iterations}, passThreshold=${passThreshold}`);
		let timedOut: boolean = false;

		// Setup a timer to set timedOut to true when this.runtime number of seconds have elapsed.
		//
		setTimeout(() => {
			timedOut = true;
			trace(`flagging time out. ${this.runtime} seconds are up`);
		}, this.runtime * 1000);

		const IterativeLoop = async (t: number) => {
			const debug = require('debug')(`${logPrefix}:${functionName}:thread-${t}`);
			for (let i = 0; i < iterations; i++) {
				debug(`starting iteration number: ${i}`);
				try {
					await originalMethod.apply(originalObject, args);
					debug(`iteration number=${i} passed`);
					numPasses++;
					bear(); // bear (yield) to other threads so that timeout timer gets a chance to fire.
					if (timedOut) {
						debug(`timed out after ${i}th iteration, timeout of ${this.runtime} has expired `);
						break; // break out of the loop
					}
				}
				catch (err) {
					// If failures can result in errors of other types apart from AssertionError then we will need to augument here
					//
					err instanceof AssertionError
						? fails.push(err)
						: errors.push(new StressError(err));
					console.warn(`warn: iteration number=${i} on thread-${t} failed/errored with error: ${err}`);
					debug(`iteration number=${i} failed/errored with error: ${err}`);
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
		await Promise.all(pendingPromises).catch(fatalError => {
			debug(`A fatal error was encountered running stress thread: ${JSON.stringify(fatalError, undefined, '\t')}`);
			throw fatalError;
		});

		let total = numPasses + errors.length + fails.length;
		assert(numPasses >= passThreshold * total, `Call Stressified: ${functionName}(${args.join(',')}) failed with a expected pass percent of ${passThreshold * 100}, actual pass percent is: ${numPasses * 100 / total}`);
		return { numPasses: numPasses, fails: fails, errors: errors };
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
export function stressify({ runtime, dop, iterations, passThreshold }: StressOptionsType = MergedStressOptions): (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor) => PropertyDescriptor {
	// return the function that does the job of stressifying a test class method with decorator @stressify
	//
	debug(`stressify FactoryDecorator called with runtime=${runtime}, dop=${dop}, iter=${iterations}, passThreshold=${passThreshold}`);

	// The actual decorator function that modifies the original target method pointed to by the memberDiscriptor
	//
	return function (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor): PropertyDescriptor {
		// stressify the target function pointed to by the descriptor.value only if SuiteType is stress
		//
		const suiteType = getSuiteType();
		debug(`Stressified Decorator called for: ${memberName} and suiteType=${suiteType}`);
		if (suiteType === SuiteType.Stress) {
			debug(`Stressifying ${memberName} since env variable SuiteType is set to ${SuiteType.Stress}`);
			// save a reference to the original method, this way we keep the values currently in the descriptor and not overwrite what another
			// decorator might have done to this descriptor by return the original descriptor.
			//
			const originalMethod: Function = memberDescriptor.value;
			//modifying the descriptor's value parameter to point to a new method which is the stressified version of the originalMethod
			//
			memberDescriptor.value = async function (...args: any[]): Promise<StressResult> {
				// note usage of originalMethod here
				//
				const result: StressResult = await stresser.run(originalMethod, this, memberName, args, { runtime, dop, iterations, passThreshold });
				debug(`Stressified: ${memberName}(${args.join(',')}) returned: ${JSON.stringify(result, undefined, '\t')}`);
				return result;
			};
		}

		// return the original discriptor unedited so that the method pointed to it remains the same as before
		// the method pointed to by this descriptor was modifed to a stressified version of the origMethod if SuiteType was Stress.
		//
		return memberDescriptor;
	};
}

function nullCoalesce(value: number, defaultValue: number): number {
	return (value === null || value === undefined || isNaN(value)) ? defaultValue : value;
}
