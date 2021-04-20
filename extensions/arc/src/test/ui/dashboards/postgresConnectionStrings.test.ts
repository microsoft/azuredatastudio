/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PGResourceInfo, ResourceType } from 'arc';
import * as azdataExt from 'azdata-ext';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { createModelViewMock } from '@microsoft/azdata-test/out/mocks/modelView/modelViewMock';
import { ControllerModel, Registration } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { PostgresConnectionStringsPage } from '../../../ui/dashboards/postgres/postgresConnectionStringsPage';
import { AzureArcTreeDataProvider } from '../../../ui/tree/azureArcTreeDataProvider';
import { FakeControllerModel } from '../../mocks/fakeControllerModel';
import { FakeAzdataApi } from '../../mocks/fakeAzdataApi';

export const FakePostgresServerShowOutput: azdataExt.AzdataOutput<azdataExt.PostgresServerShowResult> = {
	logs: [],
	stdout: [],
	stderr: [],
	result: {
		apiVersion: 'version',
		kind: 'postgresql',
		metadata: {
			creationTimestamp: '',
			generation: 1,
			name: 'pgt',
			namespace: 'ns',
			resourceVersion: '',
			selfLink: '',
			uid: '',
		},
		spec: {
			engine: {
				extensions: [{ name: '' }],
				settings: {
					default: { ['']: '' }
				},
				version: '12'
			},
			scale: {
				shards: 0,
				workers: 0
			},
			scheduling: {
				default: {
					resources: {
						requests: {
							cpu: '',
							memory: ''
						},
						limits: {
							cpu: '',
							memory: ''
						}
					}
				},
				roles: {
					coordinator: {
						resources: {
							requests: {
								cpu: '',
								memory: ''
							},
							limits: {
								cpu: '',
								memory: ''
							}
						}
					},
					worker: {
						resources: {
							requests: {
								cpu: '',
								memory: ''
							},
							limits: {
								cpu: '',
								memory: ''
							}
						}
					}
				}
			},
			service: {
				type: '',
				port: 0
			},
			storage: {
				data: {
					className: '',
					size: ''
				},
				logs: {
					className: '',
					size: ''
				},
				backups: {
					className: '',
					size: ''
				}
			}
		},
		status: {
			externalEndpoint: '127.0.0.1:5432',
			readyPods: '',
			state: '',
			logSearchDashboard: '',
			metricsDashboard: '',
			podsStatus: [{
				conditions: [{
					lastTransitionTime: '',
					message: '',
					reason: '',
					status: '',
					type: '',
				}],
				name: '',
				role: '',
			}]
		}
	}
};



describe('postgresConnectionStringsPage', function (): void {
	let controllerModel: ControllerModel;
	let postgresModel: PostgresModel;
	let azdataApi: azdataExt.IAzdataApi;
	let postgresConnectionStrings: PostgresConnectionStringsPage;

	afterEach(function (): void {
		sinon.restore();
	});

	beforeEach(async () => {
		// Stub the azdata CLI API
		azdataApi = new FakeAzdataApi();
		const azdataExt = TypeMoq.Mock.ofType<azdataExt.IExtension>();
		azdataExt.setup(x => x.azdata).returns(() => azdataApi);
		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExt.object });

		// Setup Controller Model
		controllerModel = new FakeControllerModel();

		//Stub calling azdata login and acquiring session
		sinon.stub(controllerModel, 'login').returns(Promise.resolve());

		// Setup PostgresModel
		const postgresResource: PGResourceInfo = { name: 'pgt', resourceType: '' };
		const registration: Registration = { instanceName: '', state: '', instanceType: ResourceType.postgresInstances };
		postgresModel = new PostgresModel(controllerModel, postgresResource, registration, new AzureArcTreeDataProvider(TypeMoq.Mock.ofType<vscode.ExtensionContext>().object));

		// Setup stub of show call
		const postgresShow = sinon.stub().returns(FakePostgresServerShowOutput);
		sinon.stub(azdataApi, 'arc').get(() => {
			return { postgres: { server: { show(name: string) { return postgresShow(name); } } } };
		});

		// Setup the PostgresConnectionsStringsPage
		let { modelViewMock } = createModelViewMock();
		postgresConnectionStrings = new PostgresConnectionStringsPage(modelViewMock.object, undefined!, postgresModel);
	});

	describe('getConnectionStrings', function (): void {

		it('Strings container should be empty since postgres model has not been refreshed', async function (): Promise<void> {
			should(postgresConnectionStrings['getConnectionStrings']()).be.empty();
		});

		it('String contain correct ip and port', async function (): Promise<void> {
			// Call to provide external endpoint
			await postgresModel.refresh();

			let endpoint = FakePostgresServerShowOutput.result.status.externalEndpoint.split(':');

			postgresConnectionStrings['getConnectionStrings']().forEach(k => {
				should(k.value.includes(endpoint[0])).be.True();
				should(k.value.includes(endpoint[1])).be.True();
			});
		});

	});

});
