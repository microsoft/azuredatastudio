// /*---------------------------------------------------------------------------------------------
//  *  Copyright (c) Microsoft Corporation. All rights reserved.
//  *  Licensed under the Source EULA. See License.txt in the project root for license information.
//  *--------------------------------------------------------------------------------------------*/

// import { PGResourceInfo, ResourceType } from 'arc';
// import * as azExt from 'azdata-ext';
// import * as should from 'should';
// import * as sinon from 'sinon';
// import * as TypeMoq from 'typemoq';
// import * as vscode from 'vscode';
// import { createModelViewMock } from '@microsoft/azdata-test/out/mocks/modelView/modelViewMock';
// import { ControllerModel, Registration } from '../../../models/controllerModel';
// import { PostgresModel } from '../../../models/postgresModel';
// import { PostgresConnectionStringsPage } from '../../../ui/dashboards/postgres/postgresConnectionStringsPage';
// import { AzureArcTreeDataProvider } from '../../../ui/tree/azureArcTreeDataProvider';
// import { FakeControllerModel } from '../../mocks/fakeControllerModel';
// import { FakeAzdataApi } from '../../mocks/fakeAzdataApi';
// import { FakePostgresServerShowOutput } from '../../models/postgresModel.test';

// describe('postgresConnectionStringsPage', function (): void {
// 	let controllerModel: ControllerModel;
// 	let postgresModel: PostgresModel;
// 	let azdataApi: azExt.IAzdataApi;
// 	let postgresConnectionStrings: PostgresConnectionStringsPage;

// 	afterEach(function (): void {
// 		sinon.restore();
// 	});

// 	beforeEach(async () => {
// 		// Stub the azdata CLI API
// 		azdataApi = new FakeAzdataApi();
// 		const azExt = TypeMoq.Mock.ofType<azExt.IExtension>();
// 		azExt.setup(x => x.azdata).returns(() => azdataApi);
// 		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExt.object });

// 		// Setup Controller Model
// 		controllerModel = new FakeControllerModel();

// 		// Setup PostgresModel
// 		const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '' };
// 		const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
// 		postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));

// 		// Setup stub of show call
// 		const postgresShow = sinon.stub().returns(FakePostgresServerShowOutput);
// 		sinon.stub(azdataApi, 'arc').get(() => {
// 			return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
// 		});

// 		// Setup the PostgresConnectionsStringsPage
// 		let { modelViewMock } = createModelViewMock();
// 		postgresConnectionStrings = new PostgresConnectionStringsPage(modelViewMock.object, undefined!, postgresModel);
// 	});

// 	describe('getConnectionStrings', function (): void {

// 		it('Strings container should be empty since postgres model has not been refreshed', async function (): Promise<void> {
// 			should(postgresConnectionStrings['getConnectionStrings']()).be.empty();
// 		});

// 		it('String contain correct ip and port', async function (): Promise<void> {
// 			// Call to provide external endpoint
// 			await postgresModel.refresh();

// 			let endpoint = FakePostgresServerShowOutput.result.status.primaryEndpoint.split(':');

// 			postgresConnectionStrings['getConnectionStrings']().forEach(k => {
// 				should(k.value.includes(endpoint[0])).be.True();
// 				should(k.value.includes(endpoint[1])).be.True();
// 			});
// 		});

// 	});

// });
