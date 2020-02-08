/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../../common/apiWrapper';
import { LanguageViewBase } from '../../../views/externalLanguages/languageViewBase';
import * as mssql from '../../../../../mssql/src/mssql';
import { LanguageService } from '../../../externalLanguage/languageService';

export interface TestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	view: azdata.ModelView;
	languageExtensionService: mssql.ILanguageExtensionService;
	onClick: vscode.EventEmitter<any>;
	dialogModel: TypeMoq.IMock<LanguageService>;
}

export class ParentDialog extends LanguageViewBase {
	public reset(): Promise<void> {
		return Promise.resolve();
	}
	constructor(
		apiWrapper: ApiWrapper) {
		super(apiWrapper, '');
	}
}

export function createContext(): TestContext {
	let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

	let apiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
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
	let button: azdata.ButtonComponent = Object.assign({}, componentBase, {
		onDidClick: onClick.event
	});
	let radioButton: azdata.RadioButtonComponent = Object.assign({}, componentBase, {
		onDidClick: onClick.event
	});
	let container = {
		clearItems: () => { },
		addItems: () => { },
		addItem: () => { },
		removeItem: () => true,
		insertItem: () => { },
		items: [],
		setLayout: () => { }
	};
	let form: azdata.FormContainer = Object.assign({}, componentBase, container, {
	});
	let flex: azdata.FlexContainer = Object.assign({}, componentBase, container, {
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
	let inputBox: () => azdata.InputBoxComponent = () => Object.assign({}, componentBase, {
		onTextChanged: undefined!,
		onEnterKeyPressed: undefined!,
		value: ''
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

	let flexBuilder: azdata.FlexBuilder = Object.assign({}, {
		component: () => flex,
		withProperties: () => flexBuilder,
		withValidation: () => flexBuilder,
		withItems: () => flexBuilder,
		withLayout: () => flexBuilder
	});

	let inputBoxBuilder: azdata.ComponentBuilder<azdata.InputBoxComponent> = {
		component: () => {
			let r = inputBox();
			return r;
		},
		withProperties: () => inputBoxBuilder,
		withValidation: () => inputBoxBuilder
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
			divContainer: undefined!,
			flexContainer: () => flexBuilder,
			splitViewContainer: undefined!,
			dom: undefined!,
			card: undefined!,
			inputBox: () => inputBoxBuilder,
			checkBox: undefined!,
			radioButton: () => radioButtonBuilder,
			webView: undefined!,
			editor: undefined!,
			diffeditor: undefined!,
			text: () => inputBoxBuilder,
			image: undefined!,
			button: () => buttonBuilder,
			dropDown: undefined!,
			tree: undefined!,
			listBox: undefined!,
			table: undefined!,
			declarativeTable: () => declarativeTableBuilder,
			dashboardWidget: undefined!,
			dashboardWebview: undefined!,
			formContainer: () => formBuilder,
			groupContainer: undefined!,
			toolbarContainer: undefined!,
			loadingComponent: () => loadingBuilder,
			fileBrowserTree: undefined!,
			hyperlink: undefined!
		}
	};
	let tab: azdata.window.DialogTab = {
		title: '',
		content: '',
		registerContent: async (handler) => {
			try {
				await handler(view);
			} catch (err) {
				console.log(err);
			}
		},
		onValidityChanged: undefined!,
		valid: true,
		modelView: undefined!
	};

	let dialogButton: azdata.window.Button = {
		label: '',
		enabled: true,
		hidden: false,
		onClick: onClick.event,

	};
	let dialogMessage: azdata.window.DialogMessage = {
		text: '',
	};
	let dialog: azdata.window.Dialog = {
		title: '',
		isWide: false,
		content: [],
		okButton: dialogButton,
		cancelButton: dialogButton,
		customButtons: [],
		message: dialogMessage,
		registerCloseValidator: () => { },
		registerOperation: () => { },
		onValidityChanged: new vscode.EventEmitter<boolean>().event,
		registerContent: () => { },
		modelView: undefined!,
		valid: true
	};
	apiWrapper.setup(x => x.createTab(TypeMoq.It.isAny())).returns(() => tab);
	apiWrapper.setup(x => x.createModelViewDialog(TypeMoq.It.isAny())).returns(() => dialog);
	apiWrapper.setup(x => x.openDialog(TypeMoq.It.isAny())).returns(() => { });
	let connection = new azdata.connection.ConnectionProfile();
	apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
	apiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny())).returns(() => { return Promise.resolve('connectionUrl'); });

	let languageExtensionService: mssql.ILanguageExtensionService = {
		listLanguages: () => { return Promise.resolve([]); },
		deleteLanguage: () => { return Promise.resolve(); },
		updateLanguage: () => { return Promise.resolve(); }
	};


	return {
		apiWrapper: apiWrapper,
		view: view,
		languageExtensionService: languageExtensionService,
		onClick: onClick,
		dialogModel: TypeMoq.Mock.ofType(LanguageService)
	};
}
