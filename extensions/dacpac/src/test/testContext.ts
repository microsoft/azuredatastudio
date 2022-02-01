/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as azdata from 'azdata';
import * as loc from '../localizedConstants';

export interface TestContext {
	context: vscode.ExtensionContext;
	viewContext: ViewTestContext;
}

export function createContext(): TestContext {
	let extensionPath = path.join(__dirname, '..', '..');
	let viewContext = createViewContext();
	return {
		context: {
			subscriptions: [],
			workspaceState: {
				get: () => { return Promise.resolve(); },
				update: () => { return Promise.resolve(); },
				keys: () => []
			},
			globalState: {
				setKeysForSync: (): void => { },
				get: (): any | undefined => { return Promise.resolve(); },
				update: (): Thenable<void> => { return Promise.resolve(); },
				keys: () => []
			},
			extensionPath: extensionPath,
			asAbsolutePath: () => { return ''; },
			storagePath: '',
			globalStoragePath: '',
			logPath: '',
			extensionUri: vscode.Uri.parse(''),
			environmentVariableCollection: undefined as any,
			extensionMode: undefined as any,
			globalStorageUri: undefined,
			logUri: undefined,
			storageUri: undefined,
			secrets: undefined,
			extension: undefined
		},
		viewContext: viewContext
	};
}

export interface ViewTestContext {
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
	onTextChanged: vscode.EventEmitter<any>;
	onValueChanged: vscode.EventEmitter<any>;
	newDatabaseRadioOnClick: vscode.EventEmitter<any>;
	updateExistingRadioOnClick: vscode.EventEmitter<any>;
	deployOnClick: vscode.EventEmitter<any>,
	extractOnClick: vscode.EventEmitter<any>,
	exportOnClick: vscode.EventEmitter<any>,
	importOnClick: vscode.EventEmitter<any>,
	fileButtonOnClick: vscode.EventEmitter<any>;
}

