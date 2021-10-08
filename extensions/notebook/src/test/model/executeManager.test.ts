/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import 'mocha';

import { LocalJupyterServerManager, ServerInstanceFactory, IServerManagerOptions } from '../../jupyter/jupyterServerManager';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { Deferred } from '../../common/promise';
import { MockExtensionContext } from '../common/stubs';
import { JupyterSessionManager } from '../../jupyter/jupyterSessionManager';
import { JupyterExecuteManager } from '../../jupyter/jupyterExecuteManager';
import { initInstallAndInstance } from './serverManager.test';

describe('Jupyter Execute Manager', function (): void {
	const pythonKernelSpec: azdata.nb.IKernelSpec = {
		name: 'python3',
		display_name: 'Python 3'
	};
	let expectedPath = 'my/notebook.ipynb';
	let serverManager: LocalJupyterServerManager;
	let sessionManager: JupyterSessionManager;
	let executeManager: JupyterExecuteManager;
	let deferredInstall: Deferred<void>;
	let mockExtensionContext: MockExtensionContext;
	let mockFactory: TypeMoq.IMock<ServerInstanceFactory>;
	let serverManagerOptions: IServerManagerOptions;
	beforeEach(() => {
		mockExtensionContext = new MockExtensionContext();
		mockFactory = TypeMoq.Mock.ofType(ServerInstanceFactory);

		deferredInstall = new Deferred<void>();
		let mockInstall = TypeMoq.Mock.ofType(JupyterServerInstallation, undefined, undefined, '/root');
		mockInstall.setup(j => j.promptForPythonInstall(TypeMoq.It.isAny())).returns(() => deferredInstall.promise);
		mockInstall.object.execOptions = { env: Object.assign({}, process.env) };

		serverManagerOptions = {
			documentPath: expectedPath,
			jupyterInstallation: mockInstall.object,
			extensionContext: mockExtensionContext,
			factory: mockFactory.object
		};
		serverManager = new LocalJupyterServerManager(serverManagerOptions);

		sessionManager = new JupyterSessionManager();
		executeManager = new JupyterExecuteManager(serverManager, sessionManager);
	});

	it('Server settings should be set', async function (): Promise<void> {
		should(executeManager.serverSettings).be.undefined();
		let expectedUri = vscode.Uri.parse('http://localhost:1234?token=abcdefghijk');
		initInstallAndInstance(expectedUri, mockFactory);
		deferredInstall.resolve();

		// When I start the server
		await serverManager.startServer(pythonKernelSpec);
		should(executeManager.serverSettings.baseUrl).equal('http://localhost:1234', 'Server settings did not match expected value');
	});

	it('Session Manager should exist', async function (): Promise<void> {
		should(executeManager.sessionManager).deepEqual(sessionManager);
	});

	it('Server Manager should exist', async function (): Promise<void> {
		should(executeManager.serverManager).deepEqual(serverManager);
	});

	it('Session and server managers should be shutdown/stopped on dispose', async function(): Promise<void> {
		let sessionManager = TypeMoq.Mock.ofType<JupyterSessionManager>();
		let serverManager = TypeMoq.Mock.ofType<LocalJupyterServerManager>();
		executeManager = new JupyterExecuteManager(serverManager.object, sessionManager.object);
		sessionManager.setup(s => s.shutdownAll()).returns(() => new Promise((resolve) => resolve()));
		serverManager.setup(s => s.stopServer()).returns(() => new Promise((resolve) => resolve()));

		// After I dispose the execute manager
		executeManager.dispose();

		// Session and server managers should be shutdown/stopped
		sessionManager.verify((s) => s.shutdownAll(), TypeMoq.Times.once());
		serverManager.verify((s) => s.stopServer(), TypeMoq.Times.once());
	});
});
