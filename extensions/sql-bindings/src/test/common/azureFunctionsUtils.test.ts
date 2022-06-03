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
import * as utils from '../../common/utils';
import { IConnectionInfo } from 'vscode-mssql';
import { createTestCredentials, createTestUtils, TestUtils } from '../testUtils';

const rootFolderPath = 'test';
const localSettingsPath: string = path.join(rootFolderPath, 'local.settings.json');
let testUtils: TestUtils;

describe('AzureFunctionUtils', function (): void {
	beforeEach(function (): void {
		testUtils = createTestUtils();
	});

	describe('Local.Settings.Json', function (): void {
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
			should(writeFileStub.calledWithExactly(localSettingsPath, `{\n  "IsEncrypted": false,\n  "Values": {\n    "test1": "test1",\n    "test2": "test2",\n    "test3": "test3",\n    "test4": "test4"\n  }\n}`)).equals(true);
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
			const settingsFile = await azureFunctionsUtils.getSettingsFile(rootFolderPath);
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
			await azureFunctionsUtils.addConnectionStringToConfig(connectionString, rootFolderPath);
			should(writeFileStub.calledWithExactly(localSettingsPath, `{\n  "IsEncrypted": false,\n  "Values": {\n    "test1": "test1",\n    "test2": "test2",\n    "test3": "test3",\n    "SqlConnectionString": "testConnectionString"\n  }\n}`)).equals(true);
		});
	});

	describe('Password Prompts', function (): void {
		it('Should include password if user includes password and connection info contains the password and auth type is SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with the password
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${connectionInfo.password};`));

			// Include Password Prompt - Yes to include password
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().returns(Promise.resolve(constants.yesString) as any);
			// Manually enter password
			let quickInputSpy = sinon.spy(vscode.window, 'showInputBox');
			// show warning window
			const warningSpy = sinon.spy(vscode.window, 'showWarningMessage');

			let getConnectionString = await azureFunctionsUtils.promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, localSettingsPath);

			// manually entered password prompt and warning prompt should not be called
			should(quickPickStub.calledOnce).be.true('showQuickPick should have been called');
			should(quickInputSpy.notCalled).be.true('showInputBox should not have been called');
			should(warningSpy.notCalled).be.true('showWarningMessage should not have been called');
			// get connection string result
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${connectionInfo.password};`);
		});

		it('Should not include password and show warning if user does not want to include password prompt and connection info contains the password and auth type is SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with password placeholder
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, false, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`));

			// Include Password Prompt - NO to include password
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().returns(Promise.resolve(constants.noString) as any);
			// Manually enter password
			let quickInputSpy = sinon.spy(vscode.window, 'showInputBox');
			// show warning window
			const warningSpy = sinon.spy(vscode.window, 'showWarningMessage');

			let getConnectionString = await azureFunctionsUtils.promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, localSettingsPath);

			// warning prompt should be shown and manually entered password prompt should not be called (since user indicated they do not want to include password)
			should(quickPickStub.calledOnce).be.true('showQuickPick should have been called');
			should(quickInputSpy.notCalled).be.true('showInputBox should not have been called');
			should(warningSpy.calledOnce).be.true('showWarningMessage should have been called');
			// returned connection string should NOT include password
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`);
		});

		it('Should not include password and show warning if user cancels include password prompt and connection info contains the password and auth type is SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with password placeholder
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, false, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`));

			// Include Password Prompt - cancels out of include password prompt
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves(undefined);
			// Manually enter password
			let quickInputSpy = sinon.spy(vscode.window, 'showInputBox');
			// show warning window
			const warningSpy = sinon.spy(vscode.window, 'showWarningMessage');

			let getConnectionString = await azureFunctionsUtils.promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, localSettingsPath);

			// warning prompt should be shown and manually entered password prompt should not be called (since user indicated they do not want to include password)
			should(quickPickStub.calledOnce).be.true('showQuickPick should have been called');
			should(quickInputSpy.notCalled).be.true('showInputBox should not have been called');
			should(warningSpy.calledOnce).be.true('showWarningMessage should have been called');
			// returned connection string should NOT include password
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`);
		});

		it('Should return connection string with no password saved when connection auth type is not SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			connectionInfo.authenticationType = 'TestAuth'; // auth type is not SQL
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with password placeholder
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, false, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`));

			// Include password prompt
			let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
			// Manually enter password
			let quickInputSpy = sinon.spy(vscode.window, 'showInputBox');
			// show warning window
			const warningSpy = sinon.spy(vscode.window, 'showWarningMessage');

			let getConnectionString = await azureFunctionsUtils.promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, localSettingsPath);

			// should not call any of the prompts (include password, manually enter password, or show warning) since connection auth type is not SQL
			should(quickpickStub.notCalled).be.true('showQuickPick should not have been called');
			should(quickInputSpy.notCalled).be.true('showInputBox should not have been called');
			should(warningSpy.notCalled).be.true('showWarningMessage should not have been called');
			// returned connection string should NOT include password
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};`);
		});

		it('Should ask user to enter password and set password to connection string when connection info does not contain password and auth type is SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			connectionInfo.password = ''; // password is not saved for the connection
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with password placeholder
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, false, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`));

			// Include password prompt
			let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
			// Manually enter password
			let enteredPassword = 'testPassword';
			let quickInputSpy = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves(enteredPassword);
			// show warning window
			const warningSpy = sinon.spy(vscode.window, 'showWarningMessage');

			let getConnectionString = await azureFunctionsUtils.promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, localSettingsPath);

			// manually entered password prompt should be called while warning prompt and include password prompt should not be called (since user connection info does not contain password)
			should(quickpickStub.notCalled).be.true('showQuickPick should not have been called');
			should(quickInputSpy.calledOnce).be.true('showInputBox should have been called');
			should(warningSpy.notCalled).be.true('showWarningMessage should have been called');
			// returned connection string should have the entered password
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${enteredPassword};`);
		});

		it('Should ask user to enter password and not include password to connection string since user cancelled prompt when connection info does not contain password and auth type is SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			connectionInfo.password = ''; // password is not saved for the connection
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with password placeholder
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, false, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`));

			// Include password prompt
			let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
			// Manually enter password
			let quickInputSpy = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves(undefined);
			// show warning window
			const warningSpy = sinon.spy(vscode.window, 'showWarningMessage');

			let getConnectionString = await azureFunctionsUtils.promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, localSettingsPath);

			// manually entered password prompt and warning prompt should be shown and include password prompt should not be called (since user cancelled manually enter password prompt)
			should(quickpickStub.notCalled).be.true('showQuickPick should not have been called');
			should(quickInputSpy.calledOnce).be.true('showInputBox should have been called');
			should(warningSpy.calledOnce).be.true('showWarningMessage should have been called ');
			// returned connection string should have the entered password
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`);
		});
	});

	afterEach(function (): void {
		sinon.restore();
	});
});
