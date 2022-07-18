/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Removes all newlines from the given string, replacing them with spaces
 * @param str The original string
 * @returns The string with all newlines replaced by spaces
 */
export function removeNewLines(str: string): string {
	return str.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
}
