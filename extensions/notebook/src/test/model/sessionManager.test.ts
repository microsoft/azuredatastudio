/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as utils from '../../common/utils';
import * as sinon from 'sinon';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as bdc from 'bdc';
import * as vscode from 'vscode';
import { nb, IConnectionProfile, connection, ConnectionOptionSpecialType, ServerInfo } from 'azdata';
import { SessionManager, Session, Kernel } from '@jupyterlab/services';
import 'mocha';
import { JupyterSessionManager, JupyterSession } from '../../jupyter/jupyterSessionManager';
import { Deferred } from '../../common/promise';
import { SessionStub, KernelStub, FutureStub } from '../common';
import { noBDCConnectionError, providerNotValidError } from '../../common/localizedConstants';
import { ExtensionContextHelper } from '../../common/extensionContextHelper';
import { AppContext } from '../../common/appContext';
import uuid = require('uuid');

export class TestClusterController implements bdc.IClusterController {
	getClusterConfig(): Promise<any> {
		return Promise.resolve({});
	}
	getKnoxUsername(clusterUsername: string): Promise<string> {
		return Promise.resolve('knoxUsername');
	}
	getEndPoints(promptConnect?: boolean): Promise<bdc.IEndPointsResponse> {
		return Promise.resolve( {
			response: undefined,
			endPoints: []
		});
	}
	username: string;
	password: string;
}

before(async function(): Promise<void> {
	// We have to reset the extension context here since the test runner unloads the files before running the tests
	// so the static state is lost
	const api = await vscode.extensions.getExtension('Microsoft.notebook').activate();
	ExtensionContextHelper.setExtensionContext((api.getAppContext() as AppContext).extensionContext);
});

describe('Jupyter Session Manager', function (): void {
	let mockJupyterManager = TypeMoq.Mock.ofType<SessionManager>();
	let sessionManager = new JupyterSessionManager();

	it('isReady should only be true after ready promise completes', function (done): void {
		// Given
		let deferred = new Deferred<void>();
		mockJupyterManager.setup(m => m.ready).returns(() => deferred.promise);

		// When I call before resolve I expect it'll be false
		sessionManager.setJupyterSessionManager(mockJupyterManager.object);
		should(sessionManager.isReady).be.false();

		// When I call a after resolve, it'll be true
		deferred.resolve();
		sessionManager.ready.then(() => {
			should(sessionManager.isReady).be.true();
			done();
		});
	});

	it('should passthrough the ready calls', function (done): void {
		// Given
		let deferred = new Deferred<void>();
		mockJupyterManager.setup(m => m.ready).returns(() => deferred.promise);

		// When I wait on the ready method before completing
		sessionManager.setJupyterSessionManager(mockJupyterManager.object);
		sessionManager.ready.then(() => done());

		// Then session manager should eventually resolve
		deferred.resolve();
	});

	it('should handle null specs', function (): void {
		mockJupyterManager.setup(m => m.specs).returns(() => undefined);
		let specs = sessionManager.specs;
		should(specs).be.undefined();
	});

	it('should map specs to named kernels', function (): void {
		let internalSpecs: Kernel.ISpecModels = {
			default: 'mssql',
			kernelspecs: {
				'mssql': <Kernel.ISpecModel>{ language: 'sql' },
				'python': <Kernel.ISpecModel>{ language: 'python' }
			}
		};
		mockJupyterManager.setup(m => m.specs).returns(() => internalSpecs);
		let specs = sessionManager.specs;
		should(specs.defaultKernel).equal('mssql');
		should(specs.kernels).have.length(2);
	});


	it('Should call to startSession with correct params', async function (): Promise<void> {
		// Given a session request that will complete OK
		let sessionOptions: nb.ISessionOptions = { path: 'mypath.ipynb' };
		let expectedSessionInfo = <Session.ISession>{
			path: sessionOptions.path,
			id: 'id',
			name: 'sessionName',
			type: 'type',
			kernel: {
				name: 'name'
			}
		};
		mockJupyterManager.setup(m => m.startNew(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedSessionInfo));
		mockJupyterManager.setup(m => m.specs).returns(() => undefined);

		// When I call startSession
		let session = await sessionManager.startNew(sessionOptions, true);
		// Then I expect the parameters passed to be correct
		should(session.path).equal(sessionOptions.path);
		should(session.canChangeKernels).be.true();
		should(session.id).equal(expectedSessionInfo.id);
		should(session.name).equal(expectedSessionInfo.name);
		should(session.type).equal(expectedSessionInfo.type);
		should(session.kernel.name).equal(expectedSessionInfo.kernel.name);
	});

	it('Should call to shutdown with correct id', async function (): Promise<void> {
		let id = 'session1';
		mockJupyterManager.setup(m => m.shutdown(TypeMoq.It.isValue(id))).returns(() => Promise.resolve());
		mockJupyterManager.setup(m => m.isDisposed).returns(() => false);
		await sessionManager.shutdown(id);
		mockJupyterManager.verify(m => m.shutdown(TypeMoq.It.isValue(id)), TypeMoq.Times.once());
	});
});

