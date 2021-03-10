/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PGResourceInfo, ResourceType } from 'arc';
import * as azdataExt from 'azdata-ext';
import * as azdata from 'azdata';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { UserCancelledError } from '../../common/api';
import { ControllerModel, Registration } from '../../models/controllerModel';
import { PostgresModel, EngineSettingsModel } from '../../models/postgresModel';
import { ConnectToPGSqlDialog } from '../../ui/dialogs/connectPGDialog';
import { AzureArcTreeDataProvider } from '../../ui/tree/azureArcTreeDataProvider';
import { FakeControllerModel } from '../mocks/fakeControllerModel';
import { FakeAzdataApi } from '../mocks/fakeAzdataApi';
import { FakePostgresServerShowResult } from '../mocks/fakePostgresServerShowResult';
import { assert } from 'sinon';

describe('PostgresModel', function (): void {
	let controllerModel: ControllerModel;
	let postgresModel: PostgresModel;
	let azdataApi: azdataExt.IAzdataApi;

	afterEach(function (): void {
		sinon.restore();
	});

	beforeEach(async () => {
		// Setup Controller Model
		controllerModel = new FakeControllerModel();

		//Stub calling azdata login and acquiring session
		sinon.stub(controllerModel, 'acquireAzdataSession').returns(Promise.resolve(vscode.Disposable.from()));

		// Stub the azdata CLI API
		azdataApi = new FakeAzdataApi();
		const azdataExt = TypeMoq.Mock.ofType<azdataExt.IExtension>();
		azdataExt.setup(x => x.azdata).returns(() => azdataApi);
		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExt.object });
	});

	describe('refresh', function (): void {

		beforeEach(async () => {
			// Setup PostgresModel
			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '' };
			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
			postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));
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

	describe('getConnectionProfile', function (): void {

		beforeEach(async () => {
			// Setup PostgresModel
			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '', userName: 'postgres', connectionId: '12345678' };
			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
			postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));

			//Stub calling refresh postgres model
			const result = new FakePostgresServerShowResult();
			const postgresShow = sinon.stub().returns(result);
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
			});

			//Call to provide external endpoint
			await postgresModel.refresh();
		});

		it('Rejected with expected error when user cancels', async function (): Promise<void> {
			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(undefined));
			await should(postgresModel['getConnectionProfile']()).be.rejectedWith(new UserCancelledError());
			sinon.assert.calledOnce(close);
		});

		it('Show dialog prompt if password not found', async function (): Promise<void> {
			const connect = sinon.stub(azdata.connection, 'connect');
			const show = sinon.stub(ConnectToPGSqlDialog.prototype, 'showDialog');

			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

			await postgresModel['getConnectionProfile']();
			sinon.assert.notCalled(connect);
			sinon.assert.calledOnce(show);
			sinon.assert.calledOnce(close);
		});

		it('Reads password from cred store and no dialog prompt', async function (): Promise<void> {
			const password = 'password123';
			// Set up cred store to return our password
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => true);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			const show = sinon.stub(ConnectToPGSqlDialog.prototype, 'showDialog');
			const treeSave = sinon.stub(AzureArcTreeDataProvider.prototype, 'saveControllers');

			await postgresModel['getConnectionProfile']();
			sinon.assert.calledOnce(connect);
			sinon.assert.notCalled(show);
			sinon.assert.calledOnce(treeSave);
		});

		it('Reads password from cred store and connect fails, show dialog prompt', async function (): Promise<void> {
			const password = 'password123';
			// Set up cred store to return our password
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => false);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

			const show = sinon.stub(ConnectToPGSqlDialog.prototype, 'showDialog');

			await postgresModel['getConnectionProfile']();
			sinon.assert.calledOnce(connect);
			sinon.assert.calledOnce(show);
			sinon.assert.calledOnce(close);
		});

		it('Show dialog prompt if username not found', async function (): Promise<void> {
			// Setup PostgresModel without username
			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '', connectionId: '12345678' };
			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
			let postgresModelNew = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));
			await postgresModelNew.refresh();

			const password = 'password123';
			// Set up cred store to return our password
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const connect = sinon.stub(azdata.connection, 'connect');
			const show = sinon.stub(ConnectToPGSqlDialog.prototype, 'showDialog');

			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

			await postgresModelNew['getConnectionProfile']();
			sinon.assert.notCalled(connect);
			sinon.assert.calledOnce(show);
			sinon.assert.calledOnce(close);
		});

		it('Shows dialog prompt if no connection id', async function (): Promise<void> {
			// Setup PostgresModel without connectionId
			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '' };
			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
			let postgresModelNew = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));
			await postgresModelNew.refresh();

			const provider = sinon.stub(azdata.credentials, 'getProvider');
			const connect = sinon.stub(azdata.connection, 'connect');
			const show = sinon.stub(ConnectToPGSqlDialog.prototype, 'showDialog');

			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

			await postgresModelNew['getConnectionProfile']();
			sinon.assert.notCalled(provider);
			sinon.assert.notCalled(connect);
			sinon.assert.calledOnce(show);
			sinon.assert.calledOnce(close);
		});
	});

	describe('getEngineSettings', function (): void {

		beforeEach(async () => {
			// Setup PostgresModel
			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '', userName: 'postgres', connectionId: '12345678' };
			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
			postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));

			//Stub calling refresh postgres model
			const result = new FakePostgresServerShowResult();
			const postgresShow = sinon.stub().returns(result);
			sinon.stub(azdataApi, 'arc').get(() => {
				return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
			});

			//Stub how to get connection profile
			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));
			sinon.stub(ConnectToPGSqlDialog.prototype, 'showDialog');

			sinon.stub(azdata.connection, 'getUriForConnection');

			//Call to provide external endpoint
			await postgresModel.refresh();
		});

		it('Throw error when trying to connect fails', async function (): Promise<void> {
			const errorMessage = 'Mock connection fail occured';
			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => false);
			connectionResultMock.setup(x => x.errorMessage).returns(() => errorMessage);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			await should(postgresModel.getEngineSettings()).be.rejectedWith(new Error(errorMessage));
			sinon.assert.calledOnce(connect);
		});

		it('Update active connection id when connect passes', async function (): Promise<void> {
			const connectionID = '098765';
			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => true);
			connectionResultMock.setup(x => x.connectionId).returns(() => connectionID);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			const array: azdata.DbCellValue[][] = [];

			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
			executeMock.setup(x => x.rows).returns(() => array);
			executeMock.setup((x: any) => x.then).returns(() => undefined);

			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
			providerMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

			await postgresModel.getEngineSettings();
			sinon.assert.calledOnce(connect);
			sinon.assert.match(postgresModel['_activeConnectionId'], connectionID);
		});

		it('Updates engineSettingsLastUpdated after populating engine settings', async function (): Promise<void> {
			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => true);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			const array: azdata.DbCellValue[][] = [];

			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
			executeMock.setup(x => x.rows).returns(() => array);
			executeMock.setup((x: any) => x.then).returns(() => undefined);

			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
			providerMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

			await postgresModel.getEngineSettings();
			should(postgresModel.engineSettingsLastUpdated).be.Date();
		});

		it('Calls onEngineSettingsUpdated event after populating engine settings', async function (): Promise<void> {
			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => true);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			const array: azdata.DbCellValue[][] = [];

			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
			executeMock.setup(x => x.rows).returns(() => array);
			executeMock.setup((x: any) => x.then).returns(() => undefined);

			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
			providerMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

			const onEngineSettingsUpdated = sinon.stub(vscode.EventEmitter.prototype, 'fire');

			await postgresModel.getEngineSettings();
			sinon.assert.calledOnceWithExactly(onEngineSettingsUpdated, postgresModel.workerNodesEngineSettings);
		});

		it('Populating ngine settings skips certain parameters', async function (): Promise<void> {
			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => true);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			const rows: azdata.DbCellValue[][] = [
				[{
					displayValue: 'archive_timeout',
					isNull: false,
					invariantCultureDisplayValue: ''
				}]
			];

			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
			executeMock.setup(x => x.rows).returns(() => rows);
			executeMock.setup((x: any) => x.then).returns(() => undefined);

			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
			providerMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

			await postgresModel.getEngineSettings();
			should(postgresModel.workerNodesEngineSettings.pop()).be.undefined();
		});

		it('Populates engine settings accurately', async function (): Promise<void> {
			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			connectionResultMock.setup(x => x.connected).returns(() => true);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

			const rows: azdata.DbCellValue[][] = [
				[{
					displayValue: 'test0',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'test1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'test2',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'test3',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'test4',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'test5',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'test6',
					isNull: false,
					invariantCultureDisplayValue: ''
				}],
			];

			const engineSettingsModelCompare: EngineSettingsModel = {
				parameterName: 'test0',
				value: 'test1',
				description: 'test2',
				min: 'test3',
				max: 'test4',
				options: 'test5',
				type: 'test6'
			};

			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
			executeMock.setup(x => x.rows).returns(() => rows);
			executeMock.setup((x: any) => x.then).returns(() => undefined);

			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
			providerMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

			await postgresModel.getEngineSettings();
			should(postgresModel.workerNodesEngineSettings.pop()).be.match(engineSettingsModelCompare);
		});

	});

});
