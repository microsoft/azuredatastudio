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
import { EOL } from 'os';

let rootFolderPath = 'test';
let localSettingsPath: string = `${rootFolderPath}/local.settings.json`;
let projectFilePath: string = `${rootFolderPath}//projectFilePath.csproj`;

describe('Tests to verify Azure Functions Utils functions', function (): void {

	it('Should correctly parse local.settings.json', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		);
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(settings.IsEncrypted).equals(false);
		should(Object.keys(settings.Values!).length).equals(3);
	});

	it('setLocalAppSetting can update settings.json with new setting value', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		);

		let writeFileStub = sinon.stub(fs.promises, 'writeFile');
		await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test4', 'test4');
		should(writeFileStub.calledWithExactly(localSettingsPath, `{${EOL}  "IsEncrypted": false,${EOL}  "Values": {${EOL}    "test1": "test1",${EOL}    "test2": "test2",${EOL}    "test3": "test3",${EOL}    "test4": "test4"${EOL}  }${EOL}}`)).equals(true);
	});

	it('Should not overwrite setting if value already exists in local.settings.json', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		);

		let warningMsg = constants.settingAlreadyExists('test1');
		const spy = sinon.stub(vscode.window, 'showWarningMessage').resolves({ title: constants.settingAlreadyExists('test1') });

		await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test1', 'newValue');
		should(spy.calledOnce).be.true('showWarningMessage should have been called exactly once');
		should(spy.calledWith(warningMsg)).be.true(`showWarningMessage not called with expected message '${warningMsg}' Actual '${spy.getCall(0).args[0]}'`);
	});

	it('Should get settings file given project file', async () => {
		const settingsFile = await azureFunctionsUtils.getSettingsFile(projectFilePath);
		should(settingsFile).equals(localSettingsPath);
	});

	it('Should add connection string to local.settings.json', async () => {
		sinon.stub(fs, 'existsSync').withArgs(localSettingsPath).returns(true);
		sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
			`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		);
		const connectionString = 'testConnectionString';

		let writeFileStub = sinon.stub(fs.promises, 'writeFile');
		await azureFunctionsUtils.addConnectionStringToConfig(connectionString, projectFilePath);
		should(writeFileStub.calledWithExactly(localSettingsPath, `{${EOL}  "IsEncrypted": false,${EOL}  "Values": {${EOL}    "test1": "test1",${EOL}    "test2": "test2",${EOL}    "test3": "test3",${EOL}    "SqlConnectionString": "testConnectionString"${EOL}  }${EOL}}`)).equals(true);
	});

	afterEach(async function (): Promise<void> {
		sinon.restore();
	});
});
