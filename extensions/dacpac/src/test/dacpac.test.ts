/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import * as os from 'os';
import * as path from 'path';
import { isValidFilenameCharacter, sanitizeStringForFilename, isValidBasename } from '../wizard/api/utils';

const isWindows = os.platform() === 'win32';

describe('Sanitize database name for filename tests', function (): void {
	it('Should only validate if one character is passed', async () => {
		should(isValidFilenameCharacter(null)).equal(false);
		should(isValidFilenameCharacter('')).equal(false);
		should(isValidFilenameCharacter('abc')).equal(false);
		should(isValidFilenameCharacter('c')).equal(true);
	});

	it('Should determine invalid file name characters', async () => {
		// invalid for both Windows and non-Windows
		should(isValidFilenameCharacter('\\')).equal(false);
		should(isValidFilenameCharacter('/')).equal(false);
	});

	it('Should determine invalid Windows file name characters', async () => {
		// invalid only for Windows
		should(isValidFilenameCharacter('?')).equal(isWindows ? false : true);
		should(isValidFilenameCharacter(':')).equal(isWindows ? false : true);
		should(isValidFilenameCharacter('*')).equal(isWindows ? false : true);
		should(isValidFilenameCharacter('<')).equal(isWindows ? false : true);
		should(isValidFilenameCharacter('>')).equal(isWindows ? false : true);
		should(isValidFilenameCharacter('|')).equal(isWindows ? false : true);
		should(isValidFilenameCharacter('"')).equal(isWindows ? false : true);
	});

	it('Should sanitize database name for filename', async () => {
		let invalidDbName = '"in|valid*<>db/?name';
		let expectedWindows = '_in_valid___db__name';
		let expectedNonWindows = '"in|valid*<>db_?name';
		let isWindows = os.platform() === 'win32';
		should(sanitizeStringForFilename(invalidDbName)).equal(isWindows ? expectedWindows : expectedNonWindows);
	});
});

describe('Check for invalid filename tests', function (): void {
	it('Should determine invalid filenames', async () => {
		// valid filename
		should(isValidBasename(formatFileName('ValidName.dacpac'))).equal(true);

		// invalid for both Windows and non-Windows
		should(isValidBasename(formatFileName('	.dacpac'))).equal(false);
		should(isValidBasename(formatFileName(' .dacpac'))).equal(false);
		should(isValidBasename(formatFileName('  	.dacpac'))).equal(false);
		should(isValidBasename(formatFileName('..dacpac'))).equal(false);
		should(isValidBasename(formatFileName('...dacpac'))).equal(false);
		should(isValidBasename(null)).equal(false);
		should(isValidBasename(undefined)).equal(false);
		should(isValidBasename('\\')).equal(false);
		should(isValidBasename('/')).equal(false);

		// most file systems do not allow files > 255 length
		should(isValidBasename(formatFileName('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.dacpac'))).equal(false);
	});

	it('Should determine invalid Windows filenames', async () => {
		// invalid characters only for Windows
		should(isValidBasename(formatFileName('?.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName(':.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('*.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('<.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('>.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('|.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('".dacpac'))).equal(isWindows ? false : true);

		// Windows filenames cannot end with a whitespace
		should(isValidBasename(formatFileName('test   .dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('test	.dacpac'))).equal(isWindows ? false : true);
	});

	it('Should determine Windows forbidden filenames', async () => {
		// invalid only for Windows
		should(isValidBasename(formatFileName('CON.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('PRN.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('AUX.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('NUL.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM1.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM2.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM3.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM4.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM5.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM6.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM7.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM8.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM9.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT1.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT2.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT3.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT4.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT5.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT6.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT7.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT8.dacpac'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT9.dacpac'))).equal(isWindows ? false : true);
	});
});

function formatFileName(filename: string): string {
	return path.join(os.tmpdir(), filename);
}
