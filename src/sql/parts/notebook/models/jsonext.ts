/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
/**
 * A type alias for a JSON primitive.
 */
export declare type JSONPrimitive = boolean | number | string | null;
/**
 * A type alias for a JSON value.
 */
export declare type JSONValue = JSONPrimitive | JSONObject | JSONArray;
/**
 * A type definition for a JSON object.
 */
export interface JSONObject {
	[key: string]: JSONValue;
}
/**
 * A type definition for a JSON array.
 */
export interface JSONArray extends Array<JSONValue> {
}
/**
 * A type definition for a readonly JSON object.
 */
export interface ReadonlyJSONObject {
	readonly [key: string]: ReadonlyJSONValue;
}
/**
 * A type definition for a readonly JSON array.
 */
export interface ReadonlyJSONArray extends ReadonlyArray<ReadonlyJSONValue> {
}
/**
 * A type alias for a readonly JSON value.
 */
export declare type ReadonlyJSONValue = JSONPrimitive | ReadonlyJSONObject | ReadonlyJSONArray;
/**
 * Test whether a JSON value is a primitive.
 *
 * @param value - The JSON value of interest.
 *
 * @returns `true` if the value is a primitive,`false` otherwise.
 */
export function isPrimitive(value: any): boolean {
	return (
		value === null ||
		typeof value === 'boolean' ||
		typeof value === 'number' ||
		typeof value === 'string'
	);
}
