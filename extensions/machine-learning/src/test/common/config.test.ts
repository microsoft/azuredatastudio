/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ApiWrapper } from '../../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { Config } from '../../configurations/config';
import * as utils from '../../common/utils';
import * as path from 'path';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
}

function createContext(): TestContext {
	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper)
	};
}

let configData : vscode.WorkspaceConfiguration = {
	get: () => {},
	has: () => true,
	inspect: () => undefined,
	update: () => {return Promise.resolve();},

};

describe('Config', () => {
	it('getPythonExecutable should default to ADS python location is not configured', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return ''; };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		const expected = utils.getDefaultPythonLocation();
		const actual = await config.getPythonExecutable(false);
		should.deepEqual(actual, expected);
	});

	it('getPythonExecutable should add python executable name is folder path is configured', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return utils.getUserHome(); };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		const expected = path.join(utils.getUserHome() || '', utils.getPythonExeName());
		const actual = await config.getPythonExecutable(false);
		should.deepEqual(actual, expected);
	});

	it('getPythonExecutable should not add python executable if already added', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return path.join(utils.getUserHome() || '', utils.getPythonExeName()); };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		const expected = path.join(utils.getUserHome() || '', utils.getPythonExeName());
		const actual = await config.getPythonExecutable(false);
		should.deepEqual(actual, expected);
	});

	it('getPythonExecutable should not add python executable set to python', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return 'python'; };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		const expected = 'python';
		const actual = await config.getPythonExecutable(false);
		should.deepEqual(actual, expected);
	});

	it('getPythonExecutable should not add python executable set to python3', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return 'python3'; };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		const expected = 'python3';
		const actual = await config.getPythonExecutable(false);
		should.deepEqual(actual, expected);
	});

	it('getRExecutable should not add r executable set to r', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return 'r'; };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		const expected = 'r';
		const actual = await config.getRExecutable(false);
		should.deepEqual(actual, expected);
	});

	it('getPythonExecutable should throw error if file does not exist', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return path.join(utils.getUserHome() || '', 'invalidPath'); };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		await should(config.getPythonExecutable(true)).be.rejected();
	});

	it('getRExecutable should throw error if file does not exist', async function (): Promise<void> {
		const context = createContext();
		configData.get = () => { return path.join(utils.getUserHome() || '', 'invalidPath'); };
		context.apiWrapper.setup(x => x.getConfiguration(TypeMoq.It.isAny())).returns(() => configData);
		let config = new Config('', context.apiWrapper.object);
		await should(config.getRExecutable(true)).be.rejected();
	});

});
