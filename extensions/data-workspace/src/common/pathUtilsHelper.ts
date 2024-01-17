/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from './constants';
import * as os from 'os';

const WINDOWS_INVALID_FILE_CHARS = /[\\/:\*\?"<>\|]/g;
const UNIX_INVALID_FILE_CHARS = /[\\/]/g;
const isWindows = os.platform() === 'win32';
const WINDOWS_FORBIDDEN_NAMES = /^(con|prn|aux|clock\$|nul|lpt[0-9]|com[0-9])$/i;

/**
 * Determines if a given character is a valid filename character
 * @param c Character to validate
 */
export function isValidFilenameCharacter(c: string): boolean {
	// only a character should be passed
	if (!c || c.length !== 1) {
		return false;
	}
	WINDOWS_INVALID_FILE_CHARS.lastIndex = 0;
	UNIX_INVALID_FILE_CHARS.lastIndex = 0;
	if (isWindows && WINDOWS_INVALID_FILE_CHARS.test(c)) {
		return false;
	} else if (!isWindows && UNIX_INVALID_FILE_CHARS.test(c)) {
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
	for (let i = 0; i < s?.length; ++i) {
		result += isValidFilenameCharacter(s[i]) ? s[i] : '_';
	}

	return result;
}

/**
 * Returns true if the string is a valid filename
 * Logic is copied from src\vs\base\common\extpath.ts
 * @param fileName filename to check (without file path)
 */
export function isValidBasename(fileName?: string): boolean {
	if (isValidBasenameErrorMessage(fileName) !== undefined) {
		return false;	//Return false depicting filename is invalid
	} else {
		return true;
	}


}

/**
 * Returns specific error message if file name is invalid otherwise returns undefined
 * Logic is copied from src\vs\base\common\extpath.ts
 * @param fileName filename to check (without file path)
 */
export function isValidBasenameErrorMessage(fileName?: string): string | undefined {
	const invalidFileChars = isWindows ? WINDOWS_INVALID_FILE_CHARS : UNIX_INVALID_FILE_CHARS;
	if (!fileName) {
		return constants.undefinedFilenameErrorMessage;
	}

	if (isWindows && fileName[fileName.length - 1] === '.') {
		return constants.filenameEndingIsPeriodErrorMessage; // Windows: file cannot end with a "."
	}

	if (!fileName || fileName.length === 0 || /^\s+$/.test(fileName)) {
		return constants.whitespaceFilenameErrorMessage; // require a name that is not just whitespace
	}

	invalidFileChars.lastIndex = 0;
	if (invalidFileChars.test(fileName)) {
		return constants.invalidFileCharsErrorMessage; // check for certain invalid file characters
	}

	if (isWindows && WINDOWS_FORBIDDEN_NAMES.test(fileName)) {
		return constants.reservedWindowsFilenameErrorMessage; // check for certain invalid file names
	}

	if (fileName === '.' || fileName === '..') {
		return constants.reservedValueErrorMessage; // check for reserved values
	}

	if (isWindows && fileName.length !== fileName.trim().length) {
		return constants.trailingWhitespaceErrorMessage; // Windows: file cannot start or end with a whitespace
	}

	if (fileName.length > 255) {
		return constants.tooLongFilenameErrorMessage; // most file systems do not allow files > 255 length
	}

	return undefined;
}
