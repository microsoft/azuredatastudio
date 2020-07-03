/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as azdata from 'azdata';

export interface TestContext {
	context: vscode.ExtensionContext;
	view: azdata.ModelView;
}

export function createContext(): TestContext {
	let extensionPath = path.join(__dirname, '..', '..');
	let viewContext = createViewContext();
	return {
		context: {
			subscriptions: [],
			workspaceState: {
				get: () => { return Promise.resolve(); },
				update: () => { return Promise.resolve(); }
			},
			globalState: {
				get: () => { return Promise.resolve(); },
				update: () => { return Promise.resolve(); }
			},
			extensionPath: extensionPath,
			asAbsolutePath: () => { return ''; },
			storagePath: '',
			globalStoragePath: '',
			logPath: '',
			extensionUri: vscode.Uri.parse(''),
			environmentVariableCollection: undefined as any,
			extensionMode: undefined as any
		},
		view: viewContext.view
	};
}

export interface ViewTestContext {
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
}

export function createViewContext(): ViewTestContext {
	let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

	let componentBase: azdata.Component = {
		id: '',
		updateProperties: () => Promise.resolve(),
		updateProperty: () => Promise.resolve(),
		updateCssStyles: undefined!,
		onValidityChanged: undefined!,
		valid: true,
		validate: undefined!,
		focus: () => Promise.resolve()
	};
	let button: azdata.ButtonComponent = Object.assign({}, componentBase, {
		onDidClick: onClick.event
	});
	let radioButton: azdata.RadioButtonComponent = Object.assign({}, componentBase, {
		checked: false,
		onDidClick: onClick.event,
	});
	let checkbox: azdata.CheckBoxComponent = Object.assign({}, componentBase, {
		checked: true,
		onChanged: onClick.event
	});
	let container = {
		clearItems: () => { },
		addItems: () => { },
		addItem: () => { },
		removeItem: () => true,
		insertItem: () => { },
		items: [] as any[],
		setLayout: () => { },
		setItemLayout: () => { }
	};
	let form: azdata.FormContainer = Object.assign({}, componentBase, container, {
	});
	let flex: azdata.FlexContainer = Object.assign({}, componentBase, container, {
	});
	let div: azdata.DivContainer = Object.assign({}, componentBase, container, {
		onDidClick: onClick.event
	});

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
	let checkBoxBuilder: azdata.ComponentBuilder<azdata.CheckBoxComponent> = {
		component: () => checkbox,
		withProperties: () => checkBoxBuilder,
		withValidation: () => checkBoxBuilder
	};
	let inputBox: () => azdata.InputBoxComponent = () => Object.assign({}, componentBase, {
		onTextChanged: onClick.event!,
		onEnterKeyPressed: undefined!,
		value: ''
	});
	let dropdown: () => azdata.DropDownComponent = () => Object.assign({}, componentBase, {
		onValueChanged: onClick.event,
		value: {
			name: '',
			displayName: ''
		},
		values: []
	});

	let table: () => azdata.TableComponent = () => Object.assign({}, componentBase, {
		data: [] as any[][],
		columns: [] as string[],
		onRowSelected: onClick.event,
	});

	let loadingComponent: () => azdata.LoadingComponent = () => Object.assign({}, componentBase, {
		loading: false,
		component: undefined!
	});

	let tableBuilder: azdata.ComponentBuilder<azdata.TableComponent> = {
		component: () => table(),
		withProperties: () => tableBuilder,
		withValidation: () => tableBuilder
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

	let flexBuilder: azdata.FlexBuilder = Object.assign({}, {
		component: () => flex,
		withProperties: () => flexBuilder,
		withValidation: () => flexBuilder,
		withItems: () => flexBuilder,
		withLayout: () => flexBuilder
	});
	let divBuilder: azdata.DivBuilder = Object.assign({}, {
		component: () => div,
		withProperties: () => divBuilder,
		withValidation: () => divBuilder,
		withItems: () => divBuilder,
		withLayout: () => divBuilder
	});

	let inputBoxBuilder: azdata.ComponentBuilder<azdata.InputBoxComponent> = {
		component: () => {
			let r = inputBox();
			return r;
		},
		withProperties: () => inputBoxBuilder,
		withValidation: () => inputBoxBuilder
	};

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
		modelBuilder: {
			radioCardGroup: undefined!,
			navContainer: undefined!,
			divContainer: () => divBuilder,
			flexContainer: () => flexBuilder,
			splitViewContainer: undefined!,
			dom: undefined!,
			card: () => undefined!,
			inputBox: () => inputBoxBuilder,
			checkBox: () => checkBoxBuilder!,
			radioButton: () => radioButtonBuilder,
			webView: undefined!,
			editor: undefined!,
			diffeditor: undefined!,
			text: () => inputBoxBuilder,
			image: () => undefined!,
			button: () => buttonBuilder,
			dropDown: () => dropdownBuilder,
			tree: undefined!,
			listBox: undefined!,
			table: () => tableBuilder,
			declarativeTable: () => undefined!,
			dashboardWidget: undefined!,
			dashboardWebview: undefined!,
			formContainer: () => formBuilder,
			groupContainer: () => undefined!,
			toolbarContainer: undefined!,
			loadingComponent: () => loadingBuilder,
			fileBrowserTree: undefined!,
			hyperlink: () => undefined!,
			tabbedPanel: undefined!,
			separator: undefined!,
			propertiesContainer: undefined!
		}
	};
	return {
		view: view,
		onClick: onClick,
	};
}

