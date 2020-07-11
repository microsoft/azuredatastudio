/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import * as os from 'os';
import * as path from 'path';
import * as loc from '../localizedConstants';
import { isValidFilenameCharacter, sanitizeStringForFilename, isValidBasename, isValidBasenameErrorMessage, generateDatabaseName } from '../wizard/api/utils';
import { DeployConfigPage } from '../wizard/pages/deployConfigPage';

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

describe('Check for invalid filename error tests', function (): void {
	it('Should determine invalid filenames', async () => {
		// valid filename
		should(isValidBasenameErrorMessage(formatFileName('ValidName.dacpac'))).equal('');

		// invalid for both Windows and non-Windows
		should(isValidBasenameErrorMessage(formatFileName('	.dacpac'))).equal(loc.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName(' .dacpac'))).equal(loc.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('  	.dacpac'))).equal(loc.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('..dacpac'))).equal(loc.reservedValueErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('...dacpac'))).equal(loc.reservedValueErrorMessage);
		should(isValidBasenameErrorMessage(null)).equal(loc.undefinedFilenameErrorMessage);
		should(isValidBasenameErrorMessage(undefined)).equal(loc.undefinedFilenameErrorMessage);
		should(isValidBasenameErrorMessage('\\')).equal(isWindows ? loc.whitespaceFilenameErrorMessage : loc.invalidFileCharsErrorMessage);
		should(isValidBasenameErrorMessage('/')).equal(loc.whitespaceFilenameErrorMessage);

		// most file systems do not allow files > 255 length
		should(isValidBasenameErrorMessage(formatFileName('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.dacpac'))).equal(loc.tooLongFilenameErrorMessage);
	});

	it('Should determine invalid Windows filenames', async () => {
		// invalid characters only for Windows
		should(isValidBasenameErrorMessage(formatFileName('?.dacpac'))).equal(isWindows ? loc.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName(':.dacpac'))).equal(isWindows ? loc.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('*.dacpac'))).equal(isWindows ? loc.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('<.dacpac'))).equal(isWindows ? loc.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('>.dacpac'))).equal(isWindows ? loc.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('|.dacpac'))).equal(isWindows ? loc.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('".dacpac'))).equal(isWindows ? loc.invalidFileCharsErrorMessage : '');

		// Windows filenames cannot end with a whitespace
		should(isValidBasenameErrorMessage(formatFileName('test   .dacpac'))).equal(isWindows ? loc.trailingWhitespaceErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('test	.dacpac'))).equal(isWindows ? loc.trailingWhitespaceErrorMessage : '');
	});

	it('Should determine Windows forbidden filenames', async () => {
		// invalid only for Windows
		should(isValidBasenameErrorMessage(formatFileName('CON.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('PRN.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('AUX.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('NUL.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM1.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM2.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM3.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM4.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM5.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM6.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM7.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM8.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM9.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT1.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT2.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT3.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT4.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT5.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT6.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT7.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT8.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT9.dacpac'))).equal(isWindows ? loc.reservedWindowsFilenameErrorMessage : '');
	});
});


describe('Generate database name from file path tests', function (): void {
	it('Should generate database name correctly', async () => {
		should(generateDatabaseName('')).equal('');
		should(generateDatabaseName('c:\\test\\name.dacpac')).equal(isWindows ? 'name' : 'c:\\test\\name');
		should(generateDatabaseName('c:\\test\\name.bacpac')).equal(isWindows ? 'name' : 'c:\\test\\name');
		should(generateDatabaseName('~/users/test/name.dacpac')).equal('name');
		should(generateDatabaseName('~/users/test/name.bacpac')).equal('name');
		should(generateDatabaseName('name.dacpac')).equal('name');
	});
});

describe('Check for unique database name tests', function (): void {
	it('Should determine if database name is unique correctly', async () => {
		let page: DeployConfigPage = new DeployConfigPage(undefined, undefined, undefined, undefined);
		page.databaseValues = ['db1', 'test'];
		should(page.databaseNameExists('db1')).equal(true);
		should(page.databaseNameExists('test')).equal(true);
		should(page.databaseNameExists('Test')).equal(true);
		should(page.databaseNameExists('TEST')).equal(true);
		should(page.databaseNameExists('db2')).equal(false);
	});
});

function formatFileName(filename: string): string {
	return path.join(os.tmpdir(), filename);
}
