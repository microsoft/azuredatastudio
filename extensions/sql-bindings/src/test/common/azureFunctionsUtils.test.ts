/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as should from 'should';
import * as sinon from 'sinon';
import { promisify } from 'util';
import * as constants from '../../common/constants';
import * as azureFunctionsUtils from '../../common/azureFunctionsUtils';
import { assert } from 'console';

let rootFolderPath: string;
let localSettingsPath: string;
let projectFilePath: string;

describe('Tests to verify Azure Functions Utils functions', function (): void {
	beforeEach(async () => {
		rootFolderPath = path.join(os.tmpdir(), `AzureFunctionTest_${uuid.v4()}`);
		await fs.mkdirSync(rootFolderPath);
		localSettingsPath = path.join(rootFolderPath, `local.settings.json`);
		projectFilePath = path.join(rootFolderPath, `test.csproj`);
		await fs.writeFileSync(localSettingsPath, `{"IsEncrypted": false,
		"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`);
	});

	it('Should get local.settings.json', async () => {
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(fs.existsSync(localSettingsPath)).equals(true);
		should(settings.IsEncrypted).equals(false);
		should(Object.keys(settings.Values!).length).equals(3);
	});

	it('Should show error message if local.settings.json throws', async () => {
		let errorMsg = 'Error reading local.settings.json';
		should(fs.existsSync(localSettingsPath)).equals(true);
		const getLocalSettingsSpy = sinon.spy(azureFunctionsUtils, 'getLocalSettingsJson');
		sinon.stub(JSON, 'parse').withArgs(sinon.match.any).throws(new Error(errorMsg));
		try {
			await getLocalSettingsSpy(localSettingsPath);
		} catch {
			// no-op
		}
		assert(getLocalSettingsSpy.threw());
	});

	it('Should set local.settings.json with new value', async () => {
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		// originally should have 3 settings
		should(Object.keys(settings.Values!).length).equals(3);

		await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test4', 'test4');
		settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(Object.keys(settings.Values!).length).equals(4);
		should(settings.Values!['test4']).equals('test4');
	});

	it('Should not overwrite setting if value already exists in local.settings.json', async () => {
		let warningMsg = constants.settingAlreadyExists('test1');
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		// originally should have 3 settings
		should(Object.keys(settings.Values!).length).equals(3);

		const spy = sinon.stub(vscode.window, 'showWarningMessage').resolves(await Promise.resolve({ title: constants.settingAlreadyExists('test1') }));

		await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test1', 'newValue');
		should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(spy.calledWith(warningMsg)).be.true(`showErrorMessage not called with expected message '${warningMsg}' Actual '${spy.getCall(0).args[0]}'`);

		settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(Object.keys(settings.Values!).length).equals(3);
		should(settings.Values!['test1']).equals('test1');
	});

	it('Should get settings file give project file', async () => {
		const settingsFile = await azureFunctionsUtils.getSettingsFile(projectFilePath);
		should(settingsFile).equals(path.join(rootFolderPath, 'local.settings.json'));
	});

	it('Should add connection string to local.settings.file', async () => {
		const connectionString = 'testConnectionString';
		let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(Object.keys(settings.Values!).length).equals(3);

		await azureFunctionsUtils.addConnectionStringToConfig(connectionString, projectFilePath);

		settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
		should(Object.keys(settings.Values!).length).equals(4);
		should(settings.Values![constants.sqlConnectionStringSetting]).equals(connectionString);
	});

	afterEach(async function (): Promise<void> {
		if (fs.existsSync(rootFolderPath)) {
			await promisify(rimraf)(rootFolderPath);
		}
		sinon.restore();
	});
});
