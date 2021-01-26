/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
// import * as TypeMoq from 'typemoq';
import * as should from 'should';
import * as utils from '../../common/utils';
import { PythonPathInfo, PythonPathLookup } from '../../dialog/pythonPathLookup';

describe('PythonPathLookup', function () {
	let pathLookup: PythonPathLookup;

	beforeEach(() => {
		pathLookup = new PythonPathLookup();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('getInfoForPaths', async () => {
		let expectedPathInfo: PythonPathInfo = {
			installDir: 'C:\\Not\\A\\Real\\Path\\Python38',
			version: '3.8.0'
		};

		let callNumber = 0;
		sinon.stub(pathLookup, 'getInfoForPath')
			.onCall(callNumber++).resolves({
				installDir: undefined,
				version: ''
			})
			.onCall(callNumber++).resolves({
				installDir: '',
				version: undefined
			})
			.onCall(callNumber++).resolves({
				installDir: '',
				version: ''
			})
			.onCall(callNumber++).resolves({
				installDir: 'C:\\Not\\A\\Real\\Path\\Python',
				version: '2.7.0'
			})
			.onCall(callNumber++).resolves(expectedPathInfo)
			.onCall(callNumber++).resolves(expectedPathInfo)
			.onCall(callNumber++).rejects('Unexpected number of getInfoForPath calls.');

		// getInfoForPath is mocked out above, so the actual path arguments here are irrelevant
		let result = await pathLookup.getInfoForPaths(['1', '2', '3', '4', '5', '6']);

		// The path lookup should filter out any invalid path info, any Python 2 info, and any duplicates.
		// So, we should be left with a single info object using the mocked setup above.
		should(result).be.deepEqual([expectedPathInfo]);
	});

	it('getInfoForPath', async () => {
		let pythonVersion = '3.8.0';
		let pythonFolder = 'C:\\Not\\A\\Real\\Path\\Python38';
		sinon.stub(utils, 'executeBufferedCommand')
			.onFirstCall().resolves(pythonVersion)
			.onSecondCall().resolves(pythonFolder);

		let expectedResult: PythonPathInfo = {
			installDir: pythonFolder,
			version: pythonVersion
		};
		let result = await pathLookup.getInfoForPath(`${pythonFolder}\\python.exe`);
		should(result).deepEqual(expectedResult);
	});

	it('getInfoForPath - Return undefined string on error', async () => {
		sinon.stub(utils, 'executeBufferedCommand').rejects('Planned test failure.');

		let pythonFolder = 'C:\\Not\\A\\Real\\Path\\Python38';
		let pathInfoPromise = pathLookup.getInfoForPath(`${pythonFolder}\\python.exe`);
		let result = await should(pathInfoPromise).not.be.rejected();
		should(result).be.undefined();
	});

	it('getInfoForPath - Return undefined if commands return no data', async () => {
		sinon.stub(utils, 'executeBufferedCommand').resolves('');

		let pythonFolder = 'C:\\Not\\A\\Real\\Path\\Python38';
		let pathInfoPromise = pathLookup.getInfoForPath(`${pythonFolder}\\python.exe`);
		let result = await should(pathInfoPromise).not.be.rejected();
		should(result).be.undefined();
	});
});
