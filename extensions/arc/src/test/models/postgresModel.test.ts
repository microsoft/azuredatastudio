/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import { PGResourceInfo, ResourceType } from 'arc';
// import * as azExt from 'azdata-ext';
// import * as azdata from 'azdata';
// import * as should from 'should';
// import * as sinon from 'sinon';
// import * as TypeMoq from 'typemoq';
// import * as vscode from 'vscode';
// import { generateGuid } from '../../common/utils';
// import { UserCancelledError } from '../../common/api';
// import { ControllerModel, Registration } from '../../models/controllerModel';
// import { PostgresModel, EngineSettingsModel } from '../../models/postgresModel';
// import { ConnectToPGSqlDialog } from '../../ui/dialogs/connectPGDialog';
// import { AzureArcTreeDataProvider } from '../../ui/tree/azureArcTreeDataProvider';
// import { FakeControllerModel } from '../mocks/fakeControllerModel';
// import { FakeAzdataApi } from '../mocks/fakeAzdataApi';

// export const FakeStorageVolume:  azExt.StorageVolume[] = [{
// 	className: '',
// 	size: ''
// }];

// export const FakePostgresServerShowOutput: azExt.AzdataOutput<azExt.PostgresServerShowResult> = {
// 	logs: [],
// 	stdout: [],
// 	stderr: [],
// 	result: {
// 		apiVersion: 'version',
// 		kind: 'postgresql',
// 		metadata: {
// 			creationTimestamp: '',
// 			generation: 1,
// 			name: 'pgt',
// 			namespace: 'ns',
// 			resourceVersion: '',
// 			selfLink: '',
// 			uid: '',
// 		},
// 		spec: {
// 			engine: {
// 				extensions: [{ name: '' }],
// 				settings: {
// 					default: { ['']: '' },
// 					roles: {
// 						coordinator: { ['']: '' },
// 						worker: { ['']: '' }
// 					}
// 				},
// 				version: ''
// 			},
// 			scale: {
// 				shards: 0,
// 				workers: 0
// 			},
// 			scheduling: {
// 				default: {
// 					resources: {
// 						requests: {
// 							cpu: '',
// 							memory: ''
// 						},
// 						limits: {
// 							cpu: '',
// 							memory: ''
// 						}
// 					}
// 				},
// 				roles: {
// 					coordinator: {
// 						resources: {
// 							requests: {
// 								cpu: '',
// 								memory: ''
// 							},
// 							limits: {
// 								cpu: '',
// 								memory: ''
// 							}
// 						}
// 					},
// 					worker: {
// 						resources: {
// 							requests: {
// 								cpu: '',
// 								memory: ''
// 							},
// 							limits: {
// 								cpu: '',
// 								memory: ''
// 							}
// 						}
// 					}
// 				}
// 			},
// 			services: {
// 				primary: {
// 					type: '',
// 					port: 0
// 				}
// 			},
// 			storage: {
// 				data: {
// 					volumes: [
// 						{
// 							className: '',
// 							size: ''
// 						}
// 					]
// 				},
// 				logs: {
// 					volumes: [
// 						{
// 							className: '',
// 							size: ''
// 						}
// 					]
// 				},
// 				backups: {
// 					volumes: [
// 						{
// 							className: '',
// 							size: ''
// 						}
// 					]
// 				}
// 			}
// 		},
// 		status: {
// 			primaryEndpoint: '127.0.0.1:5432',
// 			readyPods: '',
// 			state: '',
// 			logSearchDashboard: '',
// 			metricsDashboard: '',
// 			podsStatus: [{
// 				conditions: [{
// 					lastTransitionTime: '',
// 					message: '',
// 					reason: '',
// 					status: '',
// 					type: '',
// 				}],
// 				name: '',
// 				role: '',
// 			}]
// 		}
// 	}
// };

// describe('PostgresModel', function (): void {
// 	let controllerModel: ControllerModel;
// 	let postgresModel: PostgresModel;
// 	let azdataApi: azExt.IAzdataApi;

// 	afterEach(function (): void {
// 		sinon.restore();
// 	});

// 	beforeEach(async () => {
// 		// Setup Controller Model
// 		controllerModel = new FakeControllerModel();

// 		//Stub calling azdata login and acquiring session
// 		sinon.stub(controllerModel, 'login').returns(Promise.resolve());

// 		// Stub the azdata CLI API
// 		azdataApi = new FakeAzdataApi();
// 		const azExt = TypeMoq.Mock.ofType<azExt.IExtension>();
// 		azExt.setup(x => x.azdata).returns(() => azdataApi);
// 		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExt.object });
// 	});

// 	describe('refresh', function (): void {

// 		beforeEach(async () => {
// 			// Setup PostgresModel
// 			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '' };
// 			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
// 			postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));
// 		});

