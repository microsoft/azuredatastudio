/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as constants from '../../common/constants';
import * as os from 'os';
import * as path from 'path';
import { isValidBasename, isValidBasenameErrorMessage } from '../../common/pathUtilsHelper';

const isWindows = os.platform() === 'win32';

suite('Check for invalid filename tests', function (): void {
	test('Should determine invalid filenames', async () => {
		// valid filename
		should(isValidBasename(formatFileName('ValidName.sqlproj'))).equal(true);

		// invalid for both Windows and non-Windows
		let invalidNames: string[] = [
			'	.sqlproj',
			' .sqlproj',
			'  	.sqlproj',
			'..sqlproj',
			'...sqlproj',
			// most file systems do not allow files > 255 length
			'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.sqlproj'
		];

		for (let invalidName of invalidNames) {
			should(isValidBasename(formatFileName(invalidName))).equal(false);
		}

		should(isValidBasename(undefined)).equal(false);
		should(isValidBasename('\\')).equal(false);
		should(isValidBasename('/')).equal(false);
	});

	test('Should determine invalid Windows filenames', async () => {
		let invalidNames: string[] = [
			// invalid characters only for Windows
			'?.sqlproj',
			':.sqlproj',
			'*.sqlproj',
			'<.sqlproj',
			'>.sqlproj',
			'|.sqlproj',
			'".sqlproj',
			// Windows filenames cannot end with a whitespace
			'test   .sqlproj',
			'test	.sqlproj'
		];

		for (let invalidName of invalidNames) {
			should(isValidBasename(formatFileName(invalidName))).equal(isWindows ? false : true);
		}
	});

	test('Should determine Windows forbidden filenames', async () => {
		let invalidNames: string[] = [
			// invalid only for Windows
			'CON.sqlproj',
			'PRN.sqlproj',
			'AUX.sqlproj',
			'NUL.sqlproj',
			'COM1.sqlproj',
			'COM2.sqlproj',
			'COM3.sqlproj',
			'COM4.sqlproj',
			'COM5.sqlproj',
			'COM6.sqlproj',
			'COM7.sqlproj',
			'COM8.sqlproj',
			'COM9.sqlproj',
			'LPT1.sqlproj',
			'LPT2.sqlproj',
			'LPT3.sqlproj',
			'LPT4.sqlproj',
			'LPT5.sqlproj',
			'LPT6.sqlproj',
			'LPT7.sqlproj',
			'LPT8.sqlproj',
			'LPT9.sqlproj',
		];

		for (let invalidName of invalidNames) {
			should(isValidBasename(formatFileName(invalidName))).equal(isWindows ? false : true);
		}
	});
});

suite('Check for invalid filename error tests', function (): void {
	test('Should determine invalid filenames', async () => {
		// valid filename
		should(isValidBasenameErrorMessage(formatFileName('ValidName.sqlproj'))).equal('');

		// invalid for both Windows and non-Windows
		should(isValidBasenameErrorMessage(formatFileName('	.sqlproj'))).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName(' .sqlproj'))).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('  	.sqlproj'))).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('..sqlproj'))).equal(constants.reservedValueErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('...sqlproj'))).equal(constants.reservedValueErrorMessage);
		should(isValidBasenameErrorMessage(undefined)).equal(constants.undefinedFilenameErrorMessage);
		should(isValidBasenameErrorMessage('\\')).equal(isWindows ? constants.whitespaceFilenameErrorMessage : constants.invalidFileCharsErrorMessage);
		should(isValidBasenameErrorMessage('/')).equal(constants.whitespaceFilenameErrorMessage);

		// most file systems do not allow files > 255 length
		should(isValidBasenameErrorMessage(formatFileName('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.sqlproj'))).equal(constants.tooLongFilenameErrorMessage);
	});

	test('Should determine invalid Windows filenames', async () => {
		let invalidNames: string[] = [
			// invalid characters only for Windows
			'?.sqlproj',
			':.sqlproj',
			'*.sqlproj',
			'<.sqlproj',
			'>.sqlproj',
			'|.sqlproj',
			'".sqlproj'
		];

		for (let invalidName of invalidNames) {
			should(isValidBasenameErrorMessage(formatFileName(invalidName))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		}
		// Windows filenames cannot end with a whitespace
		should(isValidBasenameErrorMessage(formatFileName('test   .sqlproj'))).equal(isWindows ? constants.trailingWhitespaceErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('test	.sqlproj'))).equal(isWindows ? constants.trailingWhitespaceErrorMessage : '');
	});

	test('Should determine Windows forbidden filenames', async () => {
		let invalidNames: string[] = [
			// invalid only for Windows
			'CON.sqlproj',
			'PRN.sqlproj',
			'AUX.sqlproj',
			'NUL.sqlproj',
			'COM1.sqlproj',
			'COM2.sqlproj',
			'COM3.sqlproj',
			'COM4.sqlproj',
			'COM5.sqlproj',
			'COM6.sqlproj',
			'COM7.sqlproj',
			'COM8.sqlproj',
			'COM9.sqlproj',
			'LPT1.sqlproj',
			'LPT2.sqlproj',
			'LPT3.sqlproj',
			'LPT4.sqlproj',
			'LPT5.sqlproj',
			'LPT6.sqlproj',
			'LPT7.sqlproj',
			'LPT8.sqlproj',
			'LPT9.sqlproj',
		];

		for (let invalidName of invalidNames) {
			should(isValidBasenameErrorMessage(formatFileName(invalidName))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		}
	});
});

function formatFileName(filename: string): string {
	return path.join(os.tmpdir(), filename);
}

