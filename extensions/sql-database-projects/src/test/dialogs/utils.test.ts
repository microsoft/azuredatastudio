/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as constants from '../../common/constants';
import * as os from 'os';
import * as path from 'path';
import { SqlTargetPlatform } from 'sqldbproj';
import { getDefaultDockerImageWithTag, getDockerBaseImages, isValidBasename, isValidBasenameErrorMessage, isValidFilenameCharacter, sanitizeStringForFilename } from '../../dialogs/utils';

const isWindows = os.platform() === 'win32';

describe('Tests to verify dialog utils functions', function (): void {
	it('getDefaultDockerImageWithTag should return correct image', () => {
		const baseImages = getDockerBaseImages(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2022)!);
		const sqlServerImageInfo = baseImages.find(image => image.displayName === constants.SqlServerDockerImageName);
		const edgeImageInfo = baseImages.find(image => image.displayName === SqlTargetPlatform.sqlEdge);

		should(getDefaultDockerImageWithTag('160', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}:2022-latest`, 'Unexpected docker image returned for target platform SQL Server 2022 and SQL Server base image');
		should(getDefaultDockerImageWithTag('150', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}:2019-latest`, 'Unexpected docker image returned for target platform SQL Server 2019 and SQL Server base image');
		should(getDefaultDockerImageWithTag('140', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}:2017-latest`, 'Unexpected docker image returned for target platform SQL Server 2017 and SQL Server base image');
		should(getDefaultDockerImageWithTag('130', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}`, 'Unexpected docker image returned for target platform SQL Server 2016 and SQL Server base image');
		should(getDefaultDockerImageWithTag('150', 'mcr.microsoft.com/azure-sql-edge', edgeImageInfo)).equals(`${edgeImageInfo?.name}`, 'Unexpected docker image returned for target platform SQL Server 2019 and Edge base image');

		// different display names are returned when a project's target platform is Azure, but currently the Azure full image points to mcr.microsoft.com/mssql/server
		const azureBaseImages = getDockerBaseImages(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)!);
		const azureFullImageInfo = azureBaseImages.find(image => image.displayName === constants.AzureSqlDbFullDockerImageName);
		const azureLiteImageInfo = azureBaseImages.find(image => image.displayName === constants.AzureSqlDbLiteDockerImageName);

		should(getDefaultDockerImageWithTag('AzureV12', 'mcr.microsoft.com/mssql/server', azureFullImageInfo)).equals(`${azureFullImageInfo?.name}`, 'Unexpected docker image returned for target platform Azure and Azure full base image');
		should(getDefaultDockerImageWithTag('AzureV12', 'mcr.microsoft.com/azure-sql-edge', azureLiteImageInfo)).equals(`${azureLiteImageInfo?.name}`, 'Unexpected docker image returned for target platform Azure Azure lite base image');
	});
});

describe('Sanitize database name for filename tests', function (): void {
	it('Should only validate if one character is passed', async () => {
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
		should(isValidBasename(formatFileName('ValidName.sqlproj'))).equal(true);

		// invalid for both Windows and non-Windows
		should(isValidBasename(formatFileName('	.sqlproj'))).equal(false);
		should(isValidBasename(formatFileName(' .sqlproj'))).equal(false);
		should(isValidBasename(formatFileName('  	.sqlproj'))).equal(false);
		should(isValidBasename(formatFileName('..sqlproj'))).equal(false);
		should(isValidBasename(formatFileName('...sqlproj'))).equal(false);
		should(isValidBasename(null)).equal(false);
		should(isValidBasename(undefined)).equal(false);
		should(isValidBasename('\\')).equal(false);
		should(isValidBasename('/')).equal(false);

		// most file systems do not allow files > 255 length
		should(isValidBasename(formatFileName('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.sqlproj'))).equal(false);
	});

	it('Should determine invalid Windows filenames', async () => {
		// invalid characters only for Windows
		should(isValidBasename(formatFileName('?.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName(':.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('*.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('<.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('>.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('|.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('".sqlproj'))).equal(isWindows ? false : true);

		// Windows filenames cannot end with a whitespace
		should(isValidBasename(formatFileName('test   .sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('test	.sqlproj'))).equal(isWindows ? false : true);
	});

	it('Should determine Windows forbidden filenames', async () => {
		// invalid only for Windows
		should(isValidBasename(formatFileName('CON.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('PRN.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('AUX.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('NUL.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM1.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM2.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM3.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM4.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM5.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM6.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM7.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM8.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('COM9.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT1.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT2.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT3.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT4.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT5.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT6.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT7.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT8.sqlproj'))).equal(isWindows ? false : true);
		should(isValidBasename(formatFileName('LPT9.sqlproj'))).equal(isWindows ? false : true);
	});
});

describe('Check for invalid filename error tests', function (): void {
	it('Should determine invalid filenames', async () => {
		// valid filename
		should(isValidBasenameErrorMessage(formatFileName('ValidName.sqlproj'))).equal('');

		// invalid for both Windows and non-Windows
		should(isValidBasenameErrorMessage(formatFileName('	.sqlproj'))).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName(' .sqlproj'))).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('  	.sqlproj'))).equal(constants.whitespaceFilenameErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('..sqlproj'))).equal(constants.reservedValueErrorMessage);
		should(isValidBasenameErrorMessage(formatFileName('...sqlproj'))).equal(constants.reservedValueErrorMessage);
		should(isValidBasenameErrorMessage(null)).equal(constants.undefinedFilenameErrorMessage);
		should(isValidBasenameErrorMessage(undefined)).equal(constants.undefinedFilenameErrorMessage);
		should(isValidBasenameErrorMessage('\\')).equal(isWindows ? constants.whitespaceFilenameErrorMessage : constants.invalidFileCharsErrorMessage);
		should(isValidBasenameErrorMessage('/')).equal(constants.whitespaceFilenameErrorMessage);

		// most file systems do not allow files > 255 length
		should(isValidBasenameErrorMessage(formatFileName('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.sqlproj'))).equal(constants.tooLongFilenameErrorMessage);
	});

	it('Should determine invalid Windows filenames', async () => {
		// invalid characters only for Windows
		should(isValidBasenameErrorMessage(formatFileName('?.sqlproj'))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName(':.sqlproj'))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('*.sqlproj'))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('<.sqlproj'))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('>.sqlproj'))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('|.sqlproj'))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('".sqlproj'))).equal(isWindows ? constants.invalidFileCharsErrorMessage : '');

		// Windows filenames cannot end with a whitespace
		should(isValidBasenameErrorMessage(formatFileName('test   .sqlproj'))).equal(isWindows ? constants.trailingWhitespaceErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('test	.sqlproj'))).equal(isWindows ? constants.trailingWhitespaceErrorMessage : '');
	});

	it('Should determine Windows forbidden filenames', async () => {
		// invalid only for Windows
		should(isValidBasenameErrorMessage(formatFileName('CON.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('PRN.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('AUX.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('NUL.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM1.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM2.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM3.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM4.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM5.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM6.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM7.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM8.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('COM9.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT1.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT2.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT3.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT4.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT5.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT6.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT7.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT8.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
		should(isValidBasenameErrorMessage(formatFileName('LPT9.sqlproj'))).equal(isWindows ? constants.reservedWindowsFilenameErrorMessage : '');
	});
});

function formatFileName(filename: string): string {
	return path.join(os.tmpdir(), filename);
}