// 		it('Updates model to expected config', async function (): Promise<void> {
// 			const postgresShowStub = sinon.stub(azdataApi.arc.postgres.server, 'show').resolves(FakePostgresServerShowOutput);

// 			await postgresModel.refresh();
// 			sinon.assert.calledOnceWithExactly(postgresShowStub, postgresModel.info.name, sinon.match.any, sinon.match.any);
// 			sinon.assert.match(postgresModel.config, FakePostgresServerShowOutput.result);
// 		});

// 		it('Updates onConfigLastUpdated when model is refreshed', async function (): Promise<void> {
// 			const postgresShowStub = sinon.stub(azdataApi.arc.postgres.server, 'show').resolves(FakePostgresServerShowOutput);

// 			await postgresModel.refresh();
// 			sinon.assert.calledOnceWithExactly(postgresShowStub, postgresModel.info.name, sinon.match.any, sinon.match.any);
// 			should(postgresModel.configLastUpdated).be.Date();
// 		});

// 		it('Calls onConfigUpdated event when model is refreshed', async function (): Promise<void> {
// 			const postgresShowStub = sinon.stub(azdataApi.arc.postgres.server, 'show').resolves(FakePostgresServerShowOutput);
// 			const configUpdatedEvent = sinon.spy(vscode.EventEmitter.prototype, 'fire');

// 			await postgresModel.refresh();
// 			sinon.assert.calledOnceWithExactly(postgresShowStub, postgresModel.info.name, sinon.match.any, sinon.match.any);
// 			sinon.assert.calledOnceWithExactly(configUpdatedEvent, postgresModel.config);
// 		});

// 		it('Expected exception is thrown', async function (): Promise<void> {
// 			// Stub 'azdata arc postgres server show' to throw an exception
// 			const error = new Error('something bad happened');
// 			sinon.stub(azdataApi.arc.postgres.server, 'show').throws(error);

// 			await should(postgresModel.refresh()).be.rejectedWith(error);
// 		});
// 	});

// 	describe('getConnectionProfile', function (): void {

// 		beforeEach(async () => {
// 			// Setup PostgresModel
// 			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '', userName: 'postgres', connectionId: '12345678' };
// 			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
// 			postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));

// 			sinon.stub(azdataApi.arc.postgres.server, 'show').resolves(FakePostgresServerShowOutput);

// 			//Call to provide external endpoint
// 			await postgresModel.refresh();
// 		});

// 		it('Rejected with expected error when user cancels', async function (): Promise<void> {
// 			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(undefined));
// 			await should(postgresModel['getConnectionProfile']()).be.rejectedWith(new UserCancelledError());
// 			sinon.assert.calledOnce(close);
// 		});

// 		it('Show dialog prompt if password not found', async function (): Promise<void> {
// 			const connect = sinon.stub(azdata.connection, 'connect');

// 			const cancelButtonMock = TypeMoq.Mock.ofType<azdata.window.Button>();
// 			cancelButtonMock.setup((x: any) => x.then).returns(() => undefined);

// 			const dialogMock = TypeMoq.Mock.ofType<azdata.window.Dialog>();
// 			dialogMock.setup(x => x.cancelButton).returns(() => cancelButtonMock.object);
// 			dialogMock.setup((x: any) => x.then).returns(() => undefined);
// 			const show = sinon.stub(azdata.window, 'createModelViewDialog').returns(dialogMock.object);
// 			sinon.stub(azdata.window, 'openDialog');

// 			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
// 			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
// 			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

// 			await postgresModel['getConnectionProfile']();
// 			sinon.assert.notCalled(connect);
// 			sinon.assert.calledOnce(show);
// 			sinon.assert.calledOnce(close);
// 		});

// 		it('Reads password from cred store and no dialog prompt', async function (): Promise<void> {
// 			const password = generateGuid();
// 			// Set up cred store to return our password
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
// 			connectionResultMock.setup(x => x.connected).returns(() => true);
// 			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
// 			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

// 			const cancelButtonMock = TypeMoq.Mock.ofType<azdata.window.Button>();
// 			cancelButtonMock.setup((x: any) => x.then).returns(() => undefined);

// 			const dialogMock = TypeMoq.Mock.ofType<azdata.window.Dialog>();
// 			dialogMock.setup(x => x.cancelButton).returns(() => cancelButtonMock.object);
// 			dialogMock.setup((x: any) => x.then).returns(() => undefined);
// 			const show = sinon.stub(azdata.window, 'createModelViewDialog').returns(dialogMock.object);
// 			sinon.stub(azdata.window, 'openDialog');

// 			const treeSave = sinon.spy(AzureArcTreeDataProvider.prototype, 'saveControllers');