describe('Jupyter Session', function (): void {
	let mockJupyterSession: TypeMoq.IMock<SessionStub>;
	let session: JupyterSession;

	beforeEach(() => {
		mockJupyterSession = TypeMoq.Mock.ofType(SessionStub);
		session = new JupyterSession(mockJupyterSession.object, undefined, true);
	});

	afterEach(() => {
		sinon.restore();
	});

	it('should always be able to change kernels', function (): void {
		should(session.canChangeKernels).be.true();
	});
	it('should pass through most properties', function (): void {
		// Given values for the passthrough properties
		mockJupyterSession.setup(s => s.id).returns(() => 'id');
		mockJupyterSession.setup(s => s.name).returns(() => 'name');
		mockJupyterSession.setup(s => s.path).returns(() => 'path');
		mockJupyterSession.setup(s => s.type).returns(() => 'type');
		mockJupyterSession.setup(s => s.status).returns(() => 'starting');
		// Should return those values when called
		should(session.id).equal('id');
		should(session.name).equal('name');
		should(session.path).equal('path');
		should(session.type).equal('type');
		should(session.status).equal('starting');
	});

	it('should handle null kernel', function (): void {
		mockJupyterSession.setup(s => s.kernel).returns(() => undefined);
		should(session.kernel).be.undefined();
	});

	it('should passthrough kernel', function (): void {
		// Given a kernel with an ID
		let kernelMock = TypeMoq.Mock.ofType(KernelStub);
		kernelMock.setup(k => k.id).returns(() => 'id');
		mockJupyterSession.setup(s => s.kernel).returns(() => kernelMock.object);

		// When I get a wrapper for the kernel
		let kernel = session.kernel;
		kernel = session.kernel;
		// Then I expect it to have the ID, and only be called once
		should(kernel.id).equal('id');
		mockJupyterSession.verify(s => s.kernel, TypeMoq.Times.exactly(1));
	});

	it('should send name in changeKernel request', async function (): Promise<void> {
		// Given change kernel returns something
		let kernelMock = TypeMoq.Mock.ofType(KernelStub);
		kernelMock.setup(k => k.id).returns(() => 'id');
		let options: Partial<Kernel.IModel>;
		mockJupyterSession.setup(s => s.changeKernel(TypeMoq.It.isAny())).returns((opts) => {
			options = opts;
			return Promise.resolve(kernelMock.object);
		});

		// When I call changeKernel on the wrapper
		let kernel = await session.changeKernel({
			name: 'python',
			display_name: 'Python'
		});
		// Then I expect it to have the ID, and only be called once
		should(kernel.id).equal('id');
		should(options.name).equal('python');
	});

	it('should write configuration to config.json file', async function (): Promise<void> {
		let tempDir = os.tmpdir();
		let configPath = path.join(tempDir, '.sparkmagic', 'config.json');
		const expectedResult = {
			'kernel_python_credentials': {
				'url': 'http://localhost:8088'
			},
			'kernel_scala_credentials': {
				'url': 'http://localhost:8088'
			},
			'kernel_r_credentials': {
				'url': 'http://localhost:8088'
			},
			'livy_session_startup_timeout_seconds': 100,
			'logging_config': {
				'version': 1,
				'formatters': {
					'magicsFormatter': {
						'format': '%(asctime)s\t%(levelname)s\t%(message)s',
						'datefmt': ''
					}
				},
				'handlers': {
					'magicsHandler': {
						'class': 'hdijupyterutils.filehandler.MagicsFileHandler',
						'formatter': 'magicsFormatter',
						'home_path': ''
					}
				},
				'loggers': {
					'magicsLogger': {
						'handlers': ['magicsHandler'],
						'level': 'DEBUG',
						'propagate': 0
					}
				}
			},
			'ignore_ssl_errors': true,
		};
		expectedResult.logging_config.handlers.magicsHandler.home_path = path.join(tempDir, '.sparkmagic');
		sinon.stub(utils, 'getUserHome').returns(tempDir);
		await session.configureKernel();
		let result = await fs.promises.readFile(configPath, 'utf-8');
		should(JSON.parse(result) === expectedResult);
	});

	it('should configure connection correctly for MSSQL and SqlLogin auth type', async function (): Promise<void> {
		let connectionProfile: IConnectionProfile = {
			authenticationType: '',
			connectionName: '',
			databaseName: '',
			id: 'id',
			providerName: 'MSSQL',
			options: {
				authenticationType: 'SqlLogin',
			},
			password: '',
			savePassword: false,
			saveProfile: false,
			serverName: '',
			userName: ''
		};
		let futureMock = TypeMoq.Mock.ofType(FutureStub);
		let kernelMock = TypeMoq.Mock.ofType(KernelStub);
		kernelMock.setup(k => k.name).returns(() => 'spark');
		kernelMock.setup(m => m.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => futureMock.object);
		mockJupyterSession.setup(s => s.kernel).returns(() => kernelMock.object);
		let credentials = { [ConnectionOptionSpecialType.password]: 'password' };
		sinon.stub(connection, 'getCredentials').returns(Promise.resolve(credentials));

		// Set up connection info to big data cluster
		const mockServerInfo: ServerInfo = {
			serverMajorVersion: 0,
			serverMinorVersion: 0,
			serverReleaseVersion: 0,
			engineEditionId: 0,
			serverVersion: '',
			serverLevel: '',
			serverEdition: '',
			isCloud: false,
			azureVersion: 0,
			osVersion: '',
			options: {
				isBigDataCluster: true
			}
		};
		const mockGatewayEndpoint: bdc.IEndpointModel = {
			name: 'gateway',
			description: '',
			endpoint: '',
			protocol: '',
		};
		const mockControllerEndpoint: bdc.IEndpointModel = {
			name: 'controller',
			description: '',
			endpoint: '',
			protocol: '',
		};
		const mockHostAndIp: utils.HostAndIp = {
			host: '127.0.0.1',
			port: '1337'
		};
		const mockClustercontroller = new TestClusterController();
		mockClustercontroller.username = 'admin';
		mockClustercontroller.password = uuid.v4();
		let mockBdcExtension: TypeMoq.IMock<bdc.IExtension> = TypeMoq.Mock.ofType<bdc.IExtension>();
		let mockExtension: TypeMoq.IMock<vscode.Extension<any>> = TypeMoq.Mock.ofType<vscode.Extension<any>>();
		mockBdcExtension.setup(m => m.getClusterController(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => mockClustercontroller);
		mockBdcExtension.setup((m: any) => m.then).returns(() => mockBdcExtension);
		mockExtension.setup(m => m.activate()).returns(() => Promise.resolve(mockBdcExtension.object));
		mockExtension.setup((m: any) => m.then).returns(() => mockExtension);
		sinon.stub(vscode.extensions, 'getExtension').returns(mockExtension.object);
		sinon.stub(connection, 'getServerInfo').returns(Promise.resolve(mockServerInfo));
		sinon.stub(utils, 'getClusterEndpoints').returns([mockGatewayEndpoint, mockControllerEndpoint]);
		sinon.stub(utils, 'getHostAndPortFromEndpoint').returns(mockHostAndIp);

		await session.configureConnection(connectionProfile);
		should(connectionProfile.options['host']).equal(mockHostAndIp.host);
		should(connectionProfile.options['knoxport']).equal(mockHostAndIp.port);
	});

	it('configure connection should throw error if there is no connection to big data cluster', async function (): Promise<void> {
		let connectionProfile: IConnectionProfile = {
			authenticationType: '',
			connectionName: '',
			databaseName: '',
			id: 'id',
			providerName: 'MSSQL',
			options: {
				authenticationType: 'SqlLogin',
			},
			password: '',
			savePassword: false,
			saveProfile: false,
			serverName: '',
			userName: ''
		};
		let futureMock = TypeMoq.Mock.ofType(FutureStub);
		let kernelMock = TypeMoq.Mock.ofType(KernelStub);
		kernelMock.setup(k => k.name).returns(() => 'spark');
		kernelMock.setup(m => m.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => futureMock.object);
		mockJupyterSession.setup(s => s.kernel).returns(() => kernelMock.object);
		let credentials = { [ConnectionOptionSpecialType.password]: 'password' };
		sinon.stub(connection, 'getCredentials').returns(Promise.resolve(credentials));
		await should(session.configureConnection(connectionProfile)).be.rejectedWith(noBDCConnectionError);
	});

	it('configure connection should throw error if provider is not MSSQL for spark kernel', async function (): Promise<void> {
		let connectionProfile: IConnectionProfile = {
			authenticationType: '',
			connectionName: '',
			databaseName: '',
			id: 'id',
			providerName: 'provider',
			options: {
				authenticationType: 'SqlLogin',
			},
			password: '',
			savePassword: false,
			saveProfile: false,
			serverName: '',
			userName: ''
		};
		let futureMock = TypeMoq.Mock.ofType(FutureStub);
		let kernelMock = TypeMoq.Mock.ofType(KernelStub);
		kernelMock.setup(k => k.name).returns(() => 'spark');
		kernelMock.setup(m => m.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => futureMock.object);
		mockJupyterSession.setup(s => s.kernel).returns(() => kernelMock.object);
		await should(session.configureConnection(connectionProfile)).be.rejectedWith(providerNotValidError);
	});

	it('should set environment variables correctly', function (): void {
		let futureMock = TypeMoq.Mock.ofType(FutureStub);
		let kernelMock = TypeMoq.Mock.ofType(KernelStub);
		kernelMock.setup(m => m.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => futureMock.object);
		let spy = sinon.spy(kernelMock.object, 'requestExecute');
		mockJupyterSession.setup(s => s.kernel).returns(() => kernelMock.object);
		mockJupyterSession.setup(s => s.path).returns(() => 'path');
		let newSession = new JupyterSession(mockJupyterSession.object, undefined, false, 'pythonEnvVarPath');
		should(newSession).not.be.undefined();
		sinon.assert.calledOnce(spy);
		let args = spy.getCall(0).args;
		should(args[0].code.includes('pythonEnvVarPath'));
	});
});
