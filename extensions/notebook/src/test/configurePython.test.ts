/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../common/apiWrapper';
import { ConfigurePythonWizard, ConfigurePythonModel } from '../dialog/configurePython/configurePythonWizard';
import { JupyterServerInstallation } from '../jupyter/jupyterServerInstallation';
import { ConfigurePathPage } from '../dialog/configurePython/configurePathPage';
import * as should from 'should';
import { PickPackagesPage } from '../dialog/configurePython/pickPackagesPage';

describe('Configure Python Wizard', function () {
	let apiWrapper: ApiWrapper = new ApiWrapper();
	let testWizard: ConfigurePythonWizard;
	let viewContext: TestContext;
	let testInstallation: JupyterServerInstallation;

	beforeEach(() => {
		let mockInstall = TypeMoq.Mock.ofType(JupyterServerInstallation);
		mockInstall.setup(i => i.getInstalledPipPackages(TypeMoq.It.isAnyString())).returns(() => Promise.resolve([]));
		testInstallation = mockInstall.object;

		let mockWizard = TypeMoq.Mock.ofType(ConfigurePythonWizard);
		mockWizard.setup(w => w.showErrorMessage(TypeMoq.It.isAnyString()));
		testWizard = mockWizard.object;

		viewContext = createViewContext();
	});

	it('Start wizard test', async () => {
		let wizard = new ConfigurePythonWizard(apiWrapper, testInstallation);
		await wizard.start();
		await wizard.close();
	});

	it('Reject setup on cancel test', async () => {
		let wizard = new ConfigurePythonWizard(apiWrapper, testInstallation);
		await wizard.start(undefined, true);
		await wizard.close();
		await should(wizard.setupComplete).be.rejected();
	});

	it('Error message test', async () => {
		let wizard = new ConfigurePythonWizard(apiWrapper, testInstallation);
		await wizard.start();

		should(wizard.wizard.message).be.undefined();

		let testMsg = 'Test message';
		wizard.showErrorMessage(testMsg);
		should(wizard.wizard.message.text).be.equal(testMsg);
		should(wizard.wizard.message.level).be.equal(azdata.window.MessageLevel.Error);

		wizard.clearStatusMessage();
		should(wizard.wizard.message).be.undefined();

		await wizard.close();
	});

	it('Configure Path Page test', async () => {
		let testPythonLocation = '/not/a/real/path';
		let model = <ConfigurePythonModel>{
			useExistingPython: true,
			usingCustomPath: false,
			pythonPathsPromise: Promise.resolve([{
				installDir: testPythonLocation,
				version: '4000'
			}])
		};

		let page = azdata.window.createWizardPage('Page 1');
		let configurePathPage = new ConfigurePathPage(apiWrapper, testWizard, page, model, viewContext.view);

		should(await configurePathPage.start()).be.true();

		// First page, so onPageEnter should do nothing
		should(await configurePathPage.onPageEnter()).be.true();

		should(await configurePathPage.onPageLeave()).be.true();
		should(model.useExistingPython).be.true();
		should(model.pythonLocation).be.equal(testPythonLocation);
	});

	it('Pick Packages Page test', async () => {
		let model = <ConfigurePythonModel>{
			kernelName: 'Python 3',
			installation: testInstallation,
			pythonLocation: '/not/a/real/path',
			useExistingPython: true
		};

		let page = azdata.window.createWizardPage('Page 2');
		let pickPackagesPage = new PickPackagesPage(apiWrapper, testWizard, page, model, viewContext.view);

		should(await pickPackagesPage.start()).be.true();

		// Last page, so onPageLeave should do nothing
		should(await pickPackagesPage.onPageLeave()).be.true();

		should(await pickPackagesPage.onPageEnter()).be.true();
		should(model.packagesToInstall).be.deepEqual(JupyterServerInstallation.getRequiredPackagesForKernel(model.kernelName));
	});
});

