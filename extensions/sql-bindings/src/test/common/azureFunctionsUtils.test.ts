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
const tempFolderPath = path.sep + 'temp' + path.sep;
let testUtils: TestUtils;

describe('AzureFunctionUtils', function (): void {
	beforeEach(function (): void {
		testUtils = createTestUtils();
	});

	describe('Local.Settings.Json', function (): void {
		beforeEach(function (): void {
			// create fake connection string settings for local.setting.json to be used
			sinon.stub(fs.promises, 'access').onFirstCall().resolves();
			sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
				`{"IsEncrypted": false,
				"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
			);
		});
		it('Should correctly parse local.settings.json', async () => {
			let settings = await azureFunctionsUtils.getLocalSettingsJson(localSettingsPath);
			should(settings.IsEncrypted).equals(false);
			should(Object.keys(settings.Values!).length).equals(3);
		});

		it('setLocalAppSetting can update settings.json with new setting value', async () => {
			let writeFileStub = sinon.stub(fs.promises, 'writeFile').resolves();
			await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test4', 'test4');
			should(writeFileStub.calledWithExactly(localSettingsPath, `{\n  "IsEncrypted": false,\n  "Values": {\n    "test1": "test1",\n    "test2": "test2",\n    "test3": "test3",\n    "test4": "test4"\n  }\n}`)).equals(true, 'writeFile should be called with the correct arguments');
		});

		it('Should not overwrite setting if value already exists in local.settings.json', async () => {
			let warningMsg = constants.settingAlreadyExists('test1');
			const showErrorMessageSpy = sinon.stub(vscode.window, 'showWarningMessage').resolves({ title: constants.settingAlreadyExists('test1') });

			await azureFunctionsUtils.setLocalAppSetting(path.dirname(localSettingsPath), 'test1', 'newValue');
			should(showErrorMessageSpy.calledOnce).be.true('showWarningMessage should have been called exactly once');
			should(showErrorMessageSpy.calledWith(warningMsg)).be.true(`showWarningMessage not called with expected message '${warningMsg}' Actual '${showErrorMessageSpy.getCall(0).args[0]}'`);
		});

		it('Should get settings file given project file', async () => {
			const settingsFile = await azureFunctionsUtils.getSettingsFile(rootFolderPath);
			should(settingsFile).equals(localSettingsPath);
		});

		it('Should add connection string to local.settings.json', async () => {
			const connectionString = 'testConnectionString';

			let writeFileStub = sinon.stub(fs.promises, 'writeFile').resolves();
			await azureFunctionsUtils.addConnectionStringToConfig(connectionString, rootFolderPath);
			should(writeFileStub.calledWithExactly(localSettingsPath, `{\n  "IsEncrypted": false,\n  "Values": {\n    "test1": "test1",\n    "test2": "test2",\n    "test3": "test3",\n    "SqlConnectionString": "testConnectionString"\n  }\n}`)).equals(true, 'writeFile should be called with the correct arguments');
		});
	});

	describe('Password Prompts', function (): void {
		beforeEach(function (): void {
			sinon.stub(fs.promises, 'access').onFirstCall().resolves();
			sinon.stub(fs, 'readFileSync').withArgs(localSettingsPath).returns(
				`{"IsEncrypted": false,
				"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
			);
		});

		it('Should include password if user includes password and connection info contains the password and auth type is SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with the password
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${connectionInfo.password};`));

			// Include Password Prompt - Yes to include password
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves((constants.yesString) as any);
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
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${connectionInfo.password};`, 'Should return a connection string with the password');
		});

		it('Should not include password and show warning if user does not want to include password prompt and connection info contains the password and auth type is SQL', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };

			// getConnectionString should return a connection string with password placeholder
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, false, false)).returns(() => Promise.resolve(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`));

			// Include Password Prompt - NO to include password
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves((constants.noString) as any);
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
			should(getConnectionString).equals(`Server=${connectionInfo.server};Initial Catalog=${connectionInfo.database};User ID=${connectionInfo.user};Password=${constants.passwordPlaceholder};`, 'Should return a connection string without the password');
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
						fsPath: tempFolderPath
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
						fsPath: tempFolderPath
					},
				}];
			});

			// only one azure function project found - hostFiles and csproj files stubs
			let findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
			findFilesStub.onFirstCall().resolves([vscode.Uri.file(path.join(tempFolderPath, 'host.json'))]);
			findFilesStub.onSecondCall().resolves(([vscode.Uri.file(path.join(tempFolderPath, 'test.csproj'))]) as any);

			let result = await azureFunctionsUtils.getAzureFunctionProject();
			should(result).be.equal(path.join(tempFolderPath, 'test.csproj'), 'Should return test.csproj since only one Azure function project is found');
		});

		it('Should return prompt to choose azure function project if multiple azure function projects are found', async () => {
			// set workspace folder for testing
			sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => {
				return <vscode.WorkspaceFolder[]>[{
					uri: {
						fsPath: tempFolderPath
					},
				}];
			});
			// multiple azure function projects found in workspace - hostFiles and project find files stubs
			let findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
			const temp2FolderPath = path.delimiter + 'temp2' + path.delimiter;
			findFilesStub.onFirstCall().resolves(([vscode.Uri.file(path.join(tempFolderPath, 'host.json')), vscode.Uri.file(path.join(temp2FolderPath, 'host.json'))]) as any);
			// we loop through the hostFiles to find the csproj in same directory
			// first loop we use host of /temp/host.json
			findFilesStub.onSecondCall().resolves(([vscode.Uri.file(path.join(tempFolderPath, 'test.csproj'))]) as any);
			// second loop we use host of /temp2/host.json
			findFilesStub.onThirdCall().resolves(([vscode.Uri.file(path.join(temp2FolderPath, 'test.csproj'))]) as any);
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves((path.join(tempFolderPath, 'test.csproj')) as any);

			let result = await azureFunctionsUtils.getAzureFunctionProject();
			should(result).be.equal(path.join(tempFolderPath, 'test.csproj'), 'Should return test.csproj since user choose Azure function project');
			should(quickPickStub.calledOnce).be.true('showQuickPick should have been called to choose between azure function projects');
		});
	});

	describe('PromptForObjectName', function (): void {
		it('Should prompt user to enter object name manually when no connection info given', async () => {
			let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('test');

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input);
			should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
			should(result).be.equal('test', 'Should return test since user manually entered object name');
		});

		it('Should return undefined when mssql connection error', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let inputBoxStub = sinon.stub(vscode.window, 'showInputBox');
			sinon.stub(azureFunctionsUtils, 'getConnectionURI').resolves(undefined);

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input, connectionInfo);
			should(inputBoxStub.notCalled).be.true('showInputBox should not have been called');
			should(result).be.equal(undefined, 'Should return undefined due to mssql connection error');
		});

		it('Should return undefined if no database selected', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let inputBoxStub = sinon.stub(vscode.window, 'showInputBox');
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input, connectionInfo);
			should(inputBoxStub.notCalled).be.true('showInputBox should not have been called');
			should(result).be.equal(undefined, 'Should return undefined due to no database selected');
		});

		it('Should successfully select object name', async () => {
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let inputBoxStub = sinon.stub(vscode.window, 'showInputBox');
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
			quickPickStub.onSecondCall().resolves(('[schema].[testTable]') as any);

			let result = await azureFunctionsUtils.promptForObjectName(BindingType.input, connectionInfo);

			should(inputBoxStub.notCalled).be.true('showInputBox should not have been called');
			should(quickPickStub.calledTwice).be.true('showQuickPick should have been called twice');
			should(connectionInfo.database).be.equal('testDb', 'Should have connectionInfo.database to testDb after user selects database');
			should(result).be.equal('[schema].[testTable]', 'Should return [schema].[testTable] since user selected table');
		});
	});

	describe('PromptAndUpdateConnectionStringSetting', function (): void {
		const fileUri = vscode.Uri.file(path.join(rootFolderPath, 'testProjectU'));
		it('Should prompt user to enter connection string setting only if no azure function project uri given', async () => {
			let quickPickStub = sinon.spy(vscode.window, 'showQuickPick');
			let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('test');

			let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(undefined);
			should(quickPickStub.notCalled).be.true('quickPickStub should not have been called');
			should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
			should(result?.connectionStringSettingName).be.equal('test', 'Should return test since user manually entered connection string');
			should(inputBoxStub.firstCall.args).containEql(
				{
					prompt: constants.connectionStringSetting,
					placeHolder: constants.connectionStringSettingPlaceholder,
					ignoreFocusOut: true
				}
			);
		});

		describe('No local.settings.json file', function (): void {
			let fileAccessStub: sinon.SinonStub;

			beforeEach(function (): void {
				// stubs for getLocalSettingsJson calls
				// returns {IsEncrypted: False}
				fileAccessStub = sinon.stub(fs.promises, 'access').onFirstCall().rejects();
			});

			it('Should prompt user to enter connection string setting name no connection info given', async () => {
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

				// no connection info given so prompt for connection info stubs
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves((constants.connectionProfile) as any);
				sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
				testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionInfo));
				// passsword prompt stub
				quickPickStub.onSecondCall().resolves((constants.yesString) as any);
				// getConnectionString stubs - in password prompt logic
				let connectionInfo: IConnectionInfo = createTestCredentials(); // create test connectionInfo
				let connectionDetails = { options: connectionInfo };
				testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

				// setLocalAppSetting stubs
				fileAccessStub.onSecondCall().rejects(); // getLocalSettingsJson stub
				// fails if we dont set writeFile stub
				sinon.stub(fs.promises, 'writeFile').resolves();
				sinon.stub(azureFunctionsUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'testConnectionStringName', 'testConnectionString').resolves((true));
				// addSqlNugetReferenceToProjectFile stub
				sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri);

				should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
				should(quickPickStub.callCount).be.equal(2, 'quickPickStub should have been called');
				should(result?.connectionStringSettingName).be.equal('testConnectionStringName', 'Should return testConnectionStringName from manually entered connection string name');
			});

			it('Should prompt user to enter connection string setting name when connection info given', async () => {
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

				// password prompt stub
				sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves((constants.yesString) as any);
				// getConnectionString stubs - in password prompt logic
				let connectionInfo: IConnectionInfo = createTestCredentials(); // create test connectionInfo
				let connectionDetails = { options: connectionInfo };
				testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

				// setLocalAppSetting stubs
				fileAccessStub.onSecondCall().rejects(); // getLocalSettingsJson stub
				// fails if we dont set writeFile stub
				sinon.stub(fs.promises, 'writeFile').resolves();
				sinon.stub(azureFunctionsUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'testConnectionStringName', 'testConnectionString').resolves((true));
				// addSqlNugetReferenceToProjectFile stub
				sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri, connectionInfo);

				should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
				should(quickPickStub.callCount).be.equal(1, 'quickPickStub should have been called');
				should(result?.connectionStringSettingName).be.equal('testConnectionStringName', 'Should return testConnectionStringName from manually entered connection string name');
				should(result?.connectionInfo).be.equal(connectionInfo, 'Should return connectionInfo');
			});

			it('Should return when user cancels out of manually entering connection string name prompt and has no existing connection string in local.settings.json', async () => {
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves(undefined); // user cancels out of connection string setting name
				let quickPickSpy = sinon.spy(vscode.window, 'showQuickPick');

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri);

				should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
				should(quickPickSpy.callCount).be.equal(0, 'quickPickStub should have been called');
				should(result?.connectionStringSettingName).be.equal(undefined, 'Should return undefined since user cancelled out of connection string setting name prompt');
			});

		});

		describe('local.settings.json file contains non-filtered connection setting tests', function (): void {

			beforeEach(function (): void {
				// create fake connection string settings for local.setting.json to be used
				// getLocalSettingsJson stub
				sinon.stub(fs.promises, 'access').resolves();
				sinon.stub(fs, 'readFileSync').withArgs(sinon.match.any).returns(
					`{"IsEncrypted": false,
				"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
				);
			});

			it('Should use user entered connection string setting name when non-filtered connection strings local.settings.json', async () => {
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: constants.createNewLocalAppSettingWithIcon }); // user chooses to create new connection string setting name
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

				// password prompt stub
				sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
				quickPickStub.onSecondCall().resolves((constants.yesString) as any);
				// getConnectionString stubs - in password prompt logic
				let connectionInfo: IConnectionInfo = createTestCredentials(); // create test connectionInfo
				let connectionDetails = { options: connectionInfo };
				testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

				// fails if we dont set writeFile stub
				sinon.stub(fs.promises, 'writeFile').resolves();
				sinon.stub(azureFunctionsUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'testConnectionStringName', 'testConnectionString').resolves((true));
				// addSqlNugetReferenceToProjectFile stub
				sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri, connectionInfo);

				should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
				should(quickPickStub.callCount).be.equal(2, 'showQuickPick should have been called');
				should(result?.connectionStringSettingName).be.equal('testConnectionStringName', 'Should return testConnectionStringName from manually entered connection string name');
				should(result?.connectionInfo).be.equal(connectionInfo, 'Should return connectionInfo');
			});

			it('Should use existing connection string when there are non-filtered connection strings found in local.settings.json', async () => {
				let inputBoxSpy = sinon.spy(vscode.window, 'showInputBox');
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: 'test1' }); // user chooses existing setting name

				// addSqlNugetReferenceToProjectFile stub
				sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');
				let connectionInfo: IConnectionInfo = createTestCredentials(); // create test connectionInfo

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri, connectionInfo);

				should(inputBoxSpy.notCalled).be.true('showInputBox should not have been called');
				should(quickPickStub.callCount).be.equal(1, 'showQuickPick should have been called');
				should(result?.connectionStringSettingName).be.equal('test1', 'Should return test1 setting chosen from quickpick');
				should(result?.connectionInfo).be.equal(connectionInfo, 'Should return connectionInfo');
			});

			it('Should use user entered connection string setting name and manually enter connection string when no connection info given', async () => {
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: constants.createNewLocalAppSettingWithIcon }); // user chooses to create new connection string setting name
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

				// user chooses to manually enter connection string
				quickPickStub.onSecondCall().resolves((constants.userConnectionString) as any);
				inputBoxStub.onSecondCall().resolves('testConnectionString');

				// setLocalAppSetting stubs
				// fails if we dont set writeFile stub
				sinon.stub(fs.promises, 'writeFile').resolves();
				sinon.stub(azureFunctionsUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'testConnectionStringName', 'testConnectionString').resolves((true));
				// addSqlNugetReferenceToProjectFile stub
				sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri);

				should(inputBoxStub.callCount).be.equal(2, 'showInputBox should have been called');
				should(quickPickStub.callCount).be.equal(2, 'showQuickPick should have been called');
				should(result?.connectionStringSettingName).be.equal('testConnectionStringName', 'Should return testConnectionStringName from manually entered connection string name');
			});

			it('Should prompt connection string method when user cancels out of selecting connection profile', async () => {
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: constants.createNewLocalAppSettingWithIcon }); // user chooses to create new connection string setting name
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

				// user chooses to manually enter connection string
				quickPickStub.onSecondCall().resolves((constants.userConnectionString) as any);
				inputBoxStub.onSecondCall().resolves(undefined);

				quickPickStub.onThirdCall().resolves(undefined);

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri);

				should(quickPickStub.getCall(1).args).containDeepOrdered([
					[constants.connectionProfile, constants.userConnectionString],
					{
						canPickMany: false,
						title: constants.selectConnectionString,
						ignoreFocusOut: true
					}]
				);
				should(inputBoxStub.callCount).be.equal(2, 'showInputBox should have been called twice');
				should(quickPickStub.callCount).be.equal(3, 'showQuickPick should have been called three times');
				should(result?.connectionStringSettingName).be.equal(undefined, 'Should return undefined since user cancelled out of connection string setting name prompt');
			});

			it('Should prompt connection string method when user cancels out of manually entering connection string', async () => {
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: constants.createNewLocalAppSettingWithIcon }); // user chooses to create new connection string setting name
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

				// user chooses to manually enter connection string
				quickPickStub.onSecondCall().resolves((constants.connectionProfile) as any);
				sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
				// user cancels out of connection profile prompt
				testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(undefined));

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri);

				should(quickPickStub.getCall(2).args).containDeepOrdered([
					[constants.connectionProfile, constants.userConnectionString],
					{
						canPickMany: false,
						title: constants.selectConnectionString,
						ignoreFocusOut: true
					}]
				);
				should(inputBoxStub.callCount).be.equal(1, 'showInputBox should have been called');
				should(quickPickStub.callCount).be.equal(3, 'showQuickPick should have been called three times');
				should(result?.connectionStringSettingName).be.equal(undefined, 'Should return undefined since user cancelled out of connection string setting name prompt');
			});

			it('Should prompt connection string settings when user cancels out of manually entering connection string name prompt', async () => {
				let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: constants.createNewLocalAppSettingWithIcon }); // user chooses to create new connection string setting name
				let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves(undefined); // enter connection string setting name

				// cancel out of prompt for connection string settings
				quickPickStub.onSecondCall().resolves(undefined);

				let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri);

				should(inputBoxStub.callCount).be.equal(1, 'showInputBox should have been called');
				should(quickPickStub.callCount).be.equal(2, 'showQuickPick should have been called');
				should(quickPickStub.getCall(1).args).containDeepOrdered([
					[{ label: constants.createNewLocalAppSettingWithIcon }, { label: 'test1' }, { label: 'test2' }, { label: 'test3' }],
					{
						canPickMany: false,
						title: constants.selectSetting,
						ignoreFocusOut: true
					}]
				);
				should(result?.connectionStringSettingName).be.equal(undefined, 'Should return undefined since user cancelled out of connection string setting name prompt');
			});
		});

		it('Should prompt user to enter connection string setting name when local.settings.json values contains known connection strings', async () => {
			// create fake connection string settings for local.setting.json to be used
			// getLocalSettingsJson stub
			sinon.stub(fs.promises, 'access').resolves();
			// known connection string values that will be filtered out
			sinon.stub(fs, 'readFileSync').withArgs(sinon.match.any).returns(
				`{"IsEncrypted": false,
				"Values": {"AzureWebJobsStorage": "testWebJobStorage","WEBSITE_TIME_ZONE":"testTimeZone"}}`
			);

			let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

			// password prompt stub
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves((constants.yesString) as any);
			// getConnectionString stubs - in password prompt logic
			let connectionInfo: IConnectionInfo = createTestCredentials(); // create test connectionInfo
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile').resolves();
			sinon.stub(azureFunctionsUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'testConnectionStringName', 'testConnectionString').resolves((true));
			// addSqlNugetReferenceToProjectFile stub
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri, connectionInfo);

			should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
			should(quickPickStub.callCount).be.equal(1, 'quickPickStub should have been called');
			should(result?.connectionStringSettingName).be.equal('testConnectionStringName', 'Should return testConnectionStringName from manually entered connection string name');
			should(result?.connectionInfo).be.equal(connectionInfo, 'Should return connectionInfo');
		});

		it('Should prompt user to enter connection string setting name when local.settings.json values are empty', async () => {
			// create fake connection string settings for local.setting.json to be used
			// getLocalSettingsJson stub
			sinon.stub(fs.promises, 'access').resolves();
			// empty values in local.settings.json
			sinon.stub(fs, 'readFileSync').withArgs(sinon.match.any).returns(
				`{"IsEncrypted": false,
				"Values": {}}`
			);

			let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('testConnectionStringName'); // enter connection string setting name

			// password prompt stub
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves((constants.yesString) as any);
			// getConnectionString stubs - in password prompt logic
			let connectionInfo: IConnectionInfo = createTestCredentials(); // create test connectionInfo
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile').resolves();
			sinon.stub(azureFunctionsUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'testConnectionStringName', 'testConnectionString').resolves((true));
			// addSqlNugetReferenceToProjectFile stub
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			let result = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(fileUri, connectionInfo);

			should(inputBoxStub.calledOnce).be.true('showInputBox should have been called');
			should(quickPickStub.callCount).be.equal(1, 'quickPickStub should have been called');
			should(result?.connectionStringSettingName).be.equal('testConnectionStringName', 'Should return testConnectionStringName from manually entered connection string name');
			should(result?.connectionInfo).be.equal(connectionInfo, 'Should return connectionInfo');
		});
	});

	afterEach(function (): void {
		sinon.restore();
	});
});
