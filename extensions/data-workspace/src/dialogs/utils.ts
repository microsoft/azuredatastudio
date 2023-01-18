/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as constants from '../common/constants';

import * as os from 'os';
import * as path from 'path';

const WINDOWS_INVALID_FILE_CHARS = /[\\/:\*\?"<>\|]/g;
const UNIX_INVALID_FILE_CHARS = /[\\/]/g;
const isWindows = os.platform() === 'win32';
const WINDOWS_FORBIDDEN_NAMES = /^(con|prn|aux|clock\$|nul|lpt[0-9]|com[0-9])$/i;

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
		return constants.undefinedFilenameErrorMessage;
	}

	if (isWindows && name[name.length - 1] === '.') {
		return constants.filenameEndingIsPeriodErrorMessage; // Windows: file cannot end with a "."
	}

	let basename = path.parse(name).name;
	if (!basename || basename.length === 0 || /^\s+$/.test(basename)) {
		return constants.whitespaceFilenameErrorMessage; // require a name that is not just whitespace
	}

	invalidFileChars.lastIndex = 0;
	if (invalidFileChars.test(basename)) {
		return constants.invalidFileCharsErrorMessage; // check for certain invalid file characters
	}

	if (isWindows && WINDOWS_FORBIDDEN_NAMES.test(basename)) {
		return constants.reservedWindowsFilenameErrorMessage; // check for certain invalid file names
	}

	if (basename === '.' || basename === '..') {
		return constants.reservedValueErrorMessage; // check for reserved values
	}

	if (isWindows && basename.length !== basename.trim().length) {
		return constants.trailingWhitespaceErrorMessage; // Windows: file cannot end with a whitespace
	}

	if (basename.length > 255) {
		return constants.tooLongFilenameErrorMessage; // most file systems do not allow files > 255 length
	}

	return '';
}
