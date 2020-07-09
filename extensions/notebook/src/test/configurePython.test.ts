/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { ConfigurePythonWizard, ConfigurePythonModel } from '../dialog/configurePython/configurePythonWizard';
import { JupyterServerInstallation } from '../jupyter/jupyterServerInstallation';
import { ConfigurePathPage } from '../dialog/configurePython/configurePathPage';
import * as should from 'should';
import { PickPackagesPage } from '../dialog/configurePython/pickPackagesPage';
import { python3DisplayName, allKernelsName } from '../common/constants';
import { TestContext, createViewContext, TestButton } from './common';
import { EventEmitter } from 'vscode';

describe('Configure Python Wizard', function () {
	let testWizard: ConfigurePythonWizard;
	let viewContext: TestContext;
	let testInstallation: JupyterServerInstallation;

	beforeEach(() => {
		let mockInstall = TypeMoq.Mock.ofType(JupyterServerInstallation);
		mockInstall.setup(i => i.getInstalledPipPackages(TypeMoq.It.isAnyString())).returns(() => Promise.resolve([]));
		mockInstall.setup(i => i.getRequiredPackagesForKernel(TypeMoq.It.isAnyString())).returns(() => [{ name: 'TestPkg', version: '1.0.0'}]);
		testInstallation = mockInstall.object;

		let mockDoneButton = new TestButton(new EventEmitter<void>());
		let mockNextButton = new TestButton(new EventEmitter<void>());

		let mockWizard = TypeMoq.Mock.ofType<azdata.window.Wizard>();
		mockWizard.setup(w => w.doneButton).returns(() => mockDoneButton);
		mockWizard.setup(w => w.nextButton).returns(() => mockNextButton);

		let mockPythonWizard = TypeMoq.Mock.ofType(ConfigurePythonWizard);
		mockPythonWizard.setup(w => w.showErrorMessage(TypeMoq.It.isAnyString()));
		mockPythonWizard.setup(w => w.wizard).returns(() => mockWizard.object);
		testWizard = mockPythonWizard.object;

		viewContext = createViewContext();
	});

	// These wizard tests are disabled due to errors with disposable objects
	//
	// it('Start wizard test', async () => {
	// 	let wizard = new ConfigurePythonWizard(testInstallation);
	// 	await wizard.start();
	// 	await wizard.close();
	// 	await should(wizard.setupComplete).be.resolved();
	// });

	// it('Reject setup on cancel test', async () => {
	// 	let wizard = new ConfigurePythonWizard(testInstallation);
	// 	await wizard.start(undefined, true);
	// 	await wizard.close();
	// 	await should(wizard.setupComplete).be.rejected();
	// });

	// it('Error message test', async () => {
	// 	let wizard = new ConfigurePythonWizard(testInstallation);
	// 	await wizard.start();

	// 	should(wizard.wizard.message).be.undefined();

	// 	let testMsg = 'Test message';
	// 	wizard.showErrorMessage(testMsg);
	// 	should(wizard.wizard.message.text).be.equal(testMsg);
	// 	should(wizard.wizard.message.level).be.equal(azdata.window.MessageLevel.Error);

	// 	wizard.clearStatusMessage();
	// 	should(wizard.wizard.message).be.undefined();

	// 	await wizard.close();
	// });

	it('Configure Path Page test', async () => {
		let testPythonLocation = '/not/a/real/path';
		let model = <ConfigurePythonModel>{
			useExistingPython: true,
			pythonPathsPromise: Promise.resolve([{
				installDir: testPythonLocation,
				version: '4000'
			}])
		};

		let page = azdata.window.createWizardPage('Page 1');
		let configurePathPage = new ConfigurePathPage(testWizard, page, model, viewContext.view);

		should(await configurePathPage.initialize()).be.true();

		// First page, so onPageEnter should do nothing
		await should(configurePathPage.onPageEnter()).be.resolved();
		should(testWizard.wizard.nextButton.enabled).be.true();

		should(await configurePathPage.onPageLeave()).be.true();
		should(model.useExistingPython).be.true();
		should(model.pythonLocation).be.equal(testPythonLocation);
	});

	it('Pick Packages Page test', async () => {
		let model = <ConfigurePythonModel>{
			kernelName: allKernelsName,
			installation: testInstallation,
			pythonLocation: '/not/a/real/path',
			useExistingPython: true
		};

		let page = azdata.window.createWizardPage('Page 2');
		let pickPackagesPage = new PickPackagesPage(testWizard, page, model, viewContext.view);

		should(await pickPackagesPage.initialize()).be.true();

		should((<any>pickPackagesPage).kernelLabel).not.be.undefined();
		should((<any>pickPackagesPage).kernelDropdown).be.undefined();

		// Last page, so onPageLeave should do nothing
		should(await pickPackagesPage.onPageLeave()).be.true();

		await should(pickPackagesPage.onPageEnter()).be.resolved();
		should(testWizard.wizard.doneButton.enabled).be.true();
		should(model.packagesToInstall).be.deepEqual(testInstallation.getRequiredPackagesForKernel(allKernelsName));
	});

	it('Undefined kernel test', async () => {
		let model = <ConfigurePythonModel>{
			kernelName: undefined,
			installation: testInstallation,
			pythonLocation: '/not/a/real/path',
			useExistingPython: true
		};

		let page = azdata.window.createWizardPage('Page 2');
		let pickPackagesPage = new PickPackagesPage(testWizard, page, model, viewContext.view);

		should(await pickPackagesPage.initialize()).be.true();

		should((<any>pickPackagesPage).kernelLabel).be.undefined();
		should((<any>pickPackagesPage).kernelDropdown).not.be.undefined();

		await should(pickPackagesPage.onPageEnter()).be.resolved();
		should(model.packagesToInstall).be.deepEqual(testInstallation.getRequiredPackagesForKernel(python3DisplayName));
	});
});
