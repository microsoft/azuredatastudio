/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as constants from '../../common/constants';
import * as os from 'os';
import { isValidBasename, isValidBasenameErrorMessage } from '../../common/pathUtilsHelper';

const isWindows = os.platform() === 'win32';

suite('Check for invalid filename tests', function (): void {
	test('Should determine invalid filenames', async () => {
		// valid filename
		should(isValidBasename('ValidName')).equal(true);

		// invalid for both Windows and non-Windows
		let invalidNames: string[] = [
			'	',
			' ',
			'  	',
			'.',
			'..',
			// most file systems do not allow files > 255 length
			'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
		];

		for (let invalidName of invalidNames) {
			should(isValidBasename(invalidName)).equal(false, `InvalidName that failed:${invalidName}`);
		}

		should(isValidBasename(undefined)).equal(false);
		should(isValidBasename('\\')).equal(false);
		should(isValidBasename('/')).equal(false);
	});

	test('Should determine invalid Windows filenames', async () => {
		let invalidNames: string[] = [
			// invalid characters only for Windows
			'?',
			':',
			'*',
			'<',
			'>',
			'|',
			'"',
			'/',
			'\\',
			// Windows filenames cannot start or end with a whitespace
			'test   ',
			'test	',
			' test'
		];

		for (let invalidName of invalidNames) {
			should(isValidBasename(invalidName)).equal(isWindows ? false : true, `InvalidName that failed:${invalidName}`);
		}
	});

	test('Should determine Windows forbidden filenames', async () => {
		let invalidNames: string[] = [
			// invalid only for Windows
			'CON',
			'PRN',
			'AUX',
			'NUL',
			'COM1',
			'COM2',
			'COM3',
			'COM4',
			'COM5',
			'COM6',
			'COM7',
			'COM8',
			'COM9',
			'LPT1',
			'LPT2',
			'LPT3',
			'LPT4',
			'LPT5',
			'LPT6',
			'LPT7',
			'LPT8',
			'LPT9',
		];

		for (let invalidName of invalidNames) {
			should(isValidBasename(invalidName)).equal(isWindows ? false : true);
		}
	});
});

suite('Check for invalid filename error tests', function (): void {
	test('Should determine invalid filenames', async () => {
		// valid filename
		should(isValidBasenameErrorMessage('ValidName')).equal(undefined);

		// invalid for both Windows and non-Windows
		should(isValidBasenameErrorMessage('	')).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(' ')).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage('  	')).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage('.')).equal(constants.filenameEndingIsPeriodErrorMessage);
		should(isValidBasenameErrorMessage('..')).equal(constants.filenameEndingIsPeriodErrorMessage);
		should(isValidBasenameErrorMessage(undefined)).equal(constants.undefinedFilenameErrorMessage);
		should(isValidBasenameErrorMessage('\\')).equal(constants.invalidFileCharsErrorMessage);
		should(isValidBasenameErrorMessage('/')).equal(constants.invalidFileCharsErrorMessage);
		should(isValidBasenameErrorMessage(' ')).equal(constants.whitespaceFilenameErrorMessage);

		// most file systems do not allow files > 255 length
		should(isValidBasenameErrorMessage('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).equal(constants.tooLongFilenameErrorMessage);
	});

	test('Should determine invalid Windows filenames', async () => {
		let invalidNames: string[] = [
			// invalid characters only for Windows
			'?',
			':',
			'*',
			'<',
			'>',
			'|',
			'"',
			'\\',
			'/'
		];

		for (let invalidName of invalidNames) {
			should(isValidBasenameErrorMessage(invalidName)).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		}
		// Windows filenames cannot start or end with a whitespace
		should(isValidBasenameErrorMessage('test   ')).equal(isWindows ? constants.trailingWhitespaceErrorMessage : '');
		should(isValidBasenameErrorMessage('test	')).equal(isWindows ? constants.trailingWhitespaceErrorMessage : '');
		should(isValidBasenameErrorMessage(' test')).equal(isWindows ? constants.trailingWhitespaceErrorMessage : '');
	});

	test('Should determine Windows forbidden filenames', async () => {
		let invalidNames: string[] = [
			// invalid only for Windows
			'CON',
			'PRN',
			'AUX',
			'NUL',
			'COM1',
			'COM2',
			'COM3',
			'COM4',
			'COM5',
			'COM6',
			'COM7',
			'COM8',
			'COM9',
			'LPT1',
			'LPT2',
			'LPT3',
			'LPT4',
			'LPT5',
			'LPT6',
			'LPT7',
			'LPT8',
			'LPT9',
		];

		for (let invalidName of invalidNames) {
			should(isValidBasenameErrorMessage(invalidName)).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '', `InvalidName that failed:${invalidName}`);
		}
	});
});


