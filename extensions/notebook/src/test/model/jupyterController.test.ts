/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';

import { ApiWrapper } from '../../common/apiWrapper';
import { AppContext } from '../../common/appContext';
import { JupyterController } from '../../jupyter/jupyterController';
import { LocalPipPackageManageProvider } from '../../jupyter/localPipPackageManageProvider';
import { MockExtensionContext } from '../common/stubs';

describe('JupyterController tests', function () {
	let mockExtensionContext: vscode.ExtensionContext;
	let appContext: AppContext;
	let controller: JupyterController;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;

	this.beforeAll(() => {
		mockExtensionContext = new MockExtensionContext();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		appContext = new AppContext(mockExtensionContext, mockApiWrapper.object);
	});

	this.beforeEach(() => {
		controller = new JupyterController(appContext);
	});

	it('should activate new JupyterController successfully', async () => {
		should(controller.extensionContext).deepEqual(appContext.extensionContext, 'Extension context should be passed through');
		await should(controller.activate()).not.be.rejected();
		// On activation, local pip and local conda package providers should exist
		should(controller.packageManageProviders.size).equal(2, 'Local pip and conda package providers should be default providers');
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
});
