/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

/**
 * Alterable version of the vs memorize function; to unmemoize use unmemoize
*/
export function memoize(target: any, key: string, descriptor: any) {
	let fnKey: string | null = null;
	let fn: Function | null = null;

	if (typeof descriptor.value === 'function') {
		fnKey = 'value';
		fn = descriptor.value;

		if (fn!.length !== 0) {
			console.warn('Memoize should only be used in functions with zero parameters');
		}
	} else if (typeof descriptor.get === 'function') {
		fnKey = 'get';
		fn = descriptor.get;
	}

	if (!fn) {
		throw new Error('not supported');
	}

	const memoizeKey = `$memoize$${key}`;

	descriptor[fnKey!] = function (...args: any[]) {
		if (!this.hasOwnProperty(memoizeKey)) {
			Object.defineProperty(this, memoizeKey, {
				configurable: true,
				enumerable: false,
				writable: false,
				value: fn!.apply(this, args)
			});
		}

		return this[memoizeKey];
	};
}

export function unmemoize(target: Object, key: string) {
	const memoizeKey = `$memoize$${key}`;
	if (target.hasOwnProperty(memoizeKey)) {
		delete target[memoizeKey];
	}
}
