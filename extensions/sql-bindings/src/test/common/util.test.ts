/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as should from 'should';
import * as sinon from 'sinon';
import * as constants from '../../common/constants';
import { getErrorType, getUniqueFileName, TimeoutError, validateFunctionName } from '../../common/utils';

describe('Utils', function (): void {
	it('Should create unique file name', async () => {
		let testFile = 'testFile';
		let result = await getUniqueFileName(testFile);

		should(result).be.equal(undefined);
	});

	it('Should create unique file name if one exists', async () => {
		let testFile = 'testFile';
		let testFolder = 'testFolder';
		let fileExistsStub = sinon.stub(fs, 'existsSync');
		fileExistsStub.onFirstCall().resolves(true);

		let result = await getUniqueFileName(testFile, testFolder);

		should(result).be.equal('testFile1');
	});

	it('Should validate function name', async () => {
		should(validateFunctionName('')).be.equal(constants.nameMustNotBeEmpty);
		should(validateFunctionName('@$%@%@%')).be.equal(constants.hasSpecialCharacters);
		should(validateFunctionName('test')).be.equal(undefined);
	});

	it('Should get error type', async () => {
		should(getErrorType(new Error('test'))).be.equal('UnknownError');
		should(getErrorType(new TimeoutError('test'))).be.equal('TimeoutError');
	});
});
