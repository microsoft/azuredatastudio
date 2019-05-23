/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as os from 'os';
const INVALID_FILE_CHARS_Windows = /[\\/:\*\?"<>\|]/g;
const INVALID_FILE_CHARS = /[\\/]/g;

/**
 * Determines if a given character is a valid filename character
 * @param c Character to validate
 */
export function isValidFilenameCharacter(c: string): boolean {
	// only a character should be passed
	if (!c || c.length !== 1) {
		return false;
	}
	let isWindows = os.platform() === 'win32';
	INVALID_FILE_CHARS_Windows.lastIndex = 0;
	INVALID_FILE_CHARS.lastIndex = 0;
	if (isWindows && INVALID_FILE_CHARS_Windows.test(c)) {
		return false;
	} else if (!isWindows && INVALID_FILE_CHARS.test(c)) {
		return false;
	}

	return true;
}


/**
 * Replaces invalid filename characters in a string with underscores
 * @param s The string to be sanitized for a filename
 */
export function sanitizeStringForFilename(s: string): string {
	// replace invalid characters with an underscore
	let result = '';
	for (let i = 0; i < s.length; ++i) {
		result += this.isValidFilenameCharacter(s[i]) ? s[i] : '_';
	}

	return result;
}