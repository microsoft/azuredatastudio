/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as utils from '../../common/utils';
import * as constants from '../../common/constants';
import * as azureFunctionUtils from '../../common/azureFunctionsUtils';

import { createContext, TestContext, createTestCredentials } from '../testContext';
import { launchAddSqlBindingQuickpick } from '../../dialogs/addSqlBindingQuickpick';
import { PackageHelper } from '../../tools/packageHelper';

let testContext: TestContext;
let packageHelper: PackageHelper;
describe('Add SQL Binding quick pick', () => {
	beforeEach(function (): void {
		testContext = createContext();
		packageHelper = new PackageHelper(testContext.outputChannel);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should show error if the file contains no Azure Functions', async function (): Promise<void> {
		sinon.stub(utils, 'getAzureFunctionService').resolves(testContext.azureFunctionService.object);
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testContext.vscodeMssqlIExtension.object);
		const spy = sinon.spy(vscode.window, 'showErrorMessage');
		testContext.azureFunctionService.setup(x => x.getAzureFunctions(TypeMoq.It.isAny())).returns(async () => {
			return Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: []
			});
		});
		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'), packageHelper);

		const msg = constants.noAzureFunctionsInFile;
		should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(spy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${spy.getCall(0).args[0]}'`);
	});

	it('Should show error if adding SQL binding was not successful', async function (): Promise<void> {
		sinon.stub(utils, 'getAzureFunctionService').resolves(testContext.azureFunctionService.object);
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testContext.vscodeMssqlIExtension.object);
		const spy = sinon.spy(vscode.window, 'showErrorMessage');
		testContext.azureFunctionService.setup(x => x.getAzureFunctions(TypeMoq.It.isAny())).returns(async () => {
			return Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1', 'af2']
			});
		});
		//failure since no AFs are found in the project
		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(undefined);
		const errormsg = 'Error inserting binding';
		testContext.azureFunctionService.setup(x => x.addSqlBinding(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => {
			return Promise.resolve({
				success: false,
				errorMessage: errormsg
			});
		});

		// select Azure function
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: 'af1' });
		// select input or output binding
		quickpickStub.onSecondCall().resolves({ label: constants.input });
		// give object name
		let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('dbo.table1');
		// give connection string setting name
		inputBoxStub.onSecondCall().resolves('sqlConnectionString');

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'), packageHelper);

		should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(spy.calledWith(errormsg)).be.true(`showErrorMessage not called with expected message '${errormsg}' Actual '${spy.getCall(0).args[0]}'`);
	});

	it('Should show error connection profile does not connect', async function (): Promise<void> {
		sinon.stub(utils, 'getAzureFunctionService').resolves(testContext.azureFunctionService.object);
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testContext.vscodeMssqlIExtension.object);
		let connectionCreds = createTestCredentials();

		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(vscode.Uri.file('testUri'));
		testContext.azureFunctionService.setup(x => x.getAzureFunctions(TypeMoq.It.isAny())).returns(async () => {
			return Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1']
			});
		});

		// Mocks connect call to mssql
		let error = new Error('Connection Request Failed');
		testContext.vscodeMssqlIExtension.setup(x => x.connect(TypeMoq.It.isAny(), undefined)).throws(error);

		// Mocks promptForConnection
		testContext.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionCreds));
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		// select Azure function
		quickpickStub.onFirstCall().resolves({ label: 'af1' });
		// select input or output binding
		quickpickStub.onSecondCall().resolves({ label: constants.input });

		// give object name
		let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('dbo.table1');

		// select connection profile
		quickpickStub.onThirdCall().resolves({ label: constants.createNewLocalAppSettingWithIcon });

		// give connection string setting name
		inputBoxStub.onSecondCall().resolves('SqlConnectionString');

		// select connection profile method
		quickpickStub.onCall(3).resolves({ label: constants.connectionProfile });

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'), packageHelper);

		// should go back to the select connection string methods
		should(quickpickStub.callCount === 5);
		should(quickpickStub.getCall(4).args).deepEqual([
			[constants.connectionProfile, constants.userConnectionString],
			{
				canPickMany: false,
				ignoreFocusOut: true,
				title: constants.selectConnectionString
			}]);
	});
});
