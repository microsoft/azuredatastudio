/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as utils from '../../common/utils';
import * as constants from '../../common/constants';
import * as azureFunctionUtils from '../../common/azureFunctionsUtils';
import * as azureFunctionsContracts from '../../contracts/azureFunctions/azureFunctionsContracts';
import * as azureFunctionService from '../../services/azureFunctionsService';

import { createTestUtils, TestUtils, createTestCredentials, createTestTableNode } from '../testUtils';
import { IConnectionInfo } from 'vscode-mssql';
import { BindingType } from 'sql-bindings';

const rootFolderPath = 'test';
const projectFilePath: string = path.join(rootFolderPath, 'test.csproj');
let testUtils: TestUtils;
describe('AzureFunctionsService', () => {
	describe('Create Azure Function with SQL Binding', () => {
		beforeEach(function (): void {
			testUtils = createTestUtils();
		});

		afterEach(function (): void {
			sinon.restore();
		});

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

			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			connectionInfo.database = 'testDb';

			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			// select input or output binding
			let quickpickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(<any>{ label: constants.input, type: BindingType.input });

			// no table used for connection info so prompt user to get connection info
			testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionInfo));
			testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionInfo)).returns(() => Promise.resolve('testConnectionURI'));
			testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
			// select the testDB from list of databases based on connection info
			quickpickStub.onSecondCall().returns(Promise.resolve('testDb') as any);
			// get tables from selected database
			const params = { ownerUri: 'testConnectionURI', queryString: azureFunctionUtils.tablesQuery('testDb') };
			testUtils.vscodeMssqlIExtension.setup(x => x.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params))
				.returns(() => Promise.resolve({ rowCount: 1, columnInfo: [], rows: [['[schema].[testTable]']] }));
			// select the schema.testTable from list of tables based on connection info and database
			quickpickStub.onThirdCall().returns(Promise.resolve('[schema].[testTable]') as any);

			// set azure function name
			let inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('testFunctionName');

			// promptAndUpdateConnectionStringSetting
			quickpickStub.onCall(3).resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
			inputStub.onSecondCall().resolves('SqlConnectionString');
			// promptConnectionStringPasswordAndUpdateConnectionString - tested in AzureFunctionUtils.test.ts
			quickpickStub.onCall(4).returns(Promise.resolve(constants.yesString) as any);
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));
			// setLocalAppSetting with connection string setting name and connection string
			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile');
			sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'SqlConnectionString', 'testConnectionString').returns(Promise.resolve(true));
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			const testWatcher = TypeMoq.Mock.ofType<vscode.FileSystemWatcher>().object;
			sinon.stub(azureFunctionUtils, 'waitForNewFunctionFile').withArgs(sinon.match.any).returns({ filePromise: Promise.resolve('TestFileCreated'), watcherDisposable: testWatcher });
			await azureFunctionService.createAzureFunction();

			should(spy.notCalled).be.true('showErrorMessage should not have been called');
			// set the connection info to be the one the user selects from list of databases quickpick
			should(connectionInfo.database).equal('testDb');
		});

		it('Should create azure function project using command via the sql server table OE', async function (): Promise<void> {
			// This test will have an azure function project already in the project and the azure functions extension installed (stubbed)
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(azureFunctionUtils, 'getAzureFunctionProject').resolves(projectFilePath); //set azure function project to have one project
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			// select input or output binding
			let quickpickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(<any>{ label: constants.input, type: BindingType.input });
			// table node used when creating azure function project
			let tableTestNode = createTestTableNode(connectionInfo);

			// set azure function name
			let inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('testFunctionName');

			// promptAndUpdateConnectionStringSetting
			quickpickStub.onSecondCall().resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
			inputStub.onSecondCall().resolves('SqlConnectionString');
			// promptConnectionStringPasswordAndUpdateConnectionString - tested in AzureFunctionUtils.test.ts
			quickpickStub.onThirdCall().returns(Promise.resolve(constants.yesString) as any);
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));
			// setLocalAppSetting with connection string setting name and connection string
			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile');
			sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'SqlConnectionString', 'testConnectionString').returns(Promise.resolve(true));
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			const testWatcher = TypeMoq.Mock.ofType<vscode.FileSystemWatcher>().object;
			sinon.stub(azureFunctionUtils, 'waitForNewFunctionFile').withArgs(sinon.match.any).returns({ filePromise: Promise.resolve('TestFileCreated'), watcherDisposable: testWatcher });

			await azureFunctionService.createAzureFunction(tableTestNode);

			should(spy.notCalled).be.true('showErrorMessage should not have been called');
			// set the connection info to be the one used from the test table node from OE
			should(connectionInfo.database).equal('testDb');
		});

		it('Should open link to learn more about SQL bindings when no azure function project found in folder or workspace', async function (): Promise<void> {
			// This test will ask user that an azure function project must be opened to create an azure function with sql binding
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			const executeCommandSpy = sinon.stub(vscode.commands, 'executeCommand').withArgs(sinon.match.any, sinon.match.any).returns(Promise.resolve());
			const showErrorStub = sinon.stub(vscode.window, 'showErrorMessage').returns(Promise.resolve(constants.learnMore) as any);
			await azureFunctionService.createAzureFunction();

			should(executeCommandSpy.calledOnce).be.true('showErrorMessage should have been called');
			should(showErrorStub.calledOnce).be.true('showErrorMessage should have been called');
		});

		it('Should ask the user to choose a folder to use for the azure project and create an azure function with the selected folder', async function (): Promise<void> {
			// This test will ask user that an azure function project must be opened to create an azure function with sql binding
			sinon.stub(azureFunctionUtils, 'getAzureFunctionsExtensionApi').resolves(testUtils.azureFunctionsExtensionApi.object); // set azure functions extension api
			sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);

			let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
			let connectionDetails = { options: connectionInfo };
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));

			// error since no project file found in workspace or folder
			const showErrorStub = sinon.stub(vscode.window, 'showErrorMessage').returns(Promise.resolve(constants.createProject) as any);

			// user chooses to browse for folder
			let quickpickStub = sinon.stub(vscode.window, 'showQuickPick').returns(Promise.resolve(constants.browseEllipsisWithIcon) as any);

			// stub out folder to be chosen (showOpenDialog)
			sinon.stub(vscode.window, 'showOpenDialog').withArgs(sinon.match.any).resolves([vscode.Uri.file(projectFilePath)]);
			// select input or output binding
			quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });
			// table node used when creating azure function project
			let tableTestNode = createTestTableNode(connectionInfo);

			// set azure function name
			let inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('testFunctionName');

			// promptAndUpdateConnectionStringSetting
			quickpickStub.onThirdCall().resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
			inputStub.onSecondCall().resolves('SqlConnectionString');
			// promptConnectionStringPasswordAndUpdateConnectionString - tested in AzureFunctionUtils.test.ts
			quickpickStub.onCall(3).returns(Promise.resolve(constants.yesString) as any);
			testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString'));
			// setLocalAppSetting with connection string setting name and connection string
			// fails if we dont set writeFile stub
			sinon.stub(fs.promises, 'writeFile');
			sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'SqlConnectionString', 'testConnectionString').returns(Promise.resolve(true));
			sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');

			const testWatcher = TypeMoq.Mock.ofType<vscode.FileSystemWatcher>().object;
			sinon.stub(azureFunctionUtils, 'waitForNewFunctionFile').withArgs(sinon.match.any).returns({ filePromise: Promise.resolve('TestFileCreated'), watcherDisposable: testWatcher });

			await azureFunctionService.createAzureFunction(tableTestNode);

			should(showErrorStub.calledOnce).be.true('showErrorMessage should have been called');
		});
	});
});
