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
import * as azureFunctionUtils from '../common/azureFunctionsUtils';
import * as constants from '../common/constants';
import * as utils from '../common/utils';

import { IConnectionInfo } from 'vscode-mssql';
import { createAddConnectionStringStep } from '../createNewProject/addConnectionStringStep';
import { createTestCredentials, createTestUtils, TestUtils } from './testUtils';

const rootFolderPath = 'test';
const localSettingsPath: string = path.join(rootFolderPath, 'local.settings.json');
let testUtils: TestUtils;
describe('Add Connection String Execute Step', () => {
	beforeEach(function (): void {
		testUtils = createTestUtils();
	});
	it('Should add a connection string to the local.settings.json file when creating a new Azure Functions project through execute step', async () => {
		// add spies to check the functions are called
		let testConnectionString = 'testConnectionString';
		let getSettingsFileSpy = sinon.spy(azureFunctionUtils, 'getSettingsFile').withArgs(rootFolderPath);
		let addConnectionStringSpy = sinon.spy(azureFunctionUtils, 'addConnectionStringToConfig').withArgs(testConnectionString, rootFolderPath);

		// promptConnectionStringPasswordAndUpdateConnectionString stubs
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
		let connectionDetails = { options: connectionInfo };
		// setup AzureWizardExecuteStep class
		let testExecuteStep = createAddConnectionStringStep(rootFolderPath, connectionInfo, constants.sqlConnectionStringSetting);

		// getConnectionString should return a connection string with the password
		testUtils.vscodeMssqlIExtension.setup(x => x.getConnectionString(connectionDetails, true, false)).returns(() => Promise.resolve(testConnectionString));
		// Include Password Prompt - Yes to include password
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').onFirstCall().resolves((constants.yesString) as any);
		// setup stub for setting local app setting with connection string
		sinon.stub(fs.promises, 'writeFile').resolves();
		sinon.stub(azureFunctionUtils, 'setLocalAppSetting').withArgs(sinon.match.any, sinon.match.any, sinon.match.any).resolves(true);

		// call execute step on the AzureWizardExecuteStep
		await testExecuteStep.execute(TypeMoq.It.isAny(), TypeMoq.It.isAny());

		should(quickPickStub.calledOnce).be.true('showQuickPick should have been called');
		should(getSettingsFileSpy.calledOnce).be.true('GetSettingsFile method should be called once');
		should(addConnectionStringSpy.calledOnce).be.true('addConnectionStringSpy method should be called once');
		testExecuteStep.shouldExecute(TypeMoq.It.isAny()).should.be.true('Should execute should be true');
	});

	it('Should return if no settings file found when creating a new Azure Functions project', async () => {
		// stubs and spies for methods in the execute step
		let getSettingsFileSpy = sinon.stub(azureFunctionUtils, 'getSettingsFile').withArgs(rootFolderPath).resolves((undefined));
		let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
		let quickPickStub = sinon.spy(vscode.window, 'showQuickPick');
		let addConnectionStringToConfigStub = sinon.spy(azureFunctionUtils, 'addConnectionStringToConfig');

		// call execute step on the AzureWizardExecuteStep
		let testExecuteStep = createAddConnectionStringStep(rootFolderPath, connectionInfo, constants.sqlConnectionStringSetting);
		await testExecuteStep.execute(TypeMoq.It.isAny(), TypeMoq.It.isAny());

		should(getSettingsFileSpy.calledOnce).be.true('GetSettingsFile method should be called once');
		should(quickPickStub.notCalled).be.true('showQuickPick should not be called');
		should(addConnectionStringToConfigStub.notCalled.should.be.true('addConnectionStringToConfig should not be called'));
	});

	it('Should return if no connection string is set when creating a new Azure Functions project', async () => {
		// stubs and spies for methods in the execute step
		let getSettingsFileSpy = sinon.spy(azureFunctionUtils, 'getSettingsFile').withArgs(rootFolderPath);
		let connectionInfo: IConnectionInfo = createTestCredentials();// Mocks promptForConnection
		sinon.stub(azureFunctionUtils, 'promptConnectionStringPasswordAndUpdateConnectionString').withArgs(connectionInfo, localSettingsPath).resolves((undefined));
		let addConnectionStringToConfigStub = sinon.spy(azureFunctionUtils, 'addConnectionStringToConfig');

		// call execute step on the AzureWizardExecuteStep
		let testExecuteStep = createAddConnectionStringStep(rootFolderPath, connectionInfo, constants.sqlConnectionStringSetting);
		await testExecuteStep.execute(TypeMoq.It.isAny(), TypeMoq.It.isAny());

		should(getSettingsFileSpy.calledOnce).be.true('GetSettingsFile method should be called once');
		should(addConnectionStringToConfigStub.notCalled.should.be.true('addConnectionStringToConfig should not be called'));
	});

	afterEach(function (): void {
		sinon.restore();
	});
});
