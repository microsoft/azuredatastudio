/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as constants from '../common/constants';
import * as utils from '../common/utils';

import { createDummyFileStructure, deleteGeneratedTestFolder } from './testUtils';
import { Uri } from 'vscode';

describe('Tests to verify utils functions', function (): void {
	it('Should determine existence of files/folders', async () => {
		let testFolderPath = await createDummyFileStructure(undefined);

		should(await utils.exists(testFolderPath)).equal(true);
		should(await utils.exists(path.join(testFolderPath, 'file1.sql'))).equal(true);
		should(await utils.exists(path.join(testFolderPath, 'folder2'))).equal(true);
		should(await utils.exists(path.join(testFolderPath, 'folder4'))).equal(false);
		should(await utils.exists(path.join(testFolderPath, 'folder2', 'file4.sql'))).equal(true);
		should(await utils.exists(path.join(testFolderPath, 'folder4', 'file2.sql'))).equal(false);

		await deleteGeneratedTestFolder();
	});

	it('Should get correct relative paths of files/folders', async () => {
		const root = os.platform() === 'win32' ? 'Z:\\' : '/';
		let projectUri = Uri.file(path.join(root, 'project', 'folder', 'project.sqlproj'));
		let fileUri = Uri.file(path.join(root, 'project', 'folder', 'file.sql'));
		should(utils.trimUri(projectUri, fileUri)).equal('file.sql');

		fileUri = Uri.file(path.join(root, 'project', 'file.sql'));
		let urifile = utils.trimUri(projectUri, fileUri);
		should(urifile).equal('../file.sql');

		fileUri = Uri.file(path.join(root, 'project', 'forked', 'file.sql'));
		should(utils.trimUri(projectUri, fileUri)).equal('../forked/file.sql');

		fileUri = Uri.file(path.join(root, 'forked', 'from', 'top', 'file.sql'));
		should(utils.trimUri(projectUri, fileUri)).equal('../../forked/from/top/file.sql');
	});

	it('Should remove $() from sqlcmd variables', () => {
		should(utils.removeSqlCmdVariableFormatting('$(test)')).equal('test', '$() surrounding the variable should have been removed');
		should(utils.removeSqlCmdVariableFormatting('$(test')).equal('test', '$( at the beginning of the variable should have been removed');
		should(utils.removeSqlCmdVariableFormatting('test')).equal('test', 'string should not have been changed because it is not in sqlcmd variable format');
	});

	it('Should make variable be in sqlcmd variable format with $()', () => {
		should(utils.formatSqlCmdVariable('$(test)')).equal('$(test)', 'string should not have been changed because it was already in the correct format');
		should(utils.formatSqlCmdVariable('test')).equal('$(test)', 'string should have been changed to be in sqlcmd variable format');
		should(utils.formatSqlCmdVariable('$(test')).equal('$(test)', 'string should have been changed to be in sqlcmd variable format');
		should(utils.formatSqlCmdVariable('')).equal('', 'should not do anything to an empty string');
	});

	it('Should determine invalid sqlcmd variable names', () => {
		// valid names
		should(utils.validateSqlCmdVariableName('$(test)')).equal(null);
		should(utils.validateSqlCmdVariableName('$(test    )')).equal(null, 'trailing spaces should be valid because they will be trimmed');
		should(utils.validateSqlCmdVariableName('test')).equal(null);
		should(utils.validateSqlCmdVariableName('test  ')).equal(null, 'trailing spaces should be valid because they will be trimmed');
		should(utils.validateSqlCmdVariableName('$(test')).equal(null);
		should(utils.validateSqlCmdVariableName('$(test    ')).equal(null, 'trailing spaces should be valid because they will be trimmed');

		// whitespace
		should(utils.validateSqlCmdVariableName('')).equal(constants.sqlcmdVariableNameCannotContainWhitespace(''));
		should(utils.validateSqlCmdVariableName(' ')).equal(constants.sqlcmdVariableNameCannotContainWhitespace(' '));
		should(utils.validateSqlCmdVariableName('     ')).equal(constants.sqlcmdVariableNameCannotContainWhitespace('     '));
		should(utils.validateSqlCmdVariableName('test abc')).equal(constants.sqlcmdVariableNameCannotContainWhitespace('test abc'));
		should(utils.validateSqlCmdVariableName('	')).equal(constants.sqlcmdVariableNameCannotContainWhitespace('	'));

		// invalid characters
		should(utils.validateSqlCmdVariableName('$($test')).equal(constants.sqlcmdVariableNameCannotContainIllegalChars('$($test'));
		should(utils.validateSqlCmdVariableName('$test')).equal(constants.sqlcmdVariableNameCannotContainIllegalChars('$test'));
		should(utils.validateSqlCmdVariableName('test@')).equal(constants.sqlcmdVariableNameCannotContainIllegalChars('test@'));
		should(utils.validateSqlCmdVariableName('test#')).equal(constants.sqlcmdVariableNameCannotContainIllegalChars('test#'));
		should(utils.validateSqlCmdVariableName('test"')).equal(constants.sqlcmdVariableNameCannotContainIllegalChars('test"'));
		should(utils.validateSqlCmdVariableName('test\'')).equal(constants.sqlcmdVariableNameCannotContainIllegalChars('test\''));
		should(utils.validateSqlCmdVariableName('test-1')).equal(constants.sqlcmdVariableNameCannotContainIllegalChars('test-1'));
	});

	it('Should convert from milliseconds to hr min sec correctly', () => {
		should(utils.timeConversion((60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000))).equal('1 hr, 59 min, 59 sec');
		should(utils.timeConversion((60 * 60 * 1000) + (59 * 60 * 1000))).equal('1 hr, 59 min');
		should(utils.timeConversion((60 * 60 * 1000))).equal('1 hr');
		should(utils.timeConversion((60 * 60 * 1000) + (59 * 1000))).equal('1 hr, 59 sec');
		should(utils.timeConversion((59 * 60 * 1000) + (59 * 1000))).equal('59 min, 59 sec');
		should(utils.timeConversion((59 * 1000))).equal('59 sec');
		should(utils.timeConversion((59))).equal('59 msec');
	});

	it('Should validate port number correctly', () => {
		should(utils.validateSqlServerPortNumber('invalid')).equals(false);
		should(utils.validateSqlServerPortNumber('')).equals(false);
		should(utils.validateSqlServerPortNumber(undefined)).equals(false);
		should(utils.validateSqlServerPortNumber('65536')).equals(false);
		should(utils.validateSqlServerPortNumber('-1')).equals(false);
		should(utils.validateSqlServerPortNumber('65530')).equals(true);
		should(utils.validateSqlServerPortNumber('1533')).equals(true);
	});

	it('Should validate empty string correctly', () => {
		should(utils.isEmptyString('invalid')).equals(false);
		should(utils.isEmptyString('')).equals(true);
		should(utils.isEmptyString(undefined)).equals(true);
		should(utils.isEmptyString('65536')).equals(false);
	});

	it('Should correctly detect present commands', async () => {
		should(await utils.detectCommandInstallation('node')).equal(true, '"node" should have been detected.');
		should(await utils.detectCommandInstallation('bogusFakeCommand')).equal(false, '"bogusFakeCommand" should have been detected.');
	});

	it('Should validate SQL server password correctly', () => {
		should(utils.isValidSQLPassword('invalid')).equals(false, 'string with chars only is invalid password');
		should(utils.isValidSQLPassword('')).equals(false, 'empty string is invalid password');
		should(utils.isValidSQLPassword('65536')).equals(false, 'string with numbers only is invalid password');
		should(utils.isValidSQLPassword('dFGj')).equals(false, 'string with lowercase and uppercase char only is invalid password');
		should(utils.isValidSQLPassword('dj$')).equals(false, 'string with char and symbols only is invalid password');
		should(utils.isValidSQLPassword('dF65530')).equals(false, 'string with char and numbers only is invalid password');
		should(utils.isValidSQLPassword('dF6$30')).equals(false, 'dF6$30 is invalid password');
		should(utils.isValidSQLPassword('dF65$530')).equals(true, 'dF65$530 is valid password');
		should(utils.isValidSQLPassword('dFdf65$530')).equals(true, 'dF65$530 is valid password');
		should(utils.isValidSQLPassword('av1fgh533@')).equals(true, 'dF65$530 is valid password');
	});

	it('findSqlVersionInImageName should return the version correctly', () => {
		should(utils.findSqlVersionInImageName('2017-CU1-ubuntu')).equals(2017, 'invalid number returned for 2017-CU1-ubuntu');
		should(utils.findSqlVersionInImageName('2019-latest')).equals(2019, 'invalid number returned for 2019-latest');
		should(utils.findSqlVersionInImageName('latest')).equals(undefined, 'invalid number returned for latest');
		should(utils.findSqlVersionInImageName('latest-ubuntu')).equals(undefined, 'invalid number returned for latest-ubuntu');
		should(utils.findSqlVersionInImageName('2017-CU20-ubuntu-16.04')).equals(2017, 'invalid number returned for 2017-CU20-ubuntu-16.04');
	});

	it('findSqlVersionInTargetPlatform should return the version correctly', () => {
		should(utils.findSqlVersionInTargetPlatform('SQL Server 2012')).equals(2012, 'invalid number returned for SQL Server 2012');
		should(utils.findSqlVersionInTargetPlatform('SQL Server 2019')).equals(2019, 'invalid number returned for SQL Server 2019');
		should(utils.findSqlVersionInTargetPlatform('Azure SQL Database')).equals(undefined, 'invalid number returned for Azure SQL Database');
		should(utils.findSqlVersionInTargetPlatform('Azure Synapse SQL Pool')).equals(undefined, 'invalid number returned for Azure Synapse SQL Pool');
	});
});

