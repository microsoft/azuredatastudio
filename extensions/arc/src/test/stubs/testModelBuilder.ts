/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { TestInputBox } from './testInputBox';
import { TestComponentBuilder } from './testComponentBuilder';
import { TestFormBuilder } from './testFormBuilder';
import { TestCheckbox } from './testCheckbox';

export class TestModelBuilder implements azdata.ModelBuilder {

	///###############################
	// # ModelBuilder Implementation #
	// ###############################

	navContainer(): azdata.ContainerBuilder<azdata.NavContainer, any, any> {
		throw new Error('Method not implemented.');
	}
	divContainer(): azdata.DivBuilder {
		throw new Error('Method not implemented.');
	}
	flexContainer(): azdata.FlexBuilder {
		throw new Error('Method not implemented.');
	}
	splitViewContainer(): azdata.SplitViewBuilder {
		throw new Error('Method not implemented.');
	}
	dom(): azdata.ComponentBuilder<azdata.DomComponent> {
		throw new Error('Method not implemented.');
	}
	card(): azdata.ComponentBuilder<azdata.CardComponent> {
		throw new Error('Method not implemented.');
	}
	inputBox(): azdata.ComponentBuilder<azdata.InputBoxComponent> {
		return new TestComponentBuilder<azdata.InputBoxComponent>(new TestInputBox());
	}
	checkBox(): azdata.ComponentBuilder<azdata.CheckBoxComponent> {
		return new TestComponentBuilder<azdata.CheckBoxComponent>(new TestCheckbox());
	}
	radioButton(): azdata.ComponentBuilder<azdata.RadioButtonComponent> {
		throw new Error('Method not implemented.');
	}
	webView(): azdata.ComponentBuilder<azdata.WebViewComponent> {
		throw new Error('Method not implemented.');
	}
	editor(): azdata.ComponentBuilder<azdata.EditorComponent> {
		throw new Error('Method not implemented.');
	}
	diffeditor(): azdata.ComponentBuilder<azdata.DiffEditorComponent> {
		throw new Error('Method not implemented.');
	}
	text(): azdata.ComponentBuilder<azdata.TextComponent> {
		throw new Error('Method not implemented.');
	}
	image(): azdata.ComponentBuilder<azdata.ImageComponent> {
		throw new Error('Method not implemented.');
	}
	button(): azdata.ComponentBuilder<azdata.ButtonComponent> {
		throw new Error('Method not implemented.');
	}
	dropDown(): azdata.ComponentBuilder<azdata.DropDownComponent> {
		throw new Error('Method not implemented.');
	}
	tree<T>(): azdata.ComponentBuilder<azdata.TreeComponent<T>> {
		throw new Error('Method not implemented.');
	}
	listBox(): azdata.ComponentBuilder<azdata.ListBoxComponent> {
		throw new Error('Method not implemented.');
	}
	table(): azdata.ComponentBuilder<azdata.TableComponent> {
		throw new Error('Method not implemented.');
	}
	declarativeTable(): azdata.ComponentBuilder<azdata.DeclarativeTableComponent> {
		throw new Error('Method not implemented.');
	}
	dashboardWidget(_widgetId: string): azdata.ComponentBuilder<azdata.DashboardWidgetComponent> {
		throw new Error('Method not implemented.');
	}
	dashboardWebview(_webviewId: string): azdata.ComponentBuilder<azdata.DashboardWebviewComponent> {
		throw new Error('Method not implemented.');
	}
	formContainer(): azdata.FormBuilder {
		// Don't need the actual component currently so just force it to undefined
		return new TestFormBuilder(undefined!);
	}
	groupContainer(): azdata.GroupBuilder {
		throw new Error('Method not implemented.');
	}
	toolbarContainer(): azdata.ToolbarBuilder {
		throw new Error('Method not implemented.');
	}
	loadingComponent(): azdata.LoadingComponentBuilder {
		throw new Error('Method not implemented.');
	}
	fileBrowserTree(): azdata.ComponentBuilder<azdata.FileBrowserTreeComponent> {
		throw new Error('Method not implemented.');
	}
	hyperlink(): azdata.ComponentBuilder<azdata.HyperlinkComponent> {
		throw new Error('Method not implemented.');
	}
	radioCardGroup(): azdata.ComponentBuilder<azdata.RadioCardGroupComponent> {
		throw new Error('Method not implemented.');
	}
	tabbedPanel(): azdata.TabbedPanelComponentBuilder {
		throw new Error('Method not implemented.');
	}
	separator(): azdata.ComponentBuilder<azdata.SeparatorComponent> {
		throw new Error('Method not implemented.');
	}
	propertiesContainer(): azdata.ComponentBuilder<azdata.PropertiesContainerComponent> {
		throw new Error('Method not implemented.');
	}
}
