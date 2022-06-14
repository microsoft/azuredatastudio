/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';
import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as azureFunctionsUtils from '../../common/azureFunctionsUtils';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as azureFunctionsContracts from '../../contracts/azureFunctions/azureFunctionsContracts';

import { BindingType } from 'sql-bindings';
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
			sinon.stub(fs.promises, 'access').onFirstCall().resolves();
			sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
				`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
			);
			let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
			should(settings.IsEncrypted).equals(false);
			should(Object.keys(settings.Values!).length).equals(3);
		});

		it('setLocalAppSetting can update settings.json with new setting value', async () => {
			sinon.stub(fs.promises, 'access').onFirstCall().resolves();
			sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
				`{"IsEncrypted": false,
			"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
			);

			let writeFileStub = sinon.stub(fs.promises, 'writeFile');
			await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test4', 'test4');
			should(writeFileStub.calledWithExactly(localSettingsPath, `{\n  "IsEncrypted": false,\n  "Values": {\n    "test1": "test1",\n    "test2": "test2",\n    "test3": "test3",\n    "test4": "test4"\n  }\n}`)).equals(true);
		});

		it('Should not overwrite setting if value already exists in local.settings.json', async () => {
			sinon.stub(fs.promises, 'access').onFirstCall().resolves();
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
			sinon.stub(fs.promises, 'access').onFirstCall().resolves();
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

	describe('Get Azure Function Project', function (): void {
		it('Should return undefined if no azure function projects are found', async () => {
			// set workspace folder for testing
			sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => {
				return <vscode.WorkspaceFolder[]>[{
					uri: {
						fsPath: '/temp/'
					},
				}];
			});
			let findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
			findFilesStub.onFirstCall().resolves([]);
			findFilesStub.onSecondCall().resolves(undefined);
			let result = await azureFunctionsUtils.getAzureFunctionProject();
			should(result).be.equal(undefined, 'Should be undefined since no azure function projects are found');
		});

		it('Should return selectedProjectFile if only one azure function project is found', async () => {
			// set workspace folder for testing
			sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => {
				return <vscode.WorkspaceFolder[]>[{
					uri: {
						fsPath: '/temp/'
					},
				}];
			});
			// only one azure function project found - hostFiles and csproj files stubs
			let findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
			findFilesStub.onFirstCall().resolves([vscode.Uri.file('/temp/host.json')]);
			findFilesStub.onSecondCall().returns(Promise.resolve([vscode.Uri.file('/temp/test.csproj')]) as any);

			let result = await azureFunctionsUtils.getAzureFunctionProject();
			should(result).be.equal('/temp/test.csproj', 'Should return test.csproj since only one Azure function project is found');
		});

		it('Should return prompt to choose azure function project if multiple azure function projects are found', async () => {
			// set workspace folder for testing
			sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => {
				return <vscode.WorkspaceFolder[]>[{
					uri: {
						fsPath: '/temp/'
					},
				}];
			});
			// multiple azure function projects found in workspace - hostFiles and project find files stubs
			let findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
			findFilesStub.onFirstCall().returns(Promise.resolve([vscode.Uri.file('/temp/host.json'), vscode.Uri.file('/temp2/host.json')]) as any);
			// we loop through the hostFiles to find the csproj in same directory
			// first loop we use host of /temp/host.json
			findFilesStub.onSecondCall().returns(Promise.resolve([vscode.Uri.file('/temp/test.csproj')]) as any);
			// second loop we use host of /temp2/host.json
			findFilesStub.onThirdCall().returns(Promise.resolve([vscode.Uri.file('/temp2/test.csproj')]) as any);
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').returns(Promise.resolve('/temp/test.csproj') as any);

			let result = await azureFunctionsUtils.getAzureFunctionProject();
			should(result).be.equal('/temp/test.csproj', 'Should return test.csproj since user choose Azure function project');
			should(quickPickStub.calledOnce).be.true('showQuickPick should have been called to choose between azure function projects');
		});
	});

	describe('PromptForObjectName', function (): void {
		it('Should prompt user to enter object name manually when no connection info given', async () => {
			let promptStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('test');

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input);
			should(promptStub.calledOnce).be.true('showInputBox should have been called');
			should(result).be.equal('test', 'Should return test since user manually entered object name');
		});

		it('Should return undefined when mssql connection error', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let promptStub = sinon.stub(vscode.window, 'showInputBox');
			sinon.stub(azureFunctionsUtils, 'getConnectionURI').resolves(undefined);

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input, connectionInfo);
			should(promptStub.notCalled).be.true('showInputBox should not have been called');
			should(result).be.equal(undefined, 'Should return undefined due to mssql connection error');
		});

		it('Should return undefined if no database selected', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let promptStub = sinon.stub(vscode.window, 'showInputBox');
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input, connectionInfo);
			should(promptStub.notCalled).be.true('showInputBox should not have been called');
			should(result).be.equal(undefined, 'Should return undefined due to no database selected');
		});

		it('Should successfully select object name', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let promptStub = sinon.stub(vscode.window, 'showInputBox');
			// getConnectionURI stub
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			// promptSelectDatabase stub
			testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('testDb' as any);
			// get tables from selected database
			const params = { ownerUri: 'testConnectionURI', queryString: azureFunctionsUtils.tablesQuery('testDb') };
			testUtils.vscodeMssqlIExtension.setup(x => x.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params))
				.returns(() => Promise.resolve({ rowCount: 1, columnInfo: [], rows: [['[schema].[testTable]']] }));
			// select the schema.testTable from list of tables based on connection info and database
			quickPickStub.onSecondCall().returns(Promise.resolve('[schema].[testTable]') as any);

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input, connectionInfo);

			should(promptStub.notCalled).be.true('showInputBox should not have been called');
			should(quickPickStub.calledTwice).be.true('showQuickPick should have been called twice');
			should(connectionInfo.database).be.equal('testDb', 'Should have connectionInfo.database to testDb after user selects database');
			should(result).be.equal('[schema].[testTable]', 'Should return [schema].[testTable] since user selected table');
		});
	});

	afterEach(function (): void {
		sinon.restore();
	});
});
