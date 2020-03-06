/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as os from 'os';
import * as path from 'path';
import * as loc from '../../localizedConstants';
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
	let isWindows = os.platform() === 'win32';
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
	for (let i = 0; i < s.length; ++i) {
		result += this.isValidFilenameCharacter(s[i]) ? s[i] : '_';
	}

	return result;
}

/**
 * Returns true if the string is a valid filename
 * Logic is copied from src\vs\base\common\extpath.ts
 * @param name filename to check
 */
export function isValidBasename(name: string | null | undefined): boolean {
	const invalidFileChars = isWindows ? WINDOWS_INVALID_FILE_CHARS : UNIX_INVALID_FILE_CHARS;

	if (!name) {
		return false;
	}

	if (isWindows && name[name.length - 1] === '.') {
		return false; // Windows: file cannot end with a "."
	}

	let basename = path.parse(name).name;
	if (!basename || basename.length === 0 || /^\s+$/.test(basename)) {
		return false; // require a name that is not just whitespace
	}

	invalidFileChars.lastIndex = 0;
	if (invalidFileChars.test(basename)) {
		return false; // check for certain invalid file characters
	}

	if (isWindows && WINDOWS_FORBIDDEN_NAMES.test(basename)) {
		return false; // check for certain invalid file names
	}

	if (basename === '.' || basename === '..') {
		return false; // check for reserved values
	}

	if (isWindows && basename.length !== basename.trim().length) {
		return false; // Windows: file cannot end with a whitespace
	}

	if (basename.length > 255) {
		return false; // most file systems do not allow files > 255 length
	}

	return true;
}

/**
 * Returns specific error message if file name is invalid
 * Logic is copied from src\vs\base\common\extpath.ts
 * @param name filename to check
 */
export function isValidBasenameErrorMessage(name: string | null | undefined): string {
	const invalidFileChars = isWindows ? WINDOWS_INVALID_FILE_CHARS : UNIX_INVALID_FILE_CHARS;
	if (!name) {
		return loc.undefinedFilenameErrorMessage;
	}

	if (isWindows && name[name.length - 1] === '.') {
		return loc.filenameEndingIsPeriodErrorMessage; // Windows: file cannot end with a "."
	}

	let basename = path.parse(name).name;
	if (!basename || basename.length === 0 || /^\s+$/.test(basename)) {
		return loc.whitespaceFilenameErrorMessage; // require a name that is not just whitespace
	}

	invalidFileChars.lastIndex = 0;
	if (invalidFileChars.test(basename)) {
		return loc.invalidFileCharsErrorMessage; // check for certain invalid file characters
	}

	if (isWindows && WINDOWS_FORBIDDEN_NAMES.test(basename)) {
		return loc.reservedWindowsFilenameErrorMessage; // check for certain invalid file names
	}

	if (basename === '.' || basename === '..') {
		return loc.reservedValueErrorMessage; // check for reserved values
	}

	if (isWindows && basename.length !== basename.trim().length) {
		return loc.trailingWhitespaceErrorMessage; // Windows: file cannot end with a whitespace
	}

	if (basename.length > 255) {
		return loc.tooLongFilenameErrorMessage; // most file systems do not allow files > 255 length
	}

	return '';
}

export function generateDatabaseName(filePath: string): string {
	return path.parse(filePath).name;
}