export function createViewContext(): ViewTestContext {
	let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onTextChanged: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onValueChanged: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let newDatabaseRadioOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let updateExistingRadioOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let deployOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let extractOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let exportOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let importOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let fileButtonOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

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
	let radioButton = () => {
		let button: azdata.RadioButtonComponent = Object.assign({}, componentBase, {
			name: '',
			label: '',
			checked: false,
			onDidClick: onClick.event,
			onDidChangeCheckedState: onValueChanged.event
		});
		return button;
	};
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

	let buttonBuilder: azdata.ComponentBuilder<azdata.ButtonComponent, azdata.ButtonProperties> = {
		component: () => button,
		withProperties: (properties: any) => {
			if ((properties as any).title === loc.selectFile) {
				button.onDidClick = fileButtonOnClick.event;
			}
			return buttonBuilder;
		},
		withProps: (properties) => {
			if ((properties as any).title === loc.selectFile) {
				button.onDidClick = fileButtonOnClick.event;
			}
			return buttonBuilder;
		},
		withValidation: () => buttonBuilder
	};

	let radioButtonBuilder = () => {
		let button = radioButton();
		let builder: azdata.ComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties> = {
			component: () => button,
			withProperties: () => undefined,
			withProps: (properties) => {
				switch ((properties as any).label) {
					case loc.newDatabase:
						button.label = loc.newDatabase;
						button.onDidClick = newDatabaseRadioOnClick.event;
						break;
					case loc.upgradeExistingDatabase:
						button.label = loc.upgradeExistingDatabase;
						button.onDidClick = updateExistingRadioOnClick.event;
						break;
					case loc.deployDescription:
						button.label = loc.deployDescription;
						button.onDidClick = deployOnClick.event;
						break;
					case loc.exportDescription:
						button.label = loc.exportDescription;
						button.onDidClick = exportOnClick.event;
						break;
					case loc.extractDescription:
						button.label = loc.extractDescription;
						button.onDidClick = extractOnClick.event;
						break;
					case loc.importDescription:
						button.label = loc.importDescription;
						button.onDidClick = importOnClick.event;
						break;
				}
				return builder;
			},
			withValidation: () => builder
		};
		return builder;
	};

	let checkBoxBuilder: azdata.ComponentBuilder<azdata.CheckBoxComponent, azdata.CheckBoxProperties> = {
		component: () => checkbox,
		withProperties: () => checkBoxBuilder,
		withProps: () => checkBoxBuilder,
		withValidation: () => checkBoxBuilder
	};
	let inputBox: () => azdata.InputBoxComponent = () => Object.assign({}, componentBase, {
		onTextChanged: onTextChanged.event,
		onEnterKeyPressed: onClick.event,
		value: ''
	});
	let dropdown: () => azdata.DropDownComponent = () => Object.assign({}, componentBase, {
		onValueChanged: onValueChanged.event,
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
		appendData: (data: any[][]) => undefined,
	});

	let loadingComponent: () => azdata.LoadingComponent = () => Object.assign({}, componentBase, {
		loading: false,
		component: undefined!
	});

	let tableBuilder: azdata.ComponentBuilder<azdata.TableComponent, azdata.TableComponentProperties> = {
		component: () => table(),
		withProperties: () => tableBuilder,
		withValidation: () => tableBuilder,
		withProps: () => tableBuilder
	};

	let loadingBuilder: azdata.LoadingComponentBuilder = {
		component: () => loadingComponent(),
		withProperties: () => loadingBuilder,
		withValidation: () => loadingBuilder,
		withItem: () => loadingBuilder,
		withProps: () => loadingBuilder
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
		withLayout: () => formBuilder,
		withProps: () => formBuilder
	});

	let flexBuilder: azdata.FlexBuilder = Object.assign({}, {
		component: () => flex,
		withProperties: () => flexBuilder,
		withValidation: () => flexBuilder,
		withItems: () => flexBuilder,
		withLayout: () => flexBuilder,
		withProps: () => flexBuilder
	});

	let divBuilder: azdata.DivBuilder = Object.assign({}, {
		component: () => div,
		withProperties: () => divBuilder,
		withValidation: () => divBuilder,
		withItems: () => divBuilder,
		withLayout: () => divBuilder,
		withProps: () => divBuilder
	});

	let inputBoxBuilder: azdata.ComponentBuilder<azdata.InputBoxComponent, azdata.InputBoxProperties> = {
		component: () => {
			let r = inputBox();
			return r;
		},
		withProperties: () => inputBoxBuilder,
		withValidation: () => inputBoxBuilder,
		withProps: () => inputBoxBuilder
	};

	let dropdownBuilder: azdata.ComponentBuilder<azdata.DropDownComponent, azdata.DropDownProperties> = {
		component: () => {
			let r = dropdown();
			return r;
		},
		withProperties: () => dropdownBuilder,
		withValidation: () => dropdownBuilder,
		withProps: () => dropdownBuilder
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
			listView: undefined!,
			radioCardGroup: undefined!,
			navContainer: undefined!,
			divContainer: () => divBuilder,
			flexContainer: () => flexBuilder,
			splitViewContainer: undefined!,
			card: () => undefined!,
			inputBox: () => inputBoxBuilder,
			checkBox: () => checkBoxBuilder!,
			radioButton: () => radioButtonBuilder(),
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
			propertiesContainer: undefined!,
			infoBox: undefined!,
			slider: undefined!
		}
	};
	return {
		view: view,
		onClick: onClick,
		onTextChanged: onTextChanged,
		onValueChanged: onValueChanged,
		newDatabaseRadioOnClick: newDatabaseRadioOnClick,
		updateExistingRadioOnClick: updateExistingRadioOnClick,
		deployOnClick: deployOnClick,
		extractOnClick: extractOnClick,
		exportOnClick: exportOnClick,
		importOnClick: importOnClick,
		fileButtonOnClick: fileButtonOnClick
	};
}
