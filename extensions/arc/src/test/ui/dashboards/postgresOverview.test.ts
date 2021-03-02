/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as azdataExt from 'azdata-ext';
import * as utils from '../../../common/utils';
import { Deferred } from '../../../common/promise';
import { createModelViewMock } from '@microsoft/azdata-test/out/mocks/modelView/modelViewMock';
import { StubButton } from '@microsoft/azdata-test/out/stubs/modelView/stubButton';
import { PGResourceInfo, ResourceType } from 'arc';
import { PostgresOverviewPage } from '../../../ui/dashboards/postgres/postgresOverviewPage';
import { AzureArcTreeDataProvider } from '../../../ui/tree/azureArcTreeDataProvider';
import { FakeControllerModel } from '../../mocks/fakeControllerModel';
import { FakeAzdataApi } from '../../mocks/fakeAzdataApi';
import { PostgresModel } from '../../../models/postgresModel';
import { ControllerModel, Registration } from '../../../models/controllerModel';

describe('postgresOverviewPage', () => {
	let postgresOverview: PostgresOverviewPage;
	let azdataApi: azdataExt.IAzdataApi;
	let controllerModel: ControllerModel;
	let postgresModel: PostgresModel;

	let showInformationMessage: sinon.SinonSpy;
	let showErrorMessage: sinon.SinonSpy;

	let informationMessageShown: Deferred;
	let errorMessageShown: Deferred;

	beforeEach(async () => {
		// Stub the azdata CLI API
		azdataApi = new FakeAzdataApi();
		const azdataExt = TypeMoq.Mock.ofType<azdataExt.IExtension>();
		azdataExt.setup(x => x.azdata).returns(() => azdataApi);
		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExt.object });

		// Stub the window UI
		informationMessageShown = new Deferred();
		showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage').callsFake(
			(_: string, __: vscode.MessageOptions, ...___: vscode.MessageItem[]) => {
				informationMessageShown.resolve();
				return Promise.resolve(undefined);
			});

		errorMessageShown = new Deferred();
		showErrorMessage = sinon.stub(vscode.window, 'showErrorMessage').callsFake(
			(_: string, __: vscode.MessageOptions, ...___: vscode.MessageItem[]) => {
				errorMessageShown.resolve();
				return Promise.resolve(undefined);
			});

		// Setup the PostgresModel
		controllerModel = new FakeControllerModel();
		const postgresResource: PGResourceInfo = { name: 'my-pg', resourceType: '' }
		const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances }
		const treeDataProvider = new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object);
		postgresModel = new PostgresModel(controllerModel, postgresResource, registration, treeDataProvider);

		// Setup the PostgresOverviewPage
		const { modelViewMock } = createModelViewMock();
		postgresOverview = new PostgresOverviewPage(modelViewMock.object, controllerModel, postgresModel);
		postgresOverview['toolbarContainer'];
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('delete button', () => {
		let refreshTreeNode: sinon.SinonStub;

		beforeEach(() => {
			sinon.stub(utils, 'promptForInstanceDeletion').returns(Promise.resolve(true));
			sinon.stub(controllerModel, 'acquireAzdataSession').returns(Promise.resolve(vscode.Disposable.from()));
			refreshTreeNode = sinon.stub(controllerModel, 'refreshTreeNode');
		});

		it('deletes Postgres on success', async () => {
			// Stub 'azdata arc postgres server delete' to return success
			const postgresDelete = sinon.stub();
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { delete(name: string) { return postgresDelete(name); } } } };
			});

			(postgresOverview['deleteButton'] as StubButton).click();
			await informationMessageShown;
			sinon.assert.calledOnceWithExactly(postgresDelete, postgresModel.info.name);
			sinon.assert.calledOnceWithExactly(showInformationMessage, `Instance '${postgresModel.info.name}' deleted`);
			sinon.assert.notCalled(showErrorMessage);
			sinon.assert.calledOnce(refreshTreeNode);
		});

		it('shows an error message on failure', async () => {
			// Stub 'azdata arc postgres server delete' to throw an exception
			const error = new Error("something bad happened");
			const postgresDelete = sinon.stub().throws(error);
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { delete(name: string) { return postgresDelete(name); } } } };
			});

			(postgresOverview['deleteButton'] as StubButton).click();
			await errorMessageShown;
			sinon.assert.calledOnceWithExactly(postgresDelete, postgresModel.info.name);
			sinon.assert.notCalled(showInformationMessage);
			sinon.assert.calledOnceWithExactly(showErrorMessage, `Failed to delete instance ${postgresModel.info.name}. ${error.message}`);
			sinon.assert.notCalled(refreshTreeNode);
		});
	});
});
