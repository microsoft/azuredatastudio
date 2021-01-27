/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
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

	it('getSuggestions', async () => {
		sinon.stub(pathLookup, 'getPythonSuggestions').resolves(['C:\\a\\b\\c\\Python38\\python.exe']);
		sinon.stub(pathLookup, 'getCondaSuggestions').resolves(['C:\\a\\b\\c\\Anaconda\\conda.exe']);

		let expectedResults: PythonPathInfo[] = [{
			installDir: 'C:\\a\\b\\c\\Python38',
			version: '3.8.0'
		}, {
			installDir: 'C:\\a\\b\\c\\Anaconda',
			version: '3.6.0'
		}];

		let getInfoStub = sinon.stub(pathLookup, 'getInfoForPaths').resolves(expectedResults);

		let results = await pathLookup.getSuggestions();
		should(results).be.deepEqual(expectedResults);
		should(getInfoStub.callCount).be.equal(1);
		should(getInfoStub.firstCall.args[0].length).be.equal(2);
	});

	it('getCondaSuggestions', async () => {
	});

	it('getCondaSuggestions - return empty array on error', async () => {
		sinon.stub(pathLookup, 'globSearch').rejects('Planned test failure.');

		let result: string[] = await should(pathLookup.getCondaSuggestions(['C:\\a\\b\\c'])).not.be.rejected();
		should(result).not.be.undefined();
		should(result.length).be.equal(0);
	});

	it('getPythonSuggestions', async () => {
		let expectedPath = 'C:\\a\\b\\c\\Python38';
		sinon.stub(pathLookup, 'getPythonPath')
			.onCall(0).resolves(undefined)
			.onCall(1).resolves(expectedPath)
			.onCall(2).resolves('');

			// getPythonPath is mocked out, so only the number of command args matters here
			let result: string[] = await should(pathLookup.getPythonSuggestions([{ command: '1' }, { command: '2' }, { command: '3' }])).not.be.rejected();
			should(result).not.be.undefined();
			should(result.length).be.equal(1);
			should(result[0]).be.equal(expectedPath);
	});

	it('getPythonSuggestions - return empty array on error', async () => {
		sinon.stub(pathLookup, 'getPythonPath').rejects('Planned test failure.');

		let result: string[] = await should(pathLookup.getPythonSuggestions([{ command: 'C:\\a\\b\\c\\Python38\\python.exe' }])).not.be.rejected();
		should(result).not.be.undefined();
		should(result.length).be.equal(0);
	});

	it('getPythonPath', async () => {
		let expectedPath = 'C:\\a\\b\\c\\Python38';
		sinon.stub(utils, 'executeBufferedCommand').resolves(expectedPath);
		sinon.stub(utils, 'exists').resolves(true);

		let result: string = await should(pathLookup.getPythonPath({ command: 'C:\\a\\b\\c\\Python38\\python.exe' })).not.be.rejected();
		should(result).be.equal(expectedPath);
	});

	it('getPythonPath - return undefined if resulting path does not exist', async () => {
		let expectedPath = 'C:\\a\\b\\c\\Python38';
		sinon.stub(utils, 'executeBufferedCommand').resolves(expectedPath);
		sinon.stub(utils, 'exists').resolves(false);

		let result: string = await should(pathLookup.getPythonPath({ command: 'C:\\a\\b\\c\\Python38\\python.exe' })).not.be.rejected();
		should(result).be.undefined();
	});

	it('getPythonPath - return undefined on error', async () => {
		sinon.stub(utils, 'executeBufferedCommand').rejects('Planned test failure.');

		let result: string = await should(pathLookup.getPythonPath({ command: 'C:\\a\\b\\c\\Python38\\python.exe' })).not.be.rejected();
		should(result).be.undefined();
	});

	it('getPythonPath - return undefined if command returns no data', async () => {
		sinon.stub(utils, 'executeBufferedCommand')
			.onCall(0).resolves(undefined)
			.onCall(1).resolves('');

		let result: string = await should(pathLookup.getPythonPath({ command: 'C:\\a\\b\\c\\Python38\\python.exe' })).not.be.rejected();
		should(result).be.undefined();

		result = await should(pathLookup.getPythonPath({ command: 'C:\\a\\b\\c\\Python38\\python.exe' })).not.be.rejected();
		should(result).be.undefined();
	});

	it('globSearch', async () => {
	});

	it('getInfoForPaths', async () => {
		let expectedPathInfo: PythonPathInfo = {
			installDir: 'C:\\a\\b\\c\\Python38',
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
				installDir: 'C:\\a\\b\\c\\Python',
				version: '2.7.0'
			})
			.onCall(callNumber++).resolves(expectedPathInfo)
			.onCall(callNumber++).resolves(expectedPathInfo)
			.onCall(callNumber++).rejects('Unexpected number of getInfoForPath calls.');

		// getInfoForPath is mocked out above, so only the number of path arguments matters here
		let result = await pathLookup.getInfoForPaths(['1', '2', '3', '4', '5', '6']);

		// The path lookup should filter out any invalid path info, any Python 2 info, and any duplicates.
		// So, we should be left with a single info object using the mocked setup above.
		should(result).be.deepEqual([expectedPathInfo]);
	});

	it('getInfoForPaths - empty array arg', async () => {
		let getInfoStub = sinon.stub(pathLookup, 'getInfoForPath').rejects('Unexpected getInfoForPath call');
		let result = await pathLookup.getInfoForPaths([]);
		should(result).not.be.undefined;
		should(result.length).be.equal(0);
		should(getInfoStub.callCount).be.equal(0);
	});

	it('getInfoForPath', async () => {
		let pythonVersion = '3.8.0';
		let pythonFolder = 'C:\\a\\b\\c\\Python38';
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

		let pythonFolder = 'C:\\a\\b\\c\\Python38';
		let pathInfoPromise = pathLookup.getInfoForPath(`${pythonFolder}\\python.exe`);
		let result = await should(pathInfoPromise).not.be.rejected();
		should(result).be.undefined();
	});

	it('getInfoForPath - Return undefined if commands return no data', async () => {
		sinon.stub(utils, 'executeBufferedCommand').resolves('');

		let pythonFolder = 'C:\\a\\b\\c\\Python38';
		let pathInfoPromise = pathLookup.getInfoForPath(`${pythonFolder}\\python.exe`);
		let result = await should(pathInfoPromise).not.be.rejected();
		should(result).be.undefined();
	});
});
