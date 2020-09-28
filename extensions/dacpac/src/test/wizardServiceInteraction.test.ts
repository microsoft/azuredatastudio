/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as azdata from 'azdata';
import * as should from 'should';
import * as sinon from 'sinon';
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

		await validateServiceCalls(wizard, Operation.deploy, deployOperationId);
		await validateServiceCalls(wizard, Operation.extract, extractOperationId);
		await validateServiceCalls(wizard, Operation.import, importOperationId);
		await validateServiceCalls(wizard, Operation.export, exportOperationId);
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
