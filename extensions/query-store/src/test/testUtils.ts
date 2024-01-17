/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export interface TestContext {
	view: azdata.ModelView;
	component: azdata.Component
}

export function createViewContext(): TestContext {
	let componentBase: azdata.Component = {
		id: '',
		updateProperties: () => Promise.resolve(),
		updateProperty: () => Promise.resolve(),
		updateCssStyles: undefined!,
		onValidityChanged: undefined!,
		valid: true,
		validate: undefined!,
		focus: undefined!,
		dispose() { }
	};

	const components: azdata.Component[] = [];
	let container = {
		clearItems: () => { },
		addItems: () => { },
		addItem: () => { },
		removeItem: () => true,
		insertItem: () => { },
		items: components,
		setLayout: () => { },
		setItemLayout: () => { },
		updateCssStyles: () => { }
	};

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

	let split: azdata.SplitViewContainer = Object.assign({}, componentBase, container, {
	});

	let splitViewBuilder: azdata.SplitViewBuilder = Object.assign({}, {
		component: () => split,
		withProperties: () => splitViewBuilder,
		withValidation: () => splitViewBuilder,
		withItems: () => splitViewBuilder,
		withLayout: () => splitViewBuilder,
		withProps: () => splitViewBuilder
	});

	let view: azdata.ModelView = {
		onClosed: undefined!,
		connection: undefined!,
		serverInfo: undefined!,
		valid: true,
		onValidityChanged: undefined!,
		validate: undefined!,
		initializeModel: () => { return Promise.resolve(); },
		dispose() { },
		modelBuilder: {
			listView: undefined!,
			radioCardGroup: undefined!,
			chart: undefined!,
			navContainer: undefined!,
			divContainer: undefined!,
			flexContainer: () => flexBuilder,
			splitViewContainer: () => splitViewBuilder,
			card: undefined!,
			inputBox: () => undefined!,
			checkBox: undefined!,
			radioButton: () => undefined!,
			webView: undefined!,
			editor: undefined!,
			diffeditor: undefined!,
			text: () => undefined!,
			image: () => undefined!,
			button: () => undefined!,
			dropDown: () => undefined!,
			tree: undefined!,
			listBox: undefined!,
			table: undefined!,
			declarativeTable: () => undefined!,
			dashboardWidget: undefined!,
			dashboardWebview: undefined!,
			formContainer: () => undefined!,
			groupContainer: undefined!,
			toolbarContainer: undefined!,
			loadingComponent: () => undefined!,
			fileBrowserTree: undefined!,
			hyperlink: undefined!,
			tabbedPanel: undefined!,
			separator: undefined!,
			propertiesContainer: undefined!,
			infoBox: undefined!,
			slider: undefined!,
			executionPlan: undefined!,
		}
	};

	return {
		view: view,
		component: componentBase
	};
}
