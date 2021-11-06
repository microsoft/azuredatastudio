/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import { createDummyFileStructure } from './testUtils';
import { exists, trimUri, removeSqlCmdVariableFormatting, formatSqlCmdVariable, isValidSqlCmdVariableName, timeConversion, validateSqlServerPortNumber, isEmptyString, detectCommandInstallation, isValidSQLPassword } from '../common/utils';
import { Uri } from 'vscode';

describe('Tests to verify utils functions', function (): void {
	it('Should determine existence of files/folders', async () => {
		let testFolderPath = await createDummyFileStructure();

		should(await exists(testFolderPath)).equal(true);
		should(await exists(path.join(testFolderPath, 'file1.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder2'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4'))).equal(false);
		should(await exists(path.join(testFolderPath, 'folder2', 'file4.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4', 'file2.sql'))).equal(false);
	});

	it('Should get correct relative paths of files/folders', async () => {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		let projectUri = Uri.file(path.join(root, 'project', 'folder', 'project.sqlproj'));
		let fileUri = Uri.file(path.join(root, 'project', 'folder', 'file.sql'));
		should(trimUri(projectUri, fileUri)).equal('file.sql');

		fileUri = Uri.file(path.join(root, 'project', 'file.sql'));
		let urifile = trimUri(projectUri, fileUri);
		should(urifile).equal('../file.sql');

		fileUri = Uri.file(path.join(root, 'project', 'forked', 'file.sql'));
		should(trimUri(projectUri, fileUri)).equal('../forked/file.sql');

		fileUri = Uri.file(path.join(root, 'forked', 'from', 'top', 'file.sql'));
		should(trimUri(projectUri, fileUri)).equal('../../forked/from/top/file.sql');
	});

	it('Should remove $() from sqlcmd variables', () => {
		should(removeSqlCmdVariableFormatting('$(test)')).equal('test', '$() surrounding the variable should have been removed');
		should(removeSqlCmdVariableFormatting('$(test')).equal('test', '$( at the beginning of the variable should have been removed');
		should(removeSqlCmdVariableFormatting('test')).equal('test', 'string should not have been changed because it is not in sqlcmd variable format');
	});

	it('Should make variable be in sqlcmd variable format with $()', () => {
		should(formatSqlCmdVariable('$(test)')).equal('$(test)', 'string should not have been changed because it was already in the correct format');
		should(formatSqlCmdVariable('test')).equal('$(test)', 'string should have been changed to be in sqlcmd variable format');
		should(formatSqlCmdVariable('$(test')).equal('$(test)', 'string should have been changed to be in sqlcmd variable format');
		should(formatSqlCmdVariable('')).equal('', 'should not do anything to an empty string');
	});

	it('Should determine invalid sqlcmd variable names', () => {
		// valid names
		should(isValidSqlCmdVariableName('$(test)')).equal(true);
		should(isValidSqlCmdVariableName('$(test    )')).equal(true, 'trailing spaces should be valid because they will be trimmed');
		should(isValidSqlCmdVariableName('test')).equal(true);
		should(isValidSqlCmdVariableName('test  ')).equal(true, 'trailing spaces should be valid because they will be trimmed');
		should(isValidSqlCmdVariableName('$(test')).equal(true);
		should(isValidSqlCmdVariableName('$(test    ')).equal(true, 'trailing spaces should be valid because they will be trimmed');

		// whitespace
		should(isValidSqlCmdVariableName('')).equal(false);
		should(isValidSqlCmdVariableName(' ')).equal(false);
		should(isValidSqlCmdVariableName('     ')).equal(false);
		should(isValidSqlCmdVariableName('test abc')).equal(false);
		should(isValidSqlCmdVariableName('	')).equal(false);

		// invalid characters
		should(isValidSqlCmdVariableName('$($test')).equal(false);
		should(isValidSqlCmdVariableName('$test')).equal(false);
		should(isValidSqlCmdVariableName('$test')).equal(false);
		should(isValidSqlCmdVariableName('test@')).equal(false);
		should(isValidSqlCmdVariableName('test#')).equal(false);
		should(isValidSqlCmdVariableName('test"')).equal(false);
		should(isValidSqlCmdVariableName('test\'')).equal(false);
		should(isValidSqlCmdVariableName('test-1')).equal(false);
	});

	it('Should convert from milliseconds to hr min sec correctly', () => {
		should(timeConversion((60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000))).equal('1 hr, 59 min, 59 sec');
		should(timeConversion((60 * 60 * 1000) + (59 * 60 * 1000)              )).equal('1 hr, 59 min');
		should(timeConversion((60 * 60 * 1000)                                 )).equal('1 hr');
		should(timeConversion((60 * 60 * 1000)                    + (59 * 1000))).equal('1 hr, 59 sec');
		should(timeConversion(                   (59 * 60 * 1000) + (59 * 1000))).equal('59 min, 59 sec');
		should(timeConversion(                                      (59 * 1000))).equal('59 sec');
		should(timeConversion(                                      (59))).equal('59 msec');
	});

	it('Should validate port number correctly', () => {
		should(validateSqlServerPortNumber('invalid')).equals(false);
		should(validateSqlServerPortNumber('')).equals(false);
		should(validateSqlServerPortNumber(undefined)).equals(false);
		should(validateSqlServerPortNumber('65536')).equals(false);
		should(validateSqlServerPortNumber('-1')).equals(false);
		should(validateSqlServerPortNumber('65530')).equals(true);
		should(validateSqlServerPortNumber('1533')).equals(true);
	});

	it('Should validate empty string correctly', () => {
		should(isEmptyString('invalid')).equals(false);
		should(isEmptyString('')).equals(true);
		should(isEmptyString(undefined)).equals(true);
		should(isEmptyString('65536')).equals(false);
	});

	it('Should correctly detect present commands', async () => {
		should(await detectCommandInstallation('node')).equal(true, '"node" should have been detected.');
		should(await detectCommandInstallation('bogusFakeCommand')).equal(false, '"bogusFakeCommand" should have been detected.');
	});

	it('Should validate SQL server password correctly', () => {
		should(isValidSQLPassword('invalid')).equals(false, 'string with chars only is invalid password');
		should(isValidSQLPassword('')).equals(false, 'empty string is invalid password');
		should(isValidSQLPassword('65536')).equals(false, 'string with numbers only is invalid password');
		should(isValidSQLPassword('dFGj')).equals(false, 'string with lowercase and uppercase char only is invalid password');
		should(isValidSQLPassword('dj$')).equals(false, 'string with char and symbols only is invalid password');
		should(isValidSQLPassword('dF65530')).equals(false, 'string with char and numbers only is invalid password');
		should(isValidSQLPassword('dF6$30')).equals(false, 'dF6$30 is invalid password');
		should(isValidSQLPassword('dF65$530')).equals(true, 'dF65$530 is valid password');
		should(isValidSQLPassword('dFdf65$530')).equals(true, 'dF65$530 is valid password');
		should(isValidSQLPassword('av1fgh533@')).equals(true, 'dF65$530 is valid password');
	});
});

