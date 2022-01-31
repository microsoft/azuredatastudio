/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const _typeof = {
	number: 'number',
	string: 'string',
	undefined: 'undefined',
	object: 'object',
	function: 'function'
};

/**
 * @returns whether the provided parameter is undefined or null.
 * @param obj
 */
export function isUndefinedOrNull(obj: any): boolean {
	return isUndefined(obj) || obj === null;
}

/**
 * @returns whether the provided parameter is undefined.
 * @param obj
 */
export function isUndefined(obj: any): boolean {
	return typeof (obj) === _typeof.undefined;
}
