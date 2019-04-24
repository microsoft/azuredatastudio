/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum SuiteType {
	// Please preserve the capitalized casing and list members in alphabetic order.
	//
	Integration = 'Integration',
	Perf = 'Perf',
	Stress = 'Stress',
	Unknown = ''
}

function toCapitalizedCase(inputString: string): string {
	return inputString.toLowerCase().replace(/^.|\s\S/g, (a: string) => a.toUpperCase());
}

let suite: SuiteType = SuiteType.Unknown;
export function getSuiteType() {
	if (suite === SuiteType.Unknown) {
		if (process.env.SuiteType) {
			let suiteType: string = toCapitalizedCase(process.env.SuiteType);
			if (suiteType in SuiteType) {
				suite = SuiteType[suiteType];
			}
		}
	}
	return suite;
}

// decorator function to run some code at decorator load time before other code is evaluated.
export function runWhenCodeLoad(func: Function, ...args) {
	// invoke the 'func' method with given args and then return a decorator function that does not modify th method for which it is called
	//

	//console.log(`Decorator runWhenCodeLoad called for function: ${JSON.stringify(func)} with args: (${args.join(',')})`);
	//
	func.apply(null, args);
	return function (memberClass: any, memberName: string, memberDescriptor: PropertyDescriptor) {
		return memberDescriptor;
	};
}