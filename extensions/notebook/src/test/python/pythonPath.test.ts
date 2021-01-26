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
