/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as loc from './../localizedConstants';

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
				get: () => { return undefined; },
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
	compareButtonOnClick: vscode.EventEmitter<any>;
	selectButtonOnClick: vscode.EventEmitter<any>;
	switchDirectionButtonOnClick: vscode.EventEmitter<any>;
	cancelCompareButtonOnClick: vscode.EventEmitter<any>;
	generateScriptButtonOnClick: vscode.EventEmitter<any>;
}

export function createViewContext(): ViewTestContext {
	let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onTextChanged: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onValueChanged: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let compareButtonOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let selectButtonOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let switchDirectionButtonOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let cancelCompareButtonOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let generateScriptButtonOnClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onChangeCheckedState: vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();

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

	let button = () => {
		let button: azdata.ButtonComponent = Object.assign({}, componentBase, {
			name: '',
			label: '',
			onDidClick: onClick.event
		});
		return button;
	};
	let buttonBuilder = () => {
		let b = button();
		let builder: azdata.ComponentBuilder<azdata.ButtonComponent, azdata.ButtonProperties> = {
			component: () => b,
			withProperties: (properties: any) => {
				if ((properties as any).label === loc.compare) {
					b.label = loc.compare;
					b.onDidClick = compareButtonOnClick.event;
				} else if ((properties as any).label === '•••') {
					b.label = '•••';
					b.onDidClick = selectButtonOnClick.event;
				} else if ((properties as any).label === loc.switchDirection) {
					b.label = loc.switchDirection;
					b.onDidClick = switchDirectionButtonOnClick.event;
				} else if ((properties as any).label === loc.stop) {
					b.label = loc.stop;
					b.onDidClick = cancelCompareButtonOnClick.event;
				} else if ((properties as any).label === loc.generateScript) {
					b.label = loc.generateScript;
					b.onDidClick = generateScriptButtonOnClick.event;
				}
				return builder;
			},
			withProps: (properties) => {
				if ((properties as any).label === loc.compare) {
					b.label = loc.compare;
					b.onDidClick = compareButtonOnClick.event;
				} else if ((properties as any).label === '•••') {
					b.label = '•••';
					b.onDidClick = selectButtonOnClick.event;
				} else if ((properties as any).label === loc.switchDirection) {
					b.label = loc.switchDirection;
					b.onDidClick = switchDirectionButtonOnClick.event;
				} else if ((properties as any).label === loc.stop) {
					b.label = loc.stop;
					b.onDidClick = cancelCompareButtonOnClick.event;
				} else if ((properties as any).label === loc.generateScript) {
					b.label = loc.generateScript;
					b.onDidClick = generateScriptButtonOnClick.event;
				}
				return builder;
			},
			withValidation: () => builder
		};
		return builder;
	};

	let radioButton: azdata.RadioButtonComponent = Object.assign({}, componentBase, {
		checked: false,
		onDidClick: onClick.event,
		onDidChangeCheckedState: onChangeCheckedState.event
	});
	let radioButtonBuilder: azdata.ComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties> = {
		component: () => radioButton,
		withProperties: () => radioButtonBuilder,
		withProps: () => radioButtonBuilder,
		withValidation: () => radioButtonBuilder
	};

	let checkbox: azdata.CheckBoxComponent = Object.assign({}, componentBase, {
		checked: true,
		onChanged: onClick.event
	});
	let checkBoxBuilder: azdata.ComponentBuilder<azdata.CheckBoxComponent, azdata.CheckBoxProperties> = {
		component: () => checkbox,
		withProperties: () => checkBoxBuilder,
		withProps: () => checkBoxBuilder,
		withValidation: () => checkBoxBuilder
	};

	let form: azdata.FormContainer = Object.assign({}, componentBase, container, {
	});
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

	let toolbar: azdata.ToolbarContainer = Object.assign({}, componentBase, container, {
	});
	let toolbarBuilder: azdata.ToolbarBuilder = Object.assign({}, {
		component: () => toolbar,
		withToolbarItems: () => toolbarBuilder,
		addToolbarItems: () => { },
		addToolbarItem: () => { },
		withProperties: () => toolbarBuilder,
		withValidation: () => toolbarBuilder,
		withItems: () => toolbarBuilder,
		withLayout: () => toolbarBuilder,
		withProps: () => toolbarBuilder
	});

	let flex: azdata.FlexContainer = Object.assign({}, componentBase, container, {
	});
	let flexBuilder: azdata.FlexBuilder = Object.assign({}, {
		component: () => flex,
		withProperties: () => flexBuilder,
		withValidation: () => flexBuilder,
		withItems: () => flexBuilder,
		withLayout: () => flexBuilder,
		withProps: () => flexBuilder
	});

	let div: azdata.DivContainer = Object.assign({}, componentBase, container, {
		onDidClick: onClick.event
	});
	let divBuilder: azdata.DivBuilder = Object.assign({}, {
		component: () => div,
		withProperties: () => divBuilder,
		withValidation: () => divBuilder,
		withItems: () => divBuilder,
		withLayout: () => divBuilder,
		withProps: () => divBuilder
	});

	let splitView: azdata.SplitViewContainer = Object.assign({}, componentBase, container, {
		onDidClick: onClick.event
	});
	let splitViewBuilder: azdata.SplitViewBuilder = Object.assign({}, {
		component: () => splitView,
		withProperties: () => splitViewBuilder,
		withValidation: () => splitViewBuilder,
		withItems: () => splitViewBuilder,
		withLayout: () => splitViewBuilder,
		withProps: () => splitViewBuilder
	});

	let diffEditor: () => azdata.DiffEditorComponent = () => Object.assign({}, componentBase, {
		contentLeft: '',
		contentRight: '',
		languageMode: '',
		editorUriLeft: '',
		editorUriRight: '',
		onContentChanged: onClick.event,
		onEditorCreated: onClick.event,
		isAutoResizable: false,
		minimumHeight: 0,
		title: ''
	});
	let diffEditorBuilder: azdata.ComponentBuilder<azdata.DiffEditorComponent, azdata.DiffEditorComponent> = {
		component: () => diffEditor(),
		withProperties: () => diffEditorBuilder,
		withValidation: () => diffEditorBuilder,
		withProps: () => diffEditorBuilder
	};

	let inputBox: () => azdata.InputBoxComponent = () => Object.assign({}, componentBase, {
		onTextChanged: onTextChanged.event,
		onEnterKeyPressed: onClick.event,
		value: ''
	});
	let inputBoxBuilder: azdata.ComponentBuilder<azdata.InputBoxComponent, azdata.InputBoxProperties> = {
		component: () => {
			let r = inputBox();
			return r;
		},
		withProperties: () => inputBoxBuilder,
		withProps: () => inputBoxBuilder,
		withValidation: () => inputBoxBuilder
	};

	let dropdown: () => azdata.DropDownComponent = () => Object.assign({}, componentBase, {
		onValueChanged: onValueChanged.event,
		value: {
			name: '',
			displayName: ''
		},
		values: []
	});
	let dropdownBuilder: azdata.ComponentBuilder<azdata.DropDownComponent, azdata.DropDownProperties> = {
		component: () => {
			let r = dropdown();
			return r;
		},
		withProperties: () => dropdownBuilder,
		withProps: () => dropdownBuilder,
		withValidation: () => dropdownBuilder
	};

	let table: () => azdata.TableComponent = () => Object.assign({}, componentBase, {
		data: [] as any[][],
		columns: [] as string[],
		onRowSelected: onClick.event,
		onCellAction: onClick.event,
		appendData: (data: any[][]) => undefined
	});
	let tableBuilder: azdata.ComponentBuilder<azdata.TableComponent, azdata.TableComponentProperties> = {
		component: () => table(),
		withProperties: () => tableBuilder,
		withProps: () => tableBuilder,
		withValidation: () => tableBuilder
	};

	let loadingComponent: () => azdata.LoadingComponent = () => Object.assign({}, componentBase, {
		loading: false,
		component: undefined!
	});
	let loadingBuilder: azdata.LoadingComponentBuilder = {
		component: () => loadingComponent(),
		withProperties: () => loadingBuilder,
		withProps: () => loadingBuilder,
		withValidation: () => loadingBuilder,
		withItem: () => loadingBuilder
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
			splitViewContainer: () => splitViewBuilder,
			card: () => undefined!,
			inputBox: () => inputBoxBuilder,
			checkBox: () => checkBoxBuilder!,
			radioButton: () => radioButtonBuilder,
			webView: undefined!,
			editor: undefined!,
			diffeditor: () => diffEditorBuilder,
			text: () => inputBoxBuilder,
			image: () => undefined!,
			button: () => buttonBuilder(),
			dropDown: () => dropdownBuilder,
			tree: undefined!,
			listBox: undefined!,
			table: () => tableBuilder,
			declarativeTable: () => undefined!,
			dashboardWidget: undefined!,
			dashboardWebview: undefined!,
			formContainer: () => formBuilder,
			groupContainer: () => undefined!,
			toolbarContainer: () => toolbarBuilder,
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
		compareButtonOnClick: compareButtonOnClick,
		selectButtonOnClick: selectButtonOnClick,
		switchDirectionButtonOnClick: switchDirectionButtonOnClick,
		cancelCompareButtonOnClick: cancelCompareButtonOnClick,
		generateScriptButtonOnClick: generateScriptButtonOnClick,
	};
}
