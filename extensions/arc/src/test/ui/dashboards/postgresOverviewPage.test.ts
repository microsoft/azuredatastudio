/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as vscode from 'vscode';
// import * as sinon from 'sinon';
// import * as TypeMoq from 'typemoq';
// import * as azExt from 'azdata-ext';
// import * as utils from '../../../common/utils';
// import * as loc from '../../../localizedConstants';
// import { Deferred } from '../../../common/promise';
// import { createModelViewMock } from '@microsoft/azdata-test/out/mocks/modelView/modelViewMock';
// import { StubButton } from '@microsoft/azdata-test/out/stubs/modelView/stubButton';
// import { PGResourceInfo, ResourceType } from 'arc';
// import { PostgresOverviewPage } from '../../../ui/dashboards/postgres/postgresOverviewPage';
// import { AzureArcTreeDataProvider } from '../../../ui/tree/azureArcTreeDataProvider';
// import { FakeControllerModel } from '../../mocks/fakeControllerModel';
// import { FakeAzApi } from '../../mocks/fakeAzdataApi';
// import { PostgresModel } from '../../../models/postgresModel';
// import { ControllerModel, Registration } from '../../../models/controllerModel';

// describe('postgresOverviewPage', () => {
// 	let postgresOverview: PostgresOverviewPage;
// 	let azdataApi: azExt.IAzdataApi;
// 	let controllerModel: ControllerModel;
// 	let postgresModel: PostgresModel;

// 	let showInformationMessage: sinon.SinonStub;
// 	let showErrorMessage: sinon.SinonStub;

// 	let informationMessageShown: Deferred;
// 	let errorMessageShown: Deferred;

// 	beforeEach(async () => {
// 		// Stub the azdata CLI API
// 		azdataApi = new FakeAzdataApi();
// 		const azExt = TypeMoq.Mock.ofType<azExt.IExtension>();
// 		azExt.setup(x => x.azdata).returns(() => azdataApi);
// 		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExt.object });

// 		// Stub the window UI
// 		informationMessageShown = new Deferred();
// 		showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage').callsFake(
// 			(_: string, __: vscode.MessageOptions, ...___: vscode.MessageItem[]) => {
// 				informationMessageShown.resolve();
// 				return Promise.resolve(undefined);
// 			});

// 		errorMessageShown = new Deferred();
// 		showErrorMessage = sinon.stub(vscode.window, 'showErrorMessage').callsFake(
// 			(_: string, __: vscode.MessageOptions, ...___: vscode.MessageItem[]) => {
// 				errorMessageShown.resolve();
// 				return Promise.resolve(undefined);
// 			});

// 		// Setup the PostgresModel
// 		controllerModel = new FakeControllerModel();
// 		const postgresResource: PGResourceInfo = { name: 'my-pg', resourceType: '' };
// 		const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
// 		const treeDataProvider = new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object);
// 		postgresModel = new PostgresModel(controllerModel, postgresResource, registration, treeDataProvider);

// 		// Setup the PostgresOverviewPage
// 		const { modelViewMock } = createModelViewMock();
// 		postgresOverview = new PostgresOverviewPage(modelViewMock.object, undefined!, controllerModel, postgresModel);
// 		// Call the getter to initialize toolbar, but we don't need to use it for anything
// 		// eslint-disable-next-line code-no-unused-expressions
// 		postgresOverview['toolbarContainer'];
// 	});

// 	afterEach(() => {
// 		sinon.restore();
// 	});

// 	describe('delete button', () => {
// 		let refreshTreeNode: sinon.SinonStub;

// 		beforeEach(() => {
// 			sinon.stub(utils, 'promptForInstanceDeletion').returns(Promise.resolve(true));
// 			refreshTreeNode = sinon.stub(controllerModel, 'refreshTreeNode');
// 		});

// 		it('deletes Postgres on success', async () => {
// 			// Stub 'azdata arc postgres server delete' to return success
// 			const postgresDeleteStub = sinon.stub(azdataApi.arc.postgres.server, 'delete');

// 			(postgresOverview['deleteButton'] as StubButton).click();
// 			await informationMessageShown;
// 			sinon.assert.calledOnceWithExactly(postgresDeleteStub, postgresModel.info.name, sinon.match.any, sinon.match.any);
// 			sinon.assert.calledOnceWithExactly(showInformationMessage, loc.instanceDeleted(postgresModel.info.name));
// 			sinon.assert.notCalled(showErrorMessage);
// 			sinon.assert.calledOnce(refreshTreeNode);
// 		});

// 		it('shows an error message on failure', async () => {
// 			// Stub 'azdata arc postgres server delete' to throw an exception
// 			const error = new Error('something bad happened');
// 			const postgresDeleteStub = sinon.stub(azdataApi.arc.postgres.server, 'delete').throws(error);

// 			(postgresOverview['deleteButton'] as StubButton).click();
// 			await errorMessageShown;
// 			sinon.assert.calledOnceWithExactly(postgresDeleteStub, postgresModel.info.name, sinon.match.any, sinon.match.any);
// 			sinon.assert.notCalled(showInformationMessage);
// 			sinon.assert.calledOnceWithExactly(showErrorMessage, loc.instanceDeletionFailed(postgresModel.info.name, error.message));
// 			sinon.assert.notCalled(refreshTreeNode);
// 		});
// 	});
// });