function createViewContext(): TestContext {
	let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

	let componentBase: azdata.Component = {
		id: '',
		updateProperties: () => Promise.resolve(),
		updateProperty: () => Promise.resolve(),
		updateCssStyles: undefined!,
		onValidityChanged: undefined!,
		valid: true,
		validate: undefined!,
		focus: undefined!
	};
	let text: azdata.TextComponent = Object.assign({}, componentBase, {
		value: ''
	});
	let button: azdata.ButtonComponent = Object.assign({}, componentBase, {
		onDidClick: onClick.event
	});
	let radioButton: azdata.RadioButtonComponent = Object.assign({}, componentBase, {
		onDidClick: onClick.event
	});
	const components: azdata.Component[] = [];
	let container = {
		clearItems: () => { },
		addItems: () => { },
		addItem: () => { },
		removeItem: () => true,
		insertItem: () => { },
		items: components,
		setLayout: () => { }
	};
	let form: azdata.FormContainer = Object.assign({}, componentBase, container, {
	});
	let textBuilder: azdata.ComponentBuilder<azdata.TextComponent> = {
		component: () => text,
		withProperties: () => textBuilder,
		withValidation: () => textBuilder
	};
	let buttonBuilder: azdata.ComponentBuilder<azdata.ButtonComponent> = {
		component: () => button,
		withProperties: () => buttonBuilder,
		withValidation: () => buttonBuilder
	};
	let radioButtonBuilder: azdata.ComponentBuilder<azdata.ButtonComponent> = {
		component: () => radioButton,
		withProperties: () => radioButtonBuilder,
		withValidation: () => radioButtonBuilder
	};
	let dropdown: () => azdata.DropDownComponent = () => Object.assign({}, componentBase, {
		onValueChanged: onClick.event,
		value: {
			name: '',
			displayName: ''
		},
		values: []
	});
	let declarativeTable: () => azdata.DeclarativeTableComponent = () => Object.assign({}, componentBase, {
		onDataChanged: undefined!,
		data: [],
		columns: []
	});

	let loadingComponent: () => azdata.LoadingComponent = () => Object.assign({}, componentBase, {
		loading: false,
		component: undefined!
	});

	let declarativeTableBuilder: azdata.ComponentBuilder<azdata.DeclarativeTableComponent> = {
		component: () => declarativeTable(),
		withProperties: () => declarativeTableBuilder,
		withValidation: () => declarativeTableBuilder
	};

	let loadingBuilder: azdata.LoadingComponentBuilder = {
		component: () => loadingComponent(),
		withProperties: () => loadingBuilder,
		withValidation: () => loadingBuilder,
		withItem: () => loadingBuilder
	};

	let formBuilder: azdata.FormBuilder = Object.assign({}, {
		component: () => form,
		addFormItem: () => { },
		insertFormItem: () => { },
		removeFormItem: () => true,
		addFormItems: () => { },
		withFormItems: () => formBuilder,
		withProperties: () => formBuilder,
		withValidation: () => formBuilder,
		withItems: () => formBuilder,
		withLayout: () => formBuilder
	});
	let dropdownBuilder: azdata.ComponentBuilder<azdata.DropDownComponent> = {
		component: () => {
			let r = dropdown();
			return r;
		},
		withProperties: () => dropdownBuilder,
		withValidation: () => dropdownBuilder
	};

	let view: azdata.ModelView = {
		onClosed: undefined!,
		connection: undefined!,
		serverInfo: undefined!,
		valid: true,
		onValidityChanged: undefined!,
		validate: undefined!,
		initializeModel: () => { return Promise.resolve(); },
		modelBuilder: <azdata.ModelBuilder>{
			radioButton: () => radioButtonBuilder,
			text: () => textBuilder,
			button: () => buttonBuilder,
			dropDown: () => dropdownBuilder,
			declarativeTable: () => declarativeTableBuilder,
			formContainer: () => formBuilder,
			loadingComponent: () => loadingBuilder
		}
	};

	return {
		view: view,
		onClick: onClick,
	};
}

interface TestContext {
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
}
