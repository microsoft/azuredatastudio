/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Types from 'vs/base/common/types';

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
