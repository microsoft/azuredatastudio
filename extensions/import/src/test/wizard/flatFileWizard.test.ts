/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { ApiWrapper } from '../../common/apiWrapper';
import { FlatFileWizard } from '../../wizard/flatFileWizard';
import { ImportTestUtils, TestWizard, TestWizardPage, TestButton } from '../utils.test';
import * as should from 'should';

describe('import extension flat file wizard', function () {
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	this.beforeEach(function () {
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
	});
	it('opens connectionDialog when there are no active connections', async function () {
		let testConnection: azdata.connection.Connection = {
			providerName: 'MSSQL',
			connectionId: 'testConnectionId',
			options: {}
		};

		// There is no current connection.
		mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return undefined; });


		// openConnectionDialog returns a test connection
		mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(async () => { return testConnection; });

		let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

		await testFlatFileWizard.getConnectionId();

		// openConnectionDialog will be called once
		mockApiWrapper.verify(x => x.openConnectionDialog(TypeMoq.It.isAny()), TypeMoq.Times.once());

	});

	it('shows error message when an invalid connection is selected', async function () {
		// The active connection doesn't have a valid Provider
		let testConnectionProfile: azdata.connection.ConnectionProfile = ImportTestUtils.getTestConnectionProfile();
		mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(testConnectionProfile); });
		mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(() => { return undefined; });

		let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

		await testFlatFileWizard.getConnectionId();

		mockApiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());

	});

	it('shows error message when no connection is selected', async function () {
		// The active connection doesn't have a valid Provider
		mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return undefined; });
		mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(() => { return undefined; });

		let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

		await testFlatFileWizard.getConnectionId();

		mockApiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());

	});

	it('getConnection returns active connection', async function () {
		let testConnectionProfile = ImportTestUtils.getTestConnectionProfile();
		testConnectionProfile.providerId = 'MSSQL';

		//mocking an active connection
		mockApiWrapper.setup(x => x.getCurrentConnection()).returns(async () => { return testConnectionProfile; })

		let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

		//getConnectionID should return the connectionId of active connection
		let connectionId = await testFlatFileWizard.getConnectionId();
		should(connectionId).equals(testConnectionProfile.connectionId);
	});

	it('should initialize all pages', async function () {
		let testConnectionProfile = ImportTestUtils.getTestConnectionProfile();
		testConnectionProfile.providerId = 'MSSQL';
		mockApiWrapper.setup(x => x.getCurrentConnection()).returns(async () => { return testConnectionProfile; });
		let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
		let mockWizard = TypeMoq.Mock.ofType(TestWizard);
		let mockWizardPage = TypeMoq.Mock.ofType(TestWizardPage);
		let mockButton = TypeMoq.Mock.ofType(TestButton, TypeMoq.MockBehavior.Loose, undefined, onClick);

		let testProvider = {
			providerId: 'testProviderId',
			connectionProfile: ImportTestUtils.getTestConnectionProfile()
		};

		// Mocking wizard component creation
		mockApiWrapper.setup(x => x.createWizard(TypeMoq.It.isAnyString())).returns(() => { return mockWizard.object; });
		mockApiWrapper.setup(x => x.createWizardPage(TypeMoq.It.isAnyString())).returns(() => { return mockWizardPage.object; });
		mockApiWrapper.setup(x => x.createButton(TypeMoq.It.isAnyString())).returns(() => { return mockButton.object; });

		let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

		await testFlatFileWizard.start(testProvider);

		// asserting all wizard pages are getting created
		should.notEqual(testFlatFileWizard.wizard, undefined);
		should.notEqual(testFlatFileWizard.page1, undefined);
		should.notEqual(testFlatFileWizard.page2, undefined);
		should.notEqual(testFlatFileWizard.page3, undefined);
		should.notEqual(testFlatFileWizard.page4, undefined);

		let expectedPages = [
			testFlatFileWizard.page1,
			testFlatFileWizard.page2,
			testFlatFileWizard.page3,
			testFlatFileWizard.page4
		];
		should.deepEqual(testFlatFileWizard.wizard.pages, expectedPages);

	});
});
