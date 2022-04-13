/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as should from 'should';
import * as sinon from 'sinon';
import * as constants from '../../common/constants';
import * as azureFunctionsUtils from '../../common/azureFunctionsUtils';

let rootFolderPath = 'test';
let localSettingsPath: string = 'test/local.settings.json';
let projectFilePath: string = 'test/projectFilePath.csproj';

describe('Tests to verify Azure Functions Utils functions', function (): void {

	it('Should get local.settings.json', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		).toString();
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(settings.IsEncrypted).equals(false);
		should(Object.keys(settings.Values!).length).equals(3);
	});

	it('Should show error message if local.settings.json throws', async () => {
		let errorMsg = 'Error parsing local.settings.json';
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		).toString();
		const getLocalSettingsSpy = sinon.spy(azureFunctionsUtils, 'getLocalSettingsJson');
		sinon.stub(JSON, 'parse').withArgs(sinon.match.any).throws(new Error(errorMsg));
		try {
			await getLocalSettingsSpy(localSettingsPath);
		} catch {
			should(getLocalSettingsSpy.threw());
		}
	});

	it('Should set local.settings.json with new value', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		).toString();
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		// originally should have 3 settings
		should(Object.keys(settings.Values!).length).equals(3);

		let writeFileStub = sinon.stub(fs.promises, 'writeFile');
		await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test4', 'test4');
		should(writeFileStub.calledWithExactly(localSettingsPath, '{\n  "IsEncrypted": false,\n  "Values": {\n    "test1": "test1",\n    "test2": "test2",\n    "test3": "test3",\n    "test4": "test4"\n  }\n}')).equals(true);
	});

	it('Should not overwrite setting if value already exists in local.settings.json', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		).toString();

		let warningMsg = constants.settingAlreadyExists('test1');
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		// originally should have 3 settings
		should(Object.keys(settings.Values!).length).equals(3);

		const spy = sinon.stub(vscode.window, 'showWarningMessage').resolves(await Promise.resolve({ title: constants.settingAlreadyExists('test1') }));

		await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test1', 'newValue');
		should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(spy.calledWith(warningMsg)).be.true(`showErrorMessage not called with expected message '${warningMsg}' Actual '${spy.getCall(0).args[0]}'`);
	});

	it('Should get settings file give project file', async () => {
		const settingsFile = await azureFunctionsUtils.getSettingsFile(projectFilePath);
		should(settingsFile).equals(path.join(rootFolderPath, 'local.settings.json'));
	});

	it('Should add connection string to local.settings.file', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		).toString();
		const connectionString = 'testConnectionString';
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(Object.keys(settings.Values!).length).equals(3);

		let writeFileStub = sinon.stub(fs.promises, 'writeFile');
		await azureFunctionsUtils.addConnectionStringToConfig(connectionString, projectFilePath);
		should(writeFileStub.calledWithExactly(localSettingsPath, '{\n  "IsEncrypted": false,\n  "Values": {\n    "test1": "test1",\n    "test2": "test2",\n    "test3": "test3",\n    "SqlConnectionString": "testConnectionString"\n  }\n}')).equals(true);
	});

	afterEach(async function (): Promise<void> {
		sinon.restore();
	});
});
