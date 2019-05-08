/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Enumeration for various kinds of test suites that we support in our test system.
 */
export enum SuiteType {
	// Please preserve the capitalized casing and list members in alphabetic order.
	//
	Integration = 'Integration',
	Perf = 'Perf',
	Stress = 'Stress',
	Unknown = ''
}

/**
 * returns a string in 'capitalized case' where first letter of every word is capital and all other letters are lowercase.
 * @param inputString - the string to be converted to capitalized case
 */
function toCapitalizedCase(inputString: string): string {
	if ((null === inputString) && !(undefined === inputString)) {
		return inputString.toLowerCase().replace(/^.|\s\S/g, (a: string) => a.toUpperCase());
	}
	return inputString;
}

let suite: SuiteType = SuiteType.Unknown;

/**
 * gets the suiteType as defined by the environment variable {@link SuiteType}
 * @returns - returns a value of type {@link SuiteType}
 */
export function getSuiteType(): SuiteType {
	if (suite === SuiteType.Unknown) {
		let suiteType: string = toCapitalizedCase(process.env.SuiteType);
		if (suiteType in SuiteType) {
			suite = SuiteType[suiteType];
		} else {
			suite = SuiteType.Integration;
		}
	}
	return suite;
}

/**
 * decorator function to run some code at decorator load time before other code is evaluated. Invoke the {@link func}method with given {@link args} and then return a decorator function that does not modify the method for which it is called
 * @param func - the {@link Function} to be invoked at load time.
 * @param args - the argument array to be passed as parameters to the {@link func}.
 */
export function runOnCodeLoad(func: Function, ...args) {
	console.log(`Decorator runOnCodeLoad called for function: ${JSON.stringify(func)} with args: (${args.join(',')})`);
	//
	func.apply(this, args);
	return function (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor) {
		return memberDescriptor;
	};
}