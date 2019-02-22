/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Throws an error with the provided message if the provided value does not evaluate to a true Javascript value.
 */
export function ok(value?: any, message?: string) {
	if (!value || value === null) {
		throw new Error(message ? 'Assertion failed (' + message + ')' : 'Assertion Failed');
	}
}