// 			await postgresModel['getConnectionProfile']();
// 			sinon.assert.calledOnce(connect);
// 			sinon.assert.notCalled(show);
// 			sinon.assert.calledOnce(treeSave);
// 		});

// 		it('Reads password from cred store and connect fails, show dialog prompt', async function (): Promise<void> {
// 			const password = generateGuid();
// 			// Set up cred store to return our password
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
// 			connectionResultMock.setup(x => x.connected).returns(() => false);
// 			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
// 			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

// 			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
// 			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
// 			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

// 			const cancelButtonMock = TypeMoq.Mock.ofType<azdata.window.Button>();
// 			cancelButtonMock.setup((x: any) => x.then).returns(() => undefined);

// 			const dialogMock = TypeMoq.Mock.ofType<azdata.window.Dialog>();
// 			dialogMock.setup(x => x.cancelButton).returns(() => cancelButtonMock.object);
// 			dialogMock.setup((x: any) => x.then).returns(() => undefined);
// 			const show = sinon.stub(azdata.window, 'createModelViewDialog').returns(dialogMock.object);
// 			sinon.stub(azdata.window, 'openDialog');

// 			await postgresModel['getConnectionProfile']();
// 			sinon.assert.calledOnce(connect);
// 			sinon.assert.calledOnce(show);
// 			sinon.assert.calledOnce(close);
// 		});

// 		it('Show dialog prompt if username not found', async function (): Promise<void> {
// 			// Setup PostgresModel without username
// 			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '', connectionId: '12345678' };
// 			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
// 			let postgresModelNew = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));
// 			await postgresModelNew.refresh();

// 			const password = generateGuid();
// 			// Set up cred store to return our password
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const connect = sinon.stub(azdata.connection, 'connect');
// 			const cancelButtonMock = TypeMoq.Mock.ofType<azdata.window.Button>();
// 			cancelButtonMock.setup((x: any) => x.then).returns(() => undefined);

// 			const dialogMock = TypeMoq.Mock.ofType<azdata.window.Dialog>();
// 			dialogMock.setup(x => x.cancelButton).returns(() => cancelButtonMock.object);
// 			dialogMock.setup((x: any) => x.then).returns(() => undefined);
// 			const show = sinon.stub(azdata.window, 'createModelViewDialog').returns(dialogMock.object);
// 			sinon.stub(azdata.window, 'openDialog');

// 			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
// 			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
// 			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

// 			await postgresModelNew['getConnectionProfile']();
// 			sinon.assert.notCalled(connect);
// 			sinon.assert.calledOnce(show);
// 			sinon.assert.calledOnce(close);
// 		});

// 		it('Shows dialog prompt if no connection id', async function (): Promise<void> {
// 			// Setup PostgresModel without connectionId
// 			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '' };
// 			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
// 			let postgresModelNew = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));
// 			await postgresModelNew.refresh();

// 			const provider = sinon.stub(azdata.credentials, 'getProvider');
// 			const connect = sinon.stub(azdata.connection, 'connect');
// 			const cancelButtonMock = TypeMoq.Mock.ofType<azdata.window.Button>();
// 			cancelButtonMock.setup((x: any) => x.then).returns(() => undefined);

// 			const dialogMock = TypeMoq.Mock.ofType<azdata.window.Dialog>();
// 			dialogMock.setup(x => x.cancelButton).returns(() => cancelButtonMock.object);
// 			dialogMock.setup((x: any) => x.then).returns(() => undefined);
// 			const show = sinon.stub(azdata.window, 'createModelViewDialog').returns(dialogMock.object);
// 			sinon.stub(azdata.window, 'openDialog');

// 			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
// 			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
// 			const close = sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));

// 			await postgresModelNew['getConnectionProfile']();
// 			sinon.assert.notCalled(provider);
// 			sinon.assert.notCalled(connect);
// 			sinon.assert.calledOnce(show);
// 			sinon.assert.calledOnce(close);
// 		});
// 	});

// 	describe('getEngineSettings', function (): void {

// 		beforeEach(async () => {
// 			// Setup PostgresModel
// 			const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '', userName: 'postgres', connectionId: '12345678' };
// 			const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
// 			postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));

// 			//Stub calling refresh postgres model
// 			sinon.stub(azdataApi.arc.postgres.server, 'show').resolves(FakePostgresServerShowOutput);

// 			//Stub how to get connection profile
// 			const iconnectionProfileMock = TypeMoq.Mock.ofType<azdata.IConnectionProfile>();
// 			iconnectionProfileMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(iconnectionProfileMock.object));
// 			const cancelButtonMock = TypeMoq.Mock.ofType<azdata.window.Button>();
// 			cancelButtonMock.setup((x: any) => x.then).returns(() => undefined);

