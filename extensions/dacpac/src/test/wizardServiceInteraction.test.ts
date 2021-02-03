/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as loc from '../localizedConstants';
import * as utils from '../utils';
import { DataTierApplicationWizard, Operation } from '../wizard/dataTierApplicationWizard';
import { DacFxDataModel } from '../wizard/api/models';
import { DacFxTestService, deployOperationId, extractOperationId, importOperationId, exportOperationId, generateDeployPlan } from './testDacFxService';

let wizard: DataTierApplicationWizard;
let connectionProfileMock: azdata.connection.ConnectionProfile = new azdata.connection.ConnectionProfile();
connectionProfileMock.connectionId = 'TEST ID';
let dacfxServiceMock: DacFxTestService = new DacFxTestService();
let connectionMock: azdata.connection.Connection = {
	connectionId: 'TEST ID',
	providerName: 'MsSql',
	options: null,
};

describe('Dacfx wizard with connection', function (): void {
	beforeEach(async function (): Promise<void> {
		sinon.stub(azdata.connection, 'getConnections').returns(Promise.resolve([]));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(Promise.resolve('my test uri'));
		wizard = new DataTierApplicationWizard(dacfxServiceMock);
		wizard.model = <DacFxDataModel>{};
	});
	afterEach(function (): void {
		sinon.restore();
	});

	it('Should return false if connection is not present', async () => {
		sinon.stub(azdata.connection, 'getCurrentConnection').returns(Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'openConnectionDialog').returns(Promise.resolve(undefined));
		let profile = { connectionProfile: connectionProfileMock };

		const result = await wizard.start(profile);
		should(result).equal(false);
	});

	// [udgautam] Skipping this for now since it gives intermittent Error: write EPIPE error. Investigating...
	it.skip('Should return true if connection is present', async () => {
		sinon.stub(azdata.connection, 'getCurrentConnection').returns(Promise.resolve(connectionProfileMock));
		sinon.stub(azdata.connection, 'openConnectionDialog').returns(Promise.resolve(connectionMock));
		let profile = { connectionProfile: connectionProfileMock };

		const result = await wizard.start(profile);
		should(result).equal(true);
	});

	it('Should call all service methods correctly', async () => {
		wizard.model.server = connectionProfileMock;
		wizard.model.potentialDataLoss = true;
		wizard.model.upgradeExisting = true;

		const fileSizeStub = sinon.stub(utils, 'tryGetFileSize');
		fileSizeStub.resolves(TypeMoq.It.isAnyNumber());

		await validateServiceCalls(wizard, Operation.deploy, deployOperationId);
		await validateServiceCalls(wizard, Operation.extract, extractOperationId);
		await validateServiceCalls(wizard, Operation.import, importOperationId);
		await validateServiceCalls(wizard, Operation.export, exportOperationId);
	});

	it('executeOperation should show error message if deploy fails', async () => {
		let service = TypeMoq.Mock.ofInstance(new DacFxTestService());
		service.setup(x => x.deployDacpac(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(x => Promise.resolve({
			errorMessage: 'error1',
			success: false,
			operationId: ''
		}));

		let wizard = new DataTierApplicationWizard(service.object);
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = connectionProfileMock;
		wizard.model.potentialDataLoss = true;
		wizard.model.upgradeExisting = true;
		const fileSizeStub = sinon.stub(utils, 'tryGetFileSize');
		fileSizeStub.resolves(TypeMoq.It.isAnyNumber());
		let showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves();
		wizard.selectedOperation = Operation.deploy;
		await wizard.executeOperation();
		should(showErrorMessageStub.calledOnce).be.true();
		should.equal(showErrorMessageStub.getCall(0).args[0], loc.operationErrorMessage(loc.deploy, 'error1'));
	});

	it('executeOperation should show error message if export fails', async () => {
		let service = TypeMoq.Mock.ofInstance(new DacFxTestService());
		service.setup(x => x.exportBacpac(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(x => Promise.resolve({
			errorMessage: 'error1',
			success: false,
			operationId: ''
		}));

		let wizard = new DataTierApplicationWizard(service.object);
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = connectionProfileMock;
		const fileSizeStub = sinon.stub(utils, 'tryGetFileSize');
		fileSizeStub.resolves(TypeMoq.It.isAnyNumber());
		let showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves();
		wizard.selectedOperation = Operation.export;
		await wizard.executeOperation();
		should(showErrorMessageStub.calledOnce).be.true();
		should.equal(showErrorMessageStub.getCall(0).args[0], loc.operationErrorMessage(loc.exportText, 'error1'));
	});

	it('executeOperation should show error message if extract fails', async () => {
		let service = TypeMoq.Mock.ofInstance(new DacFxTestService());
		service.setup(x => x.extractDacpac(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(x => Promise.resolve({
			errorMessage: 'error1',
			success: false,
			operationId: ''
		}));

		let wizard = new DataTierApplicationWizard(service.object);
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = connectionProfileMock;
		const fileSizeStub = sinon.stub(utils, 'tryGetFileSize');
		fileSizeStub.resolves(TypeMoq.It.isAnyNumber());
		let showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves();
		wizard.selectedOperation = Operation.extract;
		await wizard.executeOperation();
		should(showErrorMessageStub.calledOnce).be.true();
		should.equal(showErrorMessageStub.getCall(0).args[0], loc.operationErrorMessage(loc.extract, 'error1'));
	});

	it('Should show error message if generateDeployScript fails', async () => {
		let service = TypeMoq.Mock.ofInstance(new DacFxTestService());
		service.setup(x => x.generateDeployScript(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(x => Promise.resolve({
			errorMessage: 'error1',
			success: false,
			operationId: ''
		}));

		let wizard = new DataTierApplicationWizard(service.object);
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = connectionProfileMock;
		wizard.model.potentialDataLoss = true;
		const fileSizeStub = sinon.stub(utils, 'tryGetFileSize');
		fileSizeStub.resolves(TypeMoq.It.isAnyNumber());
		let showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves();
		await wizard.generateDeployScript();
		should(showErrorMessageStub.calledOnce).be.true();
		should.equal(showErrorMessageStub.getCall(0).args[0], loc.generateDeployErrorMessage('error1'));
	});

	it('executeOperation should show error message if import fails', async () => {
		let service = TypeMoq.Mock.ofInstance(new DacFxTestService());
		service.setup(x => x.importBacpac(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(x => Promise.resolve({
			errorMessage: 'error1',
			success: false,
			operationId: ''
		}));

		let wizard = new DataTierApplicationWizard(service.object);
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = connectionProfileMock;
		const fileSizeStub = sinon.stub(utils, 'tryGetFileSize');
		fileSizeStub.resolves(TypeMoq.It.isAnyNumber());
		let showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves();
		wizard.selectedOperation = Operation.import;
		await wizard.executeOperation();
		should(showErrorMessageStub.calledOnce).be.true();
		should.equal(showErrorMessageStub.getCall(0).args[0], loc.operationErrorMessage(loc.importText, 'error1'));
	});

	it('Should call deploy plan generator correctly', async () => {
		wizard.model.server = connectionProfileMock;

		const report = await wizard.generateDeployPlan();
		should(report).equal(generateDeployPlan);
	});

	async function validateServiceCalls(wizard: DataTierApplicationWizard, selectedOperation: Operation, expectedOperationId: string): Promise<void> {
		wizard.selectedOperation = selectedOperation;
		let result = await wizard.executeOperation();
		should(result.success).equal(true);
		should(result.operationId).equal(expectedOperationId);
	}
});
