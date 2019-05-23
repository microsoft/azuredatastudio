/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import 'mocha';
import * as should from 'should';
import * as os from 'os';
import { isValidFilenameCharacter, sanitizeStringForFilename } from '../wizard/api/utils';


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
		let isWindows = os.platform() === 'win32';

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