// 			const dialogMock = TypeMoq.Mock.ofType<azdata.window.Dialog>();
// 			dialogMock.setup(x => x.cancelButton).returns(() => cancelButtonMock.object);
// 			dialogMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.window, 'createModelViewDialog').returns(dialogMock.object);
// 			sinon.stub(azdata.window, 'openDialog');

// 			sinon.stub(azdata.connection, 'getUriForConnection');

// 			//Call to provide external endpoint
// 			await postgresModel.refresh();
// 		});

// 		it('Throw error when trying to connect fails', async function (): Promise<void> {
// 			const errorMessage = 'Mock connection fail occured';
// 			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
// 			connectionResultMock.setup(x => x.connected).returns(() => false);
// 			connectionResultMock.setup(x => x.errorMessage).returns(() => errorMessage);
// 			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
// 			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

// 			await should(postgresModel.getEngineSettings()).be.rejectedWith(new Error(errorMessage));
// 			sinon.assert.calledOnce(connect);
// 		});

// 		it('Update active connection id when connect passes', async function (): Promise<void> {
// 			const connectionID = '098765';
// 			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
// 			connectionResultMock.setup(x => x.connected).returns(() => true);
// 			connectionResultMock.setup(x => x.connectionId).returns(() => connectionID);
// 			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
// 			const connect = sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

// 			const array: azdata.DbCellValue[][] = [];

// 			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
// 			executeMock.setup(x => x.rows).returns(() => array);
// 			executeMock.setup((x: any) => x.then).returns(() => undefined);

// 			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
// 			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
// 			providerMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

// 			await postgresModel.getEngineSettings();
// 			sinon.assert.calledOnce(connect);
// 			sinon.assert.match(postgresModel['_activeConnectionId'], connectionID);
// 		});

// 		it('Updates engineSettingsLastUpdated after populating engine settings', async function (): Promise<void> {
// 			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
// 			connectionResultMock.setup(x => x.connected).returns(() => true);
// 			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

// 			const array: azdata.DbCellValue[][] = [];

// 			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
// 			executeMock.setup(x => x.rows).returns(() => array);
// 			executeMock.setup((x: any) => x.then).returns(() => undefined);

// 			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
// 			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
// 			providerMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

// 			await postgresModel.getEngineSettings();
// 			should(postgresModel.engineSettingsLastUpdated).be.Date();
// 		});

// 		it('Populating engine settings skips certain parameters', async function (): Promise<void> {
// 			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
// 			connectionResultMock.setup(x => x.connected).returns(() => true);
// 			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

// 			const rows: azdata.DbCellValue[][] = [
// 				[{
// 					displayValue: 'archive_timeout',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				}]
// 			];

// 			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
// 			executeMock.setup(x => x.rows).returns(() => rows);
// 			executeMock.setup((x: any) => x.then).returns(() => undefined);

// 			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
// 			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
// 			providerMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

// 			await postgresModel.getEngineSettings();
// 			should(postgresModel.workerNodesEngineSettings.pop()).be.undefined();
// 		});

// 		it('Populates engine settings accurately', async function (): Promise<void> {
// 			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
// 			connectionResultMock.setup(x => x.connected).returns(() => true);
// 			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));

// 			const rows: azdata.DbCellValue[][] = [
// 				[{
// 					displayValue: 'test0',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				},
// 				{
// 					displayValue: 'test1',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				},
// 				{
// 					displayValue: 'test2',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				},
// 				{
// 					displayValue: 'test3',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				},
// 				{
// 					displayValue: 'test4',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				},
// 				{
// 					displayValue: 'test5',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				},
// 				{
// 					displayValue: 'test6',
// 					isNull: false,
// 					invariantCultureDisplayValue: ''
// 				}],
// 			];

// 			const engineSettingsModelCompare: EngineSettingsModel = {
// 				parameterName: 'test0',
// 				value: 'test1',
// 				description: 'test2',
// 				min: 'test3',
// 				max: 'test4',
// 				options: 'test5',
// 				type: 'test6'
// 			};

// 			const executeMock = TypeMoq.Mock.ofType<azdata.SimpleExecuteResult>();
// 			executeMock.setup(x => x.rows).returns(() => rows);
// 			executeMock.setup((x: any) => x.then).returns(() => undefined);

// 			const providerMock = TypeMoq.Mock.ofType<azdata.QueryProvider>();
// 			providerMock.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => executeMock.object);
// 			providerMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.dataprotocol, 'getProvider').returns(providerMock.object);

// 			await postgresModel.getEngineSettings();
// 			should(postgresModel.coordinatorNodeEngineSettings.pop()).be.match(engineSettingsModelCompare);
// 		});

// 	});

// });
