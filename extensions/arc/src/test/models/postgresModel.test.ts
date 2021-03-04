/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PGResourceInfo, ResourceType } from 'arc';
import * as azdataExt from 'azdata-ext';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
//import { v4 as uuid } from 'uuid';
import * as vscode from 'vscode';
//import * as loc from '../../localizedConstants';
//import * as kubeUtils from '../../common/kubeUtils';
//import { UserCancelledError } from '../../common/api';
import { ControllerModel, Registration } from '../../models/controllerModel';
import { PostgresModel } from '../../models/postgresModel';
//import { ConnectToControllerDialog } from '../../ui/dialogs/connectControllerDialog';
import { AzureArcTreeDataProvider } from '../../ui/tree/azureArcTreeDataProvider';
import { FakeControllerModel } from '../mocks/fakeControllerModel';
import { FakeAzdataApi } from '../mocks/fakeAzdataApi';
import { FakePostgresServerShowResult } from '../mocks/fakePostgresServerShowResult';
import { assert } from 'sinon';
//import * as utils from '../../common/utils';

describe('PostgresModel', function (): void {
	let controllerModel: ControllerModel;
	let postgresModel: PostgresModel;
	let azdataApi: azdataExt.IAzdataApi;

	afterEach(function (): void {
		sinon.restore();
	});

	beforeEach(async () => {
		// Stub the azdata CLI API
		azdataApi = new FakeAzdataApi();
		const azdataExt = TypeMoq.Mock.ofType<azdataExt.IExtension>();
		azdataExt.setup(x => x.azdata).returns(() => azdataApi);
		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExt.object });

		// Setup PostgresModel
		const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '' };
		const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
		controllerModel = new FakeControllerModel();
		postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));
	});

	describe('refresh', function (): void {

		beforeEach(async () => {
			//Stub calling azdata login and acquiring session
			sinon.stub(controllerModel, 'acquireAzdataSession').returns(Promise.resolve(vscode.Disposable.from()));
		});

		it('Updates model to expected config', async function (): Promise<void> {
			const result = new FakePostgresServerShowResult();
			const postgresShow = sinon.stub().returns(result);
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
			});

			await postgresModel.refresh();
			sinon.assert.calledOnceWithExactly(postgresShow, postgresModel.info.name);
			assert.match(postgresModel.config, result.result);
		});

		it('Updates onConfigLastUpdated when model is refreshed', async function (): Promise<void> {
			const result = new FakePostgresServerShowResult();
			const postgresShow = sinon.stub().returns(result);
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
			});

			await postgresModel.refresh();
			sinon.assert.calledOnceWithExactly(postgresShow, postgresModel.info.name);
			should(postgresModel.configLastUpdated).be.Date();
		});

		it('Calls onConfigUpdated event when model is refreshed', async function (): Promise<void> {
			const result = new FakePostgresServerShowResult();
			const postgresShow = sinon.stub().returns(result);
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
			});
			const configUpdatedEvent = sinon.stub(vscode.EventEmitter.prototype, 'fire');

			await postgresModel.refresh();
			sinon.assert.calledOnceWithExactly(postgresShow, postgresModel.info.name);
			sinon.assert.calledOnceWithExactly(configUpdatedEvent, postgresModel.config);
		});

		it('Expected exception is thrown', async function (): Promise<void> {
			// Stub 'azdata arc postgres server show' to throw an exception
			const error = new Error("something bad happened");
			const postgresShow = sinon.stub().throws(error);
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
			});

			await should(postgresModel.refresh()).be.rejectedWith(error);
		});


	});

});
