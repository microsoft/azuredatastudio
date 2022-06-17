/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as azureFunctionUtils from '../../common/azureFunctionsUtils';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as azureFunctionsContracts from '../../contracts/azureFunctions/azureFunctionsContracts';
import * as azureFunctionService from '../../services/azureFunctionsService';

import { BindingType } from 'sql-bindings';
import { IConnectionInfo } from 'vscode-mssql';
import { createTestCredentials, createTestTableNode, createTestUtils, TestUtils } from '../testUtils';

const rootFolderPath = 'test';
const projectFilePath: string = path.join(rootFolderPath, 'test.csproj');
let testUtils: TestUtils;
describe('AzureFunctionsService', () => {
	beforeEach(function (): void {
		testUtils = createTestUtils();
	});
	describe('Create Azure Function with SQL Binding', () => {
		it('Should show info message to install azure functions extension if not installed', async function (): Promise<void> {
			const infoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);
			await azureFunctionService.createAzureFunction();
			should(infoStub.calledOnce).be.true('showInformationMessage should be called once');
			should(infoStub.args).containEql([constants.azureFunctionsExtensionNotFound,
			constants.install, constants.learnMore, constants.doNotInstall]);
		});

		it('Should create azure function project using the command from command palette (no connection info)', async function (): Promise<void> {
			// This test will have an azure function project already in the project and the azure functions extension installed (stubbed)
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(azureFunctionUtils, 'getAzureFunctionProject').resolves(projectFilePath); //set azure function project to have one project
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo

			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');

			// select input or output binding
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(<any>{ label: constants.input, type: BindingType.input });

			// no table used for connection info so prompt user to get connection info
			testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionInfo));
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
			// select the testDB from list of databases based on connection info
			quickPickStub.onSecondCall().resolves(('testDb') as any);
			// get tables from selected database
			const params = { ownerUri: 'testConnectionURI', queryString: azureFunctionUtils.tablesQuery('testDb') };
			testUtils.vscodeMssqlIExtension.setup(x => x.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params))
				.returns(() => Promise.resolve({ rowCount: 1, columnInfo: [], rows: [[{ displayValue: '[schema].[testTable]' }]] }));
			// select the schema.testTable from list of tables based on connection info and database
			quickPickStub.onThirdCall().resolves(('[schema].[testTable]') as any);

			// set azure function name
			let inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('testFunctionName');

			// promptAndUpdateConnectionStringSetting
			quickPickStub.onCall(3).resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
			inputStub.onSecondCall().resolves('SqlConnectionString');
			// promptConnectionStringPasswordAndUpdateConnectionString - tested in AzureFunctionUtils.test.ts
			quickPickStub.onCall(4).resolves((constants.yesString) as any);
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));
			// setLocalAppSetting with connection string setting name and connection string
			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile').resolves();
			sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'SqlConnectionString', 'testConnectionString').resolves((true));
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			const testWatcher = TypeMoq.Mock.ofType<vscode.FileSystemWatcher>().object;
			sinon.stub(azureFunctionUtils, 'waitForNewFunctionFile').withArgs(sinon.match.any).returns({ filePromise: Promise.resolve('TestFileCreated'), watcherDisposable: testWatcher });

			should(connectionInfo.database).equal('my_db', 'ConnectionInfo database should not be changed');
			await azureFunctionService.createAzureFunction();

			should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');
			// set the connection info to be the one the user selects from list of databases quickpick
			should(connectionInfo.database).equal('testDb', 'connectionInfo.database should be testDb after user selects testDb');
		});

		it('Should create azure function project using command via the sql server table OE', async function (): Promise<void> {
			// This test will have an azure function project already in the project and the azure functions extension installed (stubbed)
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(azureFunctionUtils, 'getAzureFunctionProject').resolves(projectFilePath); //set azure function project to have one project
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');

			// select input or output binding
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(<any>{ label: constants.input, type: BindingType.input });
			// table node used when creating azure function project
			let tableTestNode = createTestTableNode(connectionInfo);

			// set azure function name
			let inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('testFunctionName');

			// promptAndUpdateConnectionStringSetting
			quickPickStub.onSecondCall().resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
			inputStub.onSecondCall().resolves('SqlConnectionString');
			// promptConnectionStringPasswordAndUpdateConnectionString - tested in AzureFunctionUtils.test.ts
			quickPickStub.onThirdCall().resolves((constants.yesString) as any);
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));
			// setLocalAppSetting with connection string setting name and connection string
			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile').resolves();
			sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'SqlConnectionString', 'testConnectionString').resolves((true));
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			const testWatcher = TypeMoq.Mock.ofType<vscode.FileSystemWatcher>().object;
			sinon.stub(azureFunctionUtils, 'waitForNewFunctionFile').withArgs(sinon.match.any).returns({ filePromise: Promise.resolve('TestFileCreated'), watcherDisposable: testWatcher });

			should(connectionInfo.database).equal('my_db', 'ConnectionInfo database should not be changed');
			await azureFunctionService.createAzureFunction(tableTestNode);

			should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');
			// set the connection info to be the one used from the test table node from OE
			should(connectionInfo.database).equal('testDb', 'connectionInfo.database should be testDb after user selects testDb');
		});

		it('Should open link to learn more about SQL bindings when no azure function project found in folder or workspace', async function (): Promise<void> {
			// This test will ask user that an azure function project must be opened to create an azure function with sql binding
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			const executeCommandSpy = sinon.stub(vscode.commands, 'executeCommand').withArgs(sinon.match.any, sinon.match.any).resolves();
			const showErrorStub = sinon.stub(vscode.window, 'showErrorMessage').resolves((constants.learnMore) as any);
			await azureFunctionService.createAzureFunction();

			should(executeCommandSpy.calledOnce).be.true('showErrorMessage should have been called');
			should(showErrorStub.calledOnce).be.true('showErrorMessage should have been called');
		});

		it('Should ask the user to choose a folder to use for the azure project and create an azure function with the selected folder', async function (): Promise<void> {
			// This test will ask user that an azure function project must be opened to create an azure function with sql binding
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			// error since no project file found in workspace or folder
			const showErrorStub = sinon.stub(vscode.window, 'showErrorMessage').resolves((constants.createProject) as any);

			// user chooses to browse for folder
			let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves((constants.browseEllipsisWithIcon) as any);

			// stub out folder to be chosen (showOpenDialog)
			sinon.stub(vscode.window, 'showOpenDialog').withArgs(sinon.match.any).resolves([vscode.Uri.file(projectFilePath)]);
			// select input or output binding
			quickPickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });
			// table node used when creating azure function project
			let tableTestNode = createTestTableNode(connectionInfo);

			// set azure function name
			let inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('testFunctionName');

			// promptAndUpdateConnectionStringSetting
			quickPickStub.onThirdCall().resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
			inputStub.onSecondCall().resolves('SqlConnectionString');
			// promptConnectionStringPasswordAndUpdateConnectionString - tested in AzureFunctionUtils.test.ts
			quickPickStub.onCall(3).resolves((constants.yesString) as any);
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));
			// setLocalAppSetting with connection string setting name and connection string
			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile').resolves();
			sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'SqlConnectionString', 'testConnectionString').resolves((true));
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			const testWatcher = TypeMoq.Mock.ofType<vscode.FileSystemWatcher>().object;
			sinon.stub(azureFunctionUtils, 'waitForNewFunctionFile').withArgs(sinon.match.any).returns({ filePromise: Promise.resolve('TestFileCreated'), watcherDisposable: testWatcher });

			should(connectionInfo.database).equal('my_db', 'ConnectionInfo database should not be changed');
			await azureFunctionService.createAzureFunction(tableTestNode);

			should(showErrorStub.calledOnce).be.true('showErrorMessage should have been called');
		});
	});

	describe('Cancel/Error scenarios for Azure Function with SQL Binding ', function (): void {
		let quickPickStub: sinon.SinonStub;
		beforeEach(function (): void {
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(azureFunctionUtils, 'getAzureFunctionProject').resolves(projectFilePath); //set azure function project to have one project
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			// select input or output binding
			quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(<any>{ label: constants.input, type: BindingType.input });
		});
		it('Should prompt connection profile when user cancels selecting database', async function (): Promise<void> {
			// This test will have an azure function project already in the project and the azure functions extension installed (stubbed)
			let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo

			// promptForConnection is selected first time for user and then set undefined in order to exit out of the createFunction
			let promptForConnectionStub = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(true).onFirstCall().resolves(connectionInfo);
			promptForConnectionStub.onSecondCall().resolves(undefined);
			// required calls to get databases list for setting up promptForDatabase
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
			// cancel out of promptForDatabase - select database to use
			quickPickStub.onSecondCall().resolves(undefined);

			await azureFunctionService.createAzureFunction();

			// promptForConnection should be prompted twice since the user cancels the quickpick to select database
			should(promptForConnectionStub.callCount).equal(2, 'promptForConnection should have been called 2 times only');
		});

		it('Should prompt connection profile when user cancels selecting table', async function (): Promise<void> {
			// This test will re-prompt the user to choose connection profile
			let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo

			// promptForConnection is selected first time for user
			let promptForConnectionStub = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(true).onFirstCall().resolves(connectionInfo);
			// required calls to get databases list for setting up promptForDatabase
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
			// select the testDB for promptForDatabase
			quickPickStub.onSecondCall().resolves(('testDb') as any);

			// get tables from selected database
			const params = { ownerUri: 'testConnectionURI', queryString: azureFunctionUtils.tablesQuery('testDb') };
			testUtils.vscodeMssqlIExtension.setup(x => x.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params))
				.returns(() => Promise.resolve({ rowCount: 1, columnInfo: [], rows: [[{ displayValue: '[schema].[testTable]' }]] }));

			// cancel out of promptForTables - select table to use
			quickPickStub.onThirdCall().resolves(undefined);
			// resolve promises to undefined to exit out of createFunction
			promptForConnectionStub.onSecondCall().resolves(undefined);

			await azureFunctionService.createAzureFunction();

			// promptForConnection should be prompted twice since the user cancels the quickpick to select table
			should(promptForConnectionStub.callCount).equal(2, 'promptForConnection should have been called 2 times only');
		});

		it('Should prompt select table when user cancels out of manually entering table', async function (): Promise<void> {
			// This test will have an azure function project already in the project and the azure functions extension installed (stubbed)
			let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo

			// no table used for connection info so prompt user to get connection info
			// promptForConnection is set first time for user
			let promptForConnectionStub = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(true).onFirstCall().resolves(connectionInfo);
			// setup listDatabases request with connectionURI
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
			// select the testDB from list of databases based on connection info
			quickPickStub.onSecondCall().resolves(('testDb') as any);
			// get tables from selected database
			const params = { ownerUri: 'testConnectionURI', queryString: azureFunctionUtils.tablesQuery('testDb') };
			testUtils.vscodeMssqlIExtension.setup(x => x.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params))
				.returns(() => Promise.resolve({ rowCount: 1, columnInfo: [], rows: [[{ displayValue: '[schema].[testTable]' }]] }));
			// select the option to manually enter table name
			let manuallyEnterObjectName = constants.manuallyEnterObjectName(constants.enterObjectName);
			quickPickStub.onThirdCall().resolves(manuallyEnterObjectName as any);
			// cancel out of manually enter inputBox
			sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
			// resolve promises to undefined to exit out of createFunction
			quickPickStub.onCall(4).resolves(undefined);
			promptForConnectionStub.onSecondCall().resolves(undefined);

			should(connectionInfo.database).equal('my_db', 'ConnectionInfo database should not be changed');
			await azureFunctionService.createAzureFunction();

			should(connectionInfo.database).equal('testDb', 'ConnectionInfo database should be user selected database');
			should(quickPickStub.getCall(3).args).containDeepOrdered([
				[manuallyEnterObjectName, '[schema].[testTable]'],
				{
					canPickMany: false,
					title: constants.selectTable,
					ignoreFocusOut: true
				}]
			);
		});

		it('Should prompt for connection profile if connection throws connection error', async function (): Promise<void> {
			// no table used for connection info so prompt user to get connection info
			// promptForConnection is selected first time for user and then set undefined in order to exit out of the createFunction
			let promptForConnectionStub = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(true).throws('Error connecting to connection profile');
			promptForConnectionStub.onSecondCall().resolves(undefined);

			await azureFunctionService.createAzureFunction();

			// re prompt the promptForConnection if the first connection throws an error
			should(promptForConnectionStub.callCount).equal(2, 'promptForConnection should have been called 2 times only');
		});
	});

	afterEach(function (): void {
		sinon.restore();
	});
});
