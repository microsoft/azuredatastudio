/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as should from 'should';
import * as sinon from 'sinon';
import * as constants from '../../common/constants';
import { getErrorType, getUniqueFileName, TimeoutError, validateFunctionName } from '../../common/utils';

describe('Utils', function (): void {
	it('Should return undefined when no folderPath given to create unique file name', async () => {
		let testFile = 'testFile';
		let result = await getUniqueFileName(testFile);

		should(result).be.equal(undefined, 'Should return undefined since no folderPath given');
	});

	it('Should create unique file name if one exists', async () => {
		let testFile = 'testFile';
		let testFolder = 'testFolder';
		let fileAccessStub = sinon.stub(fs.promises, 'access').onFirstCall().resolves();
		fileAccessStub.onSecondCall().throws();

		let result = await getUniqueFileName(testFile, testFolder);

		should(result).be.equal('testFile1', 'Should return testFile1 since one testFile exists');
	});

	it('Should create unique file name if multiple versions of the file exists', async () => {
		let testFile = 'testFile';
		let testFolder = 'testFolder';
		let fileAccessStub = sinon.stub(fs.promises, 'access').onFirstCall().resolves();
		fileAccessStub.onSecondCall().resolves();
		fileAccessStub.onThirdCall().throws();

		let result = await getUniqueFileName(testFile, testFolder);

		should(result).be.equal('testFile2', 'Should return testFile2 since both testFile1 and testFile exists');
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

	afterEach(function (): void {
		sinon.restore();
	});
});
