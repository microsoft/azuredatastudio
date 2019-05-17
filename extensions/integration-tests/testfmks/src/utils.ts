/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const debug = require('debug')('testfmks:utils');
const trace = require('debug')('testfmks:utils:trace');
/**
 * Enumeration for various kinds of test suites that we support in our test system.
 */
export enum SuiteType {
	// Please preserve the capitalized casing and list members in alphabetic order.
	//
	Integration = 'Integration',
	Perf = 'Perf',
	Stress = 'Stress',
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
 * gets the suiteType as defined by the environment variable {@link SuiteType}
 * @returns - returns a value of type {@link SuiteType}
 */
export function getSuiteType(): SuiteType {
	let suite: SuiteType = null;
	debug(`process.env.SuiteType at when getSuiteType was called is: ${process.env.SuiteType}`);
	let suiteType: string = toCapitalizedCase(process.env.SuiteType);
	trace(`Capitalized suiteType is ${process.env.SuiteType}`);
	if (suiteType in SuiteType) {
		trace(`${process.env.SuiteType} is in SuiteType enumeration: ${JSON.stringify(SuiteType)}`);
		suite = SuiteType[suiteType];
		trace(`so return value of suiteType was set to ${JSON.stringify(suite)}`);
	} else {
		trace(`${process.env.SuiteType} is not in SuiteType enumeration: ${JSON.stringify(SuiteType)}`);
		suite = SuiteType.Integration;
		trace(`so return value of suiteType was set to ${JSON.stringify(suite)}`);
	}
	debug(`return suiteType is:${JSON.stringify(suite)}`);
	return suite;
}

/**
 * decorator function to run some code at decorator load time before other code is evaluated. Invoke the {@link func}method with given {@link args} and then return a decorator function that does not modify the method for which it is called
 * @param func - the {@link Function} to be invoked at load time.
 * @param args - the argument array to be passed as parameters to the {@link func}.
 */
export function runOnCodeLoad(func: Function, ...args) {
	func.apply(this, args);
	return function (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor) {
		trace(`Decorator runOnCodeLoad called for function: ${memberName}, on object: ${JSON.stringify(this)} with args: (${args.join(',')})`);
		return memberDescriptor;
	};
}


/**
 * returns a string in 'capitalized case' where first letter of every word is capital and all other letters are lowercase.
 * @param inputString - the string to be converted to capitalized case
 */
function toCapitalizedCase(inputString: string): string {
	if (null !== inputString && undefined !== inputString) {
		return inputString.toLowerCase().replace(/^.|\s\S/g, (a: string) => a.toUpperCase());
	}
	return inputString;
}