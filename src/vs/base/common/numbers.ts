/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// {{SQL CARBON EDIT}}
import types = require('vs/base/common/types');

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function rot(index: number, modulo: number): number {
	return (modulo + (index % modulo)) % modulo;
}

// {{SQL CARBON EDIT}}
export type NumberCallback = (index: number) => void;

// {{SQL CARBON EDIT}}
export function count(to: number, callback: NumberCallback): void;
export function count(from: number, to: number, callback: NumberCallback): void;
export function count(fromOrTo: number, toOrCallback?: NumberCallback | number, callback?: NumberCallback): any {
	let from: number;
	let to: number;

	if (types.isNumber(toOrCallback)) {
		from = fromOrTo;
		to = <number>toOrCallback;
	} else {
		from = 0;
		to = fromOrTo;
		callback = <NumberCallback>toOrCallback;
	}

	const op = from <= to ? (i: number) => i + 1 : (i: number) => i - 1;
	const cmp = from <= to ? (a: number, b: number) => a < b : (a: number, b: number) => a > b;

	for (let i = from; cmp(i, to); i = op(i)) {
		callback(i);
	}
}

export function countToArray(to: number): number[];
export function countToArray(from: number, to: number): number[];
export function countToArray(fromOrTo: number, to?: number): number[] {
	const result: number[] = [];
	const fn = (i: number) => result.push(i);

	if (types.isUndefined(to)) {
		count(fromOrTo, fn);
	} else {
		count(fromOrTo, to, fn);
	}

	return result;
}
// {{END SQL CARBON EDIT}}

export class Counter {
	private _next = 0;

	getNext(): number {
		return this._next++;
	}
}
