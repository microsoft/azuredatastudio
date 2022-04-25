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
import * as azureFunctionService from '../../services/azureFunctionsService';

import { createTestUtils, TestUtils, createTestCredentials } from '../testUtils';
import { launchAddSqlBindingQuickpick } from '../../dialogs/addSqlBindingQuickpick';
import { BindingType } from 'sql-bindings';

let testUtils: TestUtils;
const fileUri = vscode.Uri.file('testUri');
describe('Add SQL Binding quick pick', () => {
	beforeEach(function (): void {
		testUtils = createTestUtils();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should show error if the file contains no Azure Functions', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: []
			}));
		const spy = sinon.spy(vscode.window, 'showErrorMessage');

		await launchAddSqlBindingQuickpick(fileUri);

		const msg = constants.noAzureFunctionsInFile;
		should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(spy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${spy.getCall(0).args[0]}'`);
	});

	it('Should show error if adding SQL binding was not successful', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1', 'af2']
			}));
		//failure since no AFs are found in the project
		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(undefined);
		const errormsg = 'Error inserting binding';
		sinon.stub(azureFunctionService, 'addSqlBinding').withArgs(
			sinon.match.any, sinon.match.any, sinon.match.any,
			sinon.match.any, sinon.match.any).returns(
				Promise.resolve({
					success: false,
					errorMessage: errormsg
				}));
		const spy = sinon.spy(vscode.window, 'showErrorMessage');

		// select Azure function
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({ label: 'af1' });
		// select input or output binding
		quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });
		// give object name
		let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('dbo.table1');
		// give connection string setting name
		inputBoxStub.onSecondCall().resolves('sqlConnectionString');

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'));

		should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		should(spy.calledWith(errormsg)).be.true(`showErrorMessage not called with expected message '${errormsg}' Actual '${spy.getCall(0).args[0]}'`);
	});

	it('Should show error connection profile does not connect', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		let connectionCreds = createTestCredentials();

		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(vscode.Uri.file('testUri'));
		sinon.stub(azureFunctionService, 'getAzureFunctions').withArgs(fileUri.fsPath).returns(
			Promise.resolve({
				success: true,
				errorMessage: '',
				azureFunctions: ['af1']
			}));

		// Mocks connect call to mssql
		let error = new Error('Connection Request Failed');
		testUtils.vscodeMssqlIExtension.setup(x => x.connect(TypeMoq.It.isAny(), undefined)).throws(error);

		// Mocks promptForConnection
		testUtils.vscodeMssqlIExtension.setup(x => x.promptForConnection(true)).returns(() => Promise.resolve(connectionCreds));
		let quickpickStub = sinon.stub(vscode.window, 'showQuickPick');
		// select Azure function
		quickpickStub.onFirstCall().resolves({ label: 'af1' });
		// select input or output binding
		quickpickStub.onSecondCall().resolves(<any>{ label: constants.input, type: BindingType.input });

		// give object name
		let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').onFirstCall().resolves('dbo.table1');

		// select connection profile
		quickpickStub.onThirdCall().resolves({ label: constants.createNewLocalAppSettingWithIcon });

		// give connection string setting name
		inputBoxStub.onSecondCall().resolves('SqlConnectionString');

		// select connection profile method
		quickpickStub.onCall(3).resolves({ label: constants.connectionProfile });

		await launchAddSqlBindingQuickpick(vscode.Uri.file('testUri'));

		// should go back to the select connection string methods
		should(quickpickStub.callCount === 4);
		should(quickpickStub.getCall(3).args).deepEqual([
			[constants.connectionProfile, constants.userConnectionString],
			{
				canPickMany: false,
				ignoreFocusOut: true,
				title: constants.selectConnectionString
			}]);
	});
});
