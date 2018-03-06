/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as Types from 'vs/base/common/types';

export function clone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result = (Array.isArray(obj)) ? <any>[] : <any>{};
	Object.keys(obj).forEach(key => {
		if (obj[key] && typeof obj[key] === 'object') {
			result[key] = clone(obj[key]);
		} else {
			result[key] = obj[key];
		}
	});
	return result;
}

/**
 * A copy of the vs mixin that accepts a custom behavior function
 */
export function mixin(destination: any, source: any, overwrite: boolean = true, fn?: (destination: any, source: any, overwrite?: boolean) => any): any {
	if (!Types.isObject(destination)) {
		return source;
	}

	if (Types.isObject(source)) {
		Object.keys(source).forEach((key) => {
			if (key in destination) {
				if (overwrite) {
					if (Types.isObject(destination[key]) && Types.isObject(source[key])) {
						mixin(destination[key], source[key], overwrite, fn);
					} else if (fn) {
						destination[key] = fn(destination[key], source[key], overwrite);
					} else {
						destination[key] = source[key];
					}
				}
			} else {
				destination[key] = source[key];
			}
		});
	}
	return destination;
}

export function entries<T>(o: { [key: string]: T }): [string, T][] {
	return Object.entries(o);
}

export function values<T>(o: { [key: string]: T }): T[] {
	return Object.values(o);
}
