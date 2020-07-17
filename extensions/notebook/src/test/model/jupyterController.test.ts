/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';

import { AppContext } from '../../common/appContext';
import { JupyterController } from '../../jupyter/jupyterController';
import { LocalPipPackageManageProvider } from '../../jupyter/localPipPackageManageProvider';
import { MockExtensionContext } from '../common/stubs';
import { NotebookUtils } from '../../common/notebookUtils';

describe('Jupyter Controller', function () {
	let mockExtensionContext: vscode.ExtensionContext = new MockExtensionContext();
	let appContext = new AppContext(mockExtensionContext);
	let controller: JupyterController;
	let connection: azdata.connection.ConnectionProfile = new azdata.connection.ConnectionProfile();
	let showErrorMessageSpy: sinon.SinonSpy;

	this.beforeEach(() => {
		showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
		sinon.stub(azdata.connection, 'getCurrentConnection').returns(Promise.resolve(connection));
		sinon.stub(azdata.tasks, 'registerTask');
		sinon.stub(vscode.commands, 'registerCommand');
		controller = new JupyterController(appContext);
	});

	this.afterEach(function (): void {
		sinon.restore();
	});

	it('should activate new JupyterController successfully', async () => {
		should(controller.extensionContext).deepEqual(appContext.extensionContext, 'Extension context should be passed through');
		should(controller.jupyterInstallation).equal(undefined, 'JupyterInstallation should be undefined before controller activation');
		await should(controller.activate()).not.be.rejected();
		// On activation, local pip and local conda package providers should exist
		should(controller.packageManageProviders.size).equal(2, 'Local pip and conda package providers should be default providers');
		should(controller.jupyterInstallation.extensionPath).equal(appContext.extensionContext.extensionPath, 'JupyterInstallation extension path should match appContext extension path');
	});

	it('should create new packageManageProvider successfully', async () => {
		should(controller.packageManageProviders.size).equal(0, 'No package manage providers should exist before activate');
		let mockProvider = TypeMoq.Mock.ofType(LocalPipPackageManageProvider);
		controller.registerPackageManager('provider1', mockProvider.object);
		should(controller.packageManageProviders.size).equal(1, 'Package manage providers should equal 1 after one provider added');
	});

	it('should throw when same packageManageProvider added twice', async () => {
		let mockProvider = TypeMoq.Mock.ofType(LocalPipPackageManageProvider);
		controller.registerPackageManager('provider1', mockProvider.object);
		should(controller.packageManageProviders.size).equal(1, 'Package manage providers should equal 1 after one provider added');
		should.throws(() => controller.registerPackageManager('provider1', mockProvider.object));
		should(controller.packageManageProviders.size).equal(1, 'Package manage providers should still equal 1');
	});

	it('should should get defaultConnection() successfully', async () => {
		let defaultConnection = await controller.getDefaultConnection();
		should(defaultConnection).deepEqual(connection, 'getDefaultConnection() did not return expected result');
	});

	it('should show error message for doManagePackages before activation', async () => {
		await controller.doManagePackages();
		should(showErrorMessageSpy.calledOnce).be.true('showErrorMessage should be called');
	});

	it('should not show error message for doManagePackages after activation', async () => {
		await controller.activate();
		await controller.doManagePackages();
		should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not be called');
	});

	it('Returns expected values from notebook provider', async () =>  {
		await controller.activate();
		should(controller.notebookProvider.standardKernels).deepEqual([], 'Notebook provider standard kernels should return empty array');
		should(controller.notebookProvider.providerId).equal('jupyter', 'Notebook provider should be jupyter');
		should(controller.notebookProvider.getNotebookManager(undefined)).be.rejected();
		should(controller.notebookProvider.notebookManagerCount).equal(0);
		controller.notebookProvider.handleNotebookClosed(undefined);
	});

	it('Returns notebook manager for real notebook editor', async () =>  {
		await controller.activate();
		let notebookUtils = new NotebookUtils();
		const notebookEditor = await notebookUtils.newNotebook(undefined);
		let notebookManager = await controller.notebookProvider.getNotebookManager(notebookEditor.document.uri);
		should(controller.notebookProvider.notebookManagerCount).equal(1);

		// Session manager should not be immediately ready
		should(notebookManager.sessionManager.isReady).equal(false);
		// Session manager should not immediately have specs
		should(notebookManager.sessionManager.specs).equal(undefined);
		controller.notebookProvider.handleNotebookClosed(notebookEditor.document.uri);
	});
});
