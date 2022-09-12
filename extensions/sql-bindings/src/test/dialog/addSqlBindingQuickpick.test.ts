/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
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
import { launchAddSqlBindingQuickpick } from '../../dialogs/addSqlBindingQuickpick';
import { createTestCredentials, createTestUtils, TestUtils } from '../testUtils';

let testUtils: TestUtils;
const fileUri = vscode.Uri.file('testUri');
describe('Add SQL Binding quick pick', () => {
	beforeEach(function (): void {
		testUtils = createTestUtils();
		// create fake connection string settings for local.setting.json to be used
		sinon.stub(fs.promises, 'access').onFirstCall().resolves();
		sinon.stub(fs, 'readFileSync').withArgs(sinon.match.any).returns(
			`{"IsEncrypted": false,
				"Values": {"test1": "test1", "test2": "test2", "test3":"test3"}}`
		);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should successfully add SQL binding', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		let connectionCreds: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
		let connectionDetails = { options: connectionCreds };
		// set test vscode-mssql API calls
		testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionCreds));
		testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString1'));
		testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionCreds)).returns(() => Promise.resolve('testConnectionURI'));
		testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
		const params = { ownerUri: 'testConnectionURI', queryString: azureFunctionUtils.tablesQuery('testDb') };
		testUtils.vscodeMssqlIExtension.setup(x => x.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params))
			.returns(() => Promise.resolve({ rowCount: 1, columnInfo: [], rows: [['[schema].[testTable]']] }));

		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1', 'af2']
			}));

		sinon.stub(azureFunctionService, 'addSqlBinding').withArgs(
			sinon.match.any, sinon.match.any, sinon.match.any,
			sinon.match.any, sinon.match.any).returns(
				Promise.resolve({
					success: true,
					errorMessage: ''
				}));
		const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');

		// select Azure function
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(('af1') as any);
		// select input or output binding
		quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });
		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(vscode.Uri.file('testUri'));
		// select connection string setting method - create new
		quickpickStub.onThirdCall().resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
		// give connection string setting name
		sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('sqlConnectionString');
		quickpickStub.onCall(3).resolves((constants.connectionProfile) as any);
		quickpickStub.onCall(4).resolves((constants.yesString) as any);
		// setLocalAppSetting fails if we dont set writeFile stub
		sinon.stub(fs.promises, 'writeFile').resolves();
		sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'sqlConnectionString', 'testConnectionString1').resolves((true));
		sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');
		quickpickStub.onCall(5).resolves(('testDb') as any);
		quickpickStub.onCall(6).resolves(('[schema].[testTable]') as any);

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'));

		should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not be called');
	});

	it('Should show error if adding SQL binding was not successful', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		let connectionCreds: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
		let connectionDetails = { options: connectionCreds };
		// set test vscode-mssql API calls
		testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionCreds));
		testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve('testConnectionString2'));
		testUtils.vscodeMssqlIExtension.setup(x => x.connect(connectionCreds)).returns(() => Promise.resolve('testConnectionURI'));
		testUtils.vscodeMssqlIExtension.setup(x => x.listDatabases('testConnectionURI')).returns(() => Promise.resolve(['testDb']));
		const params = { ownerUri: 'testConnectionURI', queryString: azureFunctionUtils.tablesQuery('testDb') };
		testUtils.vscodeMssqlIExtension.setup(x => x.sendRequest(azureFunctionsContracts.SimpleExecuteRequest.type, params))
			.returns(() => Promise.resolve({ rowCount: 1, columnInfo: [], rows: [['[schema].[testTable]']] }));

		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1', 'af2']
			}));
		//failure since no AFs are found in the project
		const errormsg = 'Error inserting binding';
		sinon.stub(azureFunctionService, 'addSqlBinding').withArgs(
			sinon.match.any, sinon.match.any, sinon.match.any,
			sinon.match.any, sinon.match.any).returns(
				Promise.resolve({
					success: false,
					errorMessage: errormsg
				}));
		const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');

		// select Azure function
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(('af1') as any);
		// select input or output binding
		quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });
		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(vscode.Uri.file('testUri'));
		// select connection profile - create new
		quickpickStub.onThirdCall().resolves(<any>{ label: constants.createNewLocalAppSettingWithIcon });
		// give connection string setting name
		sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('sqlConnectionString');
		quickpickStub.onCall(3).resolves((constants.connectionProfile) as any);
		quickpickStub.onCall(4).resolves((constants.yesString) as any);
		// setLocalAppSetting fails if we dont set writeFile stub
		sinon.stub(fs.promises, 'writeFile').resolves();
		sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, 'sqlConnectionString', 'testConnectionString2').resolves((true));
		sinon.stub(utils, 'executeCommand').resolves('downloaded nuget package');
		quickpickStub.onCall(5).resolves(('testDb') as any);
		quickpickStub.onCall(6).resolves(('[schema].[testTable]') as any);

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'));

		should(showErrorMessageSpy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(showErrorMessageSpy.calledWith(errormsg)).be.true(`showErrorMessage not called with expected message '${errormsg}' Actual '${showErrorMessageSpy.getCall(0).args[0]}'`);
	});

	it('Should show error if the file contains no Azure Functions', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: []
			}));
		const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');

		await launchAddSqlBindingQuickpick(fileUri);

		const msg = constants.noAzureFunctionsInFile;
		should(showErrorMessageSpy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(showErrorMessageSpy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${showErrorMessageSpy.getCall(0).args[0]}'`);
	});

	it('Should show error when connection profile does not connect', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		let connectionCreds = createTestCredentials();

		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(vscode.Uri.file('testUri'));
		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1']
			}));

		// Mocks promptForConnection
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		// select Azure function
		quickpickStub.onFirstCall().resolves({ label: 'af1' });
		// select input or output binding
		quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });

		// select connection string setting name
		quickpickStub.onThirdCall().resolves({ label: constants.createNewLocalAppSettingWithIcon });

		// give connection string setting name
		sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('SqlConnectionString');

		// select connection profile method
		quickpickStub.onCall(3).resolves({ label: constants.connectionProfile });
		testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionCreds));

		// Mocks connect call to mssql
		let error = new Error('Connection Request Failed');
		testUtils.vscodeMssqlIExtension.setup(x => x.connect(TypeMoq.It.isAny(), undefined)).throws(error);

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'));

		// should go back to the select connection string methods
		should(quickpickStub.callCount).be.equal(5, 'showQuickPick should have been called 5 times');
		should(quickpickStub.getCall(3).args).deepEqual([
			[constants.connectionProfile, constants.userConnectionString],
			{
				canPickMany: false,
				ignoreFocusOut: true,
				title: constants.selectConnectionString
			}]
		);
	});

	it('Should show user connection string setting method after cancelling out of connection string setting name', async function (): Promise<void> {
		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(vscode.Uri.file('testUri'));
		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1']
			}));

		// Mocks promptForConnection
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		// select Azure function
		quickpickStub.onFirstCall().resolves({ label: 'af1' });
		// select input or output binding
		quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });

		// select connection string setting name
		quickpickStub.onThirdCall().resolves({ label: constants.createNewLocalAppSettingWithIcon });

		// give connection string setting name
		sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves(undefined);

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'));

		// should go back to the select connection string methods
		should(quickpickStub.callCount).be.equal(4, 'showQuickPick should have been called 4 times');
		should(quickpickStub.getCall(2).args).containDeepOrdered([
			[{ label: constants.createNewLocalAppSettingWithIcon }],
			{
				canPickMany: false,
				title: constants.selectSetting,
				ignoreFocusOut: true
			}]
		);
	});

	it('Should show user connection string setting method after cancelling out of manually entering connection string', async function (): Promise<void> {
		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(vscode.Uri.file('testUri'));
		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1']
			}));

		// Mocks promptForConnection
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		// select Azure function
		quickpickStub.onFirstCall().resolves({ label: 'af1' });
		// select input or output binding
		quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });

		// select connection string setting name
		quickpickStub.onThirdCall().resolves({ label: constants.createNewLocalAppSettingWithIcon });

		// give connection string setting name
		let inputBox = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('SqlConnectionString');

		// select enter connection string manually
		quickpickStub.onCall(3).resolves({ label: constants.enterConnectionString });

		// user cancels prompt to enter connection string
		inputBox.onSecondCall().resolves(undefined);

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'));

		// should go back to the select connection string methods
		should(quickpickStub.callCount).be.equal(5, 'showQuickPick should have been called 5 times');
		should(quickpickStub.getCall(4).args).containDeepOrdered([
			[constants.connectionProfile, constants.enterConnectionString],
			{
				canPickMany: false,
				title: constants.selectConnectionString,
				ignoreFocusOut: true
			}]
		);
	});
});
