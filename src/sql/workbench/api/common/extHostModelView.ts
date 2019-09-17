/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import { URI } from 'vs/base/common/uri';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import { SqlMainContext, ExtHostModelViewShape, MainThreadModelViewShape, ExtHostModelViewTreeViewsShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape, IComponentEventArgs, ComponentEventType, ColumnSizingMode } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';

class ModelBuilderImpl implements azdata.ModelBuilder {
	private nextComponentId: number;
	private readonly _componentBuilders = new Map<string, ComponentBuilderImpl<any>>();

	constructor(
		private readonly _proxy: MainThreadModelViewShape,
		private readonly _handle: number,
		private readonly _mainContext: IMainContext,
		private readonly _extHostModelViewTree: ExtHostModelViewTreeViewsShape,
		private readonly _extension: IExtensionDescription
	) {
		this.nextComponentId = 0;
	}

	navContainer(): azdata.ContainerBuilder<azdata.NavContainer, any, any> {
		let id = this.getNextComponentId();
		let container: GenericContainerBuilder<azdata.NavContainer, any, any> = new GenericContainerBuilder(this._proxy, this._handle, ModelComponentTypes.NavContainer, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	divContainer(): azdata.DivBuilder {
		let id = this.getNextComponentId();
		let container = new DivContainerBuilder(this._proxy, this._handle, ModelComponentTypes.DivContainer, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	flexContainer(): azdata.FlexBuilder {
		let id = this.getNextComponentId();
		let container: GenericContainerBuilder<azdata.FlexContainer, any, any> = new GenericContainerBuilder<azdata.FlexContainer, azdata.FlexLayout, azdata.FlexItemLayout>(this._proxy, this._handle, ModelComponentTypes.FlexContainer, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	splitViewContainer(): azdata.SplitViewBuilder {
		let id = this.getNextComponentId();
		let container: GenericContainerBuilder<azdata.SplitViewContainer, any, any> = new GenericContainerBuilder<azdata.SplitViewContainer, azdata.SplitViewLayout, azdata.FlexItemLayout>(this._proxy, this._handle, ModelComponentTypes.SplitViewContainer, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	formContainer(): azdata.FormBuilder {
		let id = this.getNextComponentId();
		let container = new FormContainerBuilder(this._proxy, this._handle, ModelComponentTypes.Form, id, this);
		this._componentBuilders.set(id, container);
		return container;
	}

	toolbarContainer(): azdata.ToolbarBuilder {
		let id = this.getNextComponentId();
		let container = new ToolbarContainerBuilder(this._proxy, this._handle, ModelComponentTypes.Toolbar, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	groupContainer(): azdata.GroupBuilder {
		let id = this.getNextComponentId();
		let container: GenericContainerBuilder<azdata.GroupContainer, any, any> = new GenericContainerBuilder<azdata.GroupContainer, azdata.GroupLayout, azdata.GroupItemLayout>(this._proxy, this._handle, ModelComponentTypes.Group, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	card(): azdata.ComponentBuilder<azdata.CardComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.CardComponent> = this.getComponentBuilder(new CardWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	tree<T>(): azdata.ComponentBuilder<azdata.TreeComponent<T>> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.TreeComponent<T>> = this.getComponentBuilder(new TreeComponentWrapper(this._extHostModelViewTree, this._proxy, this._handle, id, this._extension), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	inputBox(): azdata.ComponentBuilder<azdata.InputBoxComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.InputBoxComponent> = this.getComponentBuilder(new InputBoxWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	text(): azdata.ComponentBuilder<azdata.TextComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.TextComponent> = this.getComponentBuilder(new TextComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	image(): azdata.ComponentBuilder<azdata.ImageComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.ImageComponent> = this.getComponentBuilder(new ImageComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	radioButton(): azdata.ComponentBuilder<azdata.RadioButtonComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.RadioButtonComponent> = this.getComponentBuilder(new RadioButtonWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	checkBox(): azdata.ComponentBuilder<azdata.CheckBoxComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.CheckBoxComponent> = this.getComponentBuilder(new CheckBoxWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	webView(): azdata.ComponentBuilder<azdata.WebViewComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.WebViewComponent> = this.getComponentBuilder(new WebViewWrapper(this._proxy, this._handle, id, this._extension.extensionLocation), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	editor(): azdata.ComponentBuilder<azdata.EditorComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.EditorComponent> = this.getComponentBuilder(new EditorWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	diffeditor(): azdata.ComponentBuilder<azdata.DiffEditorComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DiffEditorComponent> = this.getComponentBuilder(new DiffEditorWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	button(): azdata.ComponentBuilder<azdata.ButtonComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.ButtonComponent> = this.getComponentBuilder(new ButtonWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dropDown(): azdata.ComponentBuilder<azdata.DropDownComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DropDownComponent> = this.getComponentBuilder(new DropDownWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	listBox(): azdata.ComponentBuilder<azdata.ListBoxComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.ListBoxComponent> = this.getComponentBuilder(new ListBoxWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	table(): azdata.ComponentBuilder<azdata.TableComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.TableComponent> = this.getComponentBuilder(new TableComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	declarativeTable(): azdata.ComponentBuilder<azdata.DeclarativeTableComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DeclarativeTableComponent> = this.getComponentBuilder(new DeclarativeTableWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dashboardWidget(widgetId: string): azdata.ComponentBuilder<azdata.DashboardWidgetComponent> {
		let id = this.getNextComponentId();
		let builder = this.getComponentBuilder<azdata.DashboardWidgetComponent>(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWidget, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dashboardWebview(webviewId: string): azdata.ComponentBuilder<azdata.DashboardWebviewComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DashboardWebviewComponent> = this.getComponentBuilder(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWebview, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	loadingComponent(): azdata.LoadingComponentBuilder {
		let id = this.getNextComponentId();
		let builder = new LoadingComponentBuilder(new LoadingComponentWrapper(this._proxy, this._handle, id));
		this._componentBuilders.set(id, builder);
		return builder;
	}

	fileBrowserTree(): azdata.ComponentBuilder<azdata.FileBrowserTreeComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.FileBrowserTreeComponent> = this.getComponentBuilder(new FileBrowserTreeComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dom(): azdata.ComponentBuilder<azdata.DomComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DomComponent> = this.getComponentBuilder(new DomComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	hyperlink(): azdata.ComponentBuilder<azdata.HyperlinkComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.HyperlinkComponent> = this.getComponentBuilder(new HyperlinkComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	getComponentBuilder<T extends azdata.Component>(component: ComponentWrapper, id: string): ComponentBuilderImpl<T> {
		let componentBuilder: ComponentBuilderImpl<T> = new ComponentBuilderImpl<T>(component);
		this._componentBuilders.set(id, componentBuilder);
		return componentBuilder;
	}

	handleEvent(componentId: string, eventArgs: IComponentEventArgs): void {
		let eventHandler = this._componentBuilders.get(componentId);
		if (eventHandler) {
			eventHandler.handleEvent(eventArgs);
		}
	}

	public runCustomValidations(componentId: string): boolean {
		let component = this._componentBuilders.get(componentId).componentWrapper();
		return component.runCustomValidations();
	}

	private getNextComponentId(): string {
		return `component${this._handle}_${this.nextComponentId++}`;
	}
}

interface IWithEventHandler {
	handleEvent(eventArgs: IComponentEventArgs): void;
}

class ComponentBuilderImpl<T extends azdata.Component> implements azdata.ComponentBuilder<T>, IWithEventHandler {

	constructor(protected _component: ComponentWrapper) {
		_component.registerEvent();
	}

	component(): T {
		return <T><any>this._component;
	}

	componentWrapper(): ComponentWrapper {
		return this._component;
	}

	withProperties<U>(properties: U): azdata.ComponentBuilder<T> {
		// Keep any properties that may have been set during initial object construction
		this._component.properties = Object.assign({}, this._component.properties, properties);
		return this;
	}

	withValidation(validation: (component: T) => boolean): azdata.ComponentBuilder<T> {
		this._component.customValidations.push(validation);
		return this;
	}

	handleEvent(eventArgs: IComponentEventArgs) {
		this._component.onEvent(eventArgs);
	}
}

class ContainerBuilderImpl<T extends azdata.Component, TLayout, TItemLayout> extends ComponentBuilderImpl<T> implements azdata.ContainerBuilder<T, TLayout, TItemLayout> {
	constructor(componentWrapper: ComponentWrapper) {
		super(componentWrapper);
	}

	withLayout(layout: TLayout): azdata.ContainerBuilder<T, TLayout, TItemLayout> {
		this._component.layout = layout;
		return this;
	}

	withItems(components: azdata.Component[], itemLayout?: TItemLayout): azdata.ContainerBuilder<T, TLayout, TItemLayout> {
		this._component.itemConfigs = components.map(item => {
			let componentWrapper = item as ComponentWrapper;
			return new InternalItemConfig(componentWrapper, itemLayout);
		});
		return this;
	}
}

class GenericContainerBuilder<T extends azdata.Component, TLayout, TItemLayout> extends ContainerBuilderImpl<T, TLayout, TItemLayout> {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string) {
		super(new ComponentWrapper(proxy, handle, type, id));
	}
}

class DivContainerBuilder extends ContainerBuilderImpl<azdata.DivContainer, azdata.DivLayout, azdata.DivItemLayout> {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string) {
		super(new DivContainerWrapper(proxy, handle, type, id));
	}
}

class FormContainerBuilder extends GenericContainerBuilder<azdata.FormContainer, azdata.FormLayout, azdata.FormItemLayout> implements azdata.FormBuilder {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, private _builder: ModelBuilderImpl) {
		super(proxy, handle, type, id);
	}

	withFormItems(components: (azdata.FormComponent | azdata.FormComponentGroup)[], itemLayout?: azdata.FormItemLayout): azdata.FormBuilder {
		this.addFormItems(components, itemLayout);
		return this;
	}

	private convertToItemConfig(formComponent: azdata.FormComponent, itemLayout?: azdata.FormItemLayout): InternalItemConfig {
		let componentWrapper = formComponent.component as ComponentWrapper;
		if (formComponent.required && componentWrapper) {
			componentWrapper.required = true;
		}
		let actions: string[] = undefined;
		if (formComponent.actions) {
			actions = formComponent.actions.map(action => {
				let actionComponentWrapper = action as ComponentWrapper;
				return actionComponentWrapper.id;
			});
		}

		return new InternalItemConfig(componentWrapper, Object.assign({}, itemLayout, {
			title: formComponent.title,
			actions: actions,
			isFormComponent: true,
			required: componentWrapper.required
		}));
	}

	private addComponentActions(formComponent: azdata.FormComponent, itemLayout?: azdata.FormItemLayout): void {
		if (formComponent.actions) {
			formComponent.actions.forEach(component => {
				let componentWrapper = component as ComponentWrapper;
				this._component.addItem(componentWrapper, itemLayout);
			});
		}
	}

	private removeComponentActions(formComponent: azdata.FormComponent): void {
		if (formComponent.actions) {
			formComponent.actions.forEach(component => {
				let componentWrapper = component as ComponentWrapper;
				this._component.removeItem(componentWrapper);
			});
		}
	}

	addFormItems(formComponents: Array<azdata.FormComponent | azdata.FormComponentGroup>, itemLayout?: azdata.FormItemLayout): void {
		formComponents.forEach(formComponent => {
			this.addFormItem(formComponent, itemLayout);
		});
	}

	addFormItem(formComponent: azdata.FormComponent | azdata.FormComponentGroup, itemLayout?: azdata.FormItemLayout): void {
		this.insertFormItem(formComponent, undefined, itemLayout);
	}

	insertFormItem(formComponent: azdata.FormComponent | azdata.FormComponentGroup, index?: number, itemLayout?: azdata.FormItemLayout): void {
		let componentGroup = formComponent as azdata.FormComponentGroup;
		if (componentGroup && componentGroup.components !== undefined) {
			let labelComponent = this._builder.text().component();
			labelComponent.value = componentGroup.title;
			this._component.addItem(labelComponent, { isGroupLabel: true }, index);
			let componentIndex = index ? index + 1 : undefined;
			componentGroup.components.forEach(component => {
				let layout = component.layout || itemLayout;
				let itemConfig = this.convertToItemConfig(component, layout);
				itemConfig.config.isInGroup = true;
				this._component.insertItem(component.component as ComponentWrapper, componentIndex, itemConfig.config);
				if (componentIndex) {
					componentIndex++;
				}
				this.addComponentActions(component, layout);
			});
		} else {
			formComponent = formComponent as azdata.FormComponent;
			let itemImpl = this.convertToItemConfig(formComponent, itemLayout);
			this._component.addItem(formComponent.component as ComponentWrapper, itemImpl.config, index);
			this.addComponentActions(formComponent, itemLayout);
		}
	}

	removeFormItem(formComponent: azdata.FormComponent | azdata.FormComponentGroup): boolean {
		let componentGroup = formComponent as azdata.FormComponentGroup;
		let result: boolean = false;
		if (componentGroup && componentGroup.components !== undefined) {
			let firstComponent = componentGroup.components[0];
			let index = this._component.itemConfigs.findIndex(x => x.component.id === firstComponent.component.id);
			if (index) {
				result = this._component.removeItemAt(index - 1);
			}
			componentGroup.components.forEach(element => {
				this.removeComponentActions(element);
				this._component.removeItem(element.component);
			});
		} else {
			formComponent = formComponent as azdata.FormComponent;
			if (formComponent) {
				result = this._component.removeItem(formComponent.component as ComponentWrapper);
				this.removeComponentActions(formComponent);
			}
		}
		return result;
	}
}

class ToolbarContainerBuilder extends GenericContainerBuilder<azdata.ToolbarContainer, azdata.ToolbarLayout, any> implements azdata.ToolbarBuilder {
	withToolbarItems(components: azdata.ToolbarComponent[]): azdata.ContainerBuilder<azdata.ToolbarContainer, any, any> {
		this._component.itemConfigs = components.map(item => {
			return this.convertToItemConfig(item);
		});
		return this;
	}

	private convertToItemConfig(toolbarComponent: azdata.ToolbarComponent): InternalItemConfig {
		let componentWrapper = toolbarComponent.component as ComponentWrapper;

		return new InternalItemConfig(componentWrapper, {
			title: toolbarComponent.title,
			toolbarSeparatorAfter: toolbarComponent.toolbarSeparatorAfter
		});
	}

	addToolbarItems(toolbarComponent: Array<azdata.ToolbarComponent>): void {
		toolbarComponent.forEach(toolbarComponent => {
			this.addToolbarItem(toolbarComponent);
		});
	}

	addToolbarItem(toolbarComponent: azdata.ToolbarComponent): void {
		let itemImpl = this.convertToItemConfig(toolbarComponent);
		this._component.addItem(toolbarComponent.component as ComponentWrapper, itemImpl.config);
	}
}

class LoadingComponentBuilder extends ComponentBuilderImpl<azdata.LoadingComponent> implements azdata.LoadingComponentBuilder {
	withItem(component: azdata.Component) {
		this.component().component = component;
		return this;
	}
}

class InternalItemConfig {
	constructor(private _component: ComponentWrapper, public config: any) { }

	public toIItemConfig(): IItemConfig {
		return {
			config: this.config,
			componentShape: this._component.toComponentShape()
		};
	}

	public get component(): azdata.Component {
		return this._component;
	}
}

class ComponentWrapper implements azdata.Component {
	public properties: { [key: string]: any } = {};
	public layout: any;
	public itemConfigs: InternalItemConfig[];
	public customValidations: ((component: ThisType<ComponentWrapper>) => boolean)[] = [];
	private _valid: boolean = true;
	private _onValidityChangedEmitter = new Emitter<boolean>();
	public readonly onValidityChanged = this._onValidityChangedEmitter.event;

	private _onErrorEmitter = new Emitter<Error>();
	public readonly onError: vscode.Event<Error> = this._onErrorEmitter.event;
	protected _emitterMap = new Map<ComponentEventType, Emitter<any>>();

	constructor(protected readonly _proxy: MainThreadModelViewShape,
		protected readonly _handle: number,
		protected _type: ModelComponentTypes,
		protected _id: string
	) {
		this.properties = {};
		this.itemConfigs = [];
	}

	public get id(): string {
		return this._id;
	}

	public get type(): ModelComponentTypes {
		return this._type;
	}

	public get items(): azdata.Component[] {
		return this.itemConfigs.map(itemConfig => itemConfig.component);
	}

	public get enabled(): boolean {
		let isEnabled = this.properties['enabled'];
		return (isEnabled === undefined) ? true : isEnabled;
	}

	public set enabled(value: boolean) {
		this.setProperty('enabled', value);
	}

	public get height(): number | string {
		return this.properties['height'];
	}

	public set height(v: number | string) {
		this.setProperty('height', v);
	}

	public get width(): number | string {
		return this.properties['width'];
	}

	public set width(v: number | string) {
		this.setProperty('width', v);
	}

	public get required(): boolean {
		return this.properties['required'];
	}
	public set required(v: boolean) {
		this.setProperty('required', v);
	}

	public get CSSStyles(): { [key: string]: string } {
		return this.properties['CSSStyles'];
	}

	public set CSSStyles(cssStyles: { [key: string]: string }) {
		this.setProperty('CSSStyles', cssStyles);
	}

	public toComponentShape(): IComponentShape {
		return <IComponentShape>{
			id: this.id,
			type: this.type,
			layout: this.layout,
			properties: this.properties,
			itemConfigs: this.itemConfigs ? this.itemConfigs.map<IItemConfig>(item => item.toIItemConfig()) : undefined
		};
	}

	public clearItems(): Thenable<void> {
		this.itemConfigs = [];
		return this._proxy.$clearContainer(this._handle, this.id);
	}

	public addItems(items: Array<azdata.Component>, itemLayout?: any): void {
		for (let item of items) {
			this.addItem(item, itemLayout);
		}
	}

	public removeItemAt(index: number): boolean {
		if (index >= 0 && index < this.itemConfigs.length) {
			let itemConfig = this.itemConfigs[index];
			this._proxy.$removeFromContainer(this._handle, this.id, itemConfig.toIItemConfig());
			this.itemConfigs.splice(index, 1);
			return true;
		}
		return false;
	}

	public removeItem(item: azdata.Component): boolean {
		let index = this.itemConfigs.findIndex(c => c.component.id === item.id);
		if (index >= 0 && index < this.itemConfigs.length) {
			return this.removeItemAt(index);
		}
		return false;
	}

	public insertItem(item: azdata.Component, index: number, itemLayout?: any) {
		this.addItem(item, itemLayout, index);
	}

	public addItem(item: azdata.Component, itemLayout?: any, index?: number): void {
		let itemImpl = item as ComponentWrapper;
		if (!itemImpl) {
			throw new Error(nls.localize('unknownComponentType', "Unknown component type. Must use ModelBuilder to create objects"));
		}
		let config = new InternalItemConfig(itemImpl, itemLayout);
		if (index !== undefined && index >= 0 && index <= this.items.length) {
			this.itemConfigs.splice(index, 0, config);
		} else if (!index) {
			this.itemConfigs.push(config);
		} else {
			throw new Error(nls.localize('invalidIndex', "The index {0} is invalid.", index));
		}
		this._proxy.$addToContainer(this._handle, this.id, config.toIItemConfig(), index).then(undefined, (err) => this.handleError(err));
	}

	public setLayout(layout: any): Thenable<void> {
		return this._proxy.$setLayout(this._handle, this.id, layout);
	}

	public updateProperties(properties: { [key: string]: any }): Thenable<void> {
		this.properties = Object.assign(this.properties, properties);
		return this.notifyPropertyChanged();
	}

	public updateProperty(key: string, value: any): Thenable<void> {
		return this.setProperty(key, value);
	}

	public updateCssStyles(cssStyles: { [key: string]: string }): Thenable<void> {
		this.properties.CSSStyles = Object.assign(this.properties.CSSStyles || {}, cssStyles);
		return this.notifyPropertyChanged();
	}

	protected notifyPropertyChanged(): Thenable<void> {
		return this._proxy.$setProperties(this._handle, this._id, this.properties);
	}

	public registerEvent(): Thenable<boolean> {
		return this._proxy.$registerEvent(this._handle, this._id).then(() => true);
	}

	public onEvent(eventArgs: IComponentEventArgs) {
		if (eventArgs && eventArgs.eventType === ComponentEventType.PropertiesChanged) {
			this.properties = eventArgs.args;
		} else if (eventArgs && eventArgs.eventType === ComponentEventType.validityChanged) {
			this._valid = eventArgs.args;
			this._onValidityChangedEmitter.fire(this._valid);
		} else if (eventArgs) {
			let emitter = this._emitterMap.get(eventArgs.eventType);
			if (emitter) {
				emitter.fire(eventArgs.args);
			}
		}
	}

	protected setDataProvider(): Thenable<void> {
		return this._proxy.$setDataProvider(this._handle, this._id);
	}

	protected async setProperty(key: string, value: any): Promise<void> {
		if (!this.properties[key] || this.properties[key] !== value) {
			// Only notify the front end if a value has been updated
			this.properties[key] = value;
			return this.notifyPropertyChanged();
		}
		return Promise.resolve();
	}

	private handleError(err: Error): void {
		this._onErrorEmitter.fire(err);
	}

	public runCustomValidations(): boolean {
		let isValid = true;
		try {
			this.customValidations.forEach(validation => {
				if (!validation(this)) {
					isValid = false;
				}
			});
		} catch (e) {
			isValid = false;
		}
		return isValid;
	}

	public validate() {
		return this._proxy.$validate(this._handle, this._id);
	}

	public get valid(): boolean {
		return this._valid;
	}
}

class ContainerWrapper<T, U> extends ComponentWrapper implements azdata.Container<T, U> {

	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string) {
		super(proxy, handle, type, id);
	}

}

class CardWrapper extends ComponentWrapper implements azdata.CardComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Card, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
	}

	public get label(): string {
		return this.properties['label'];
	}
	public set label(l: string) {
		this.setProperty('label', l);
	}
	public get value(): string {
		return this.properties['value'];
	}
	public set value(v: string) {
		this.setProperty('value', v);
	}
	public get selected(): boolean {
		return this.properties['selected'];
	}
	public set selected(v: boolean) {
		this.setProperty('selected', v);
	}
	public get cardType(): azdata.CardType {
		return this.properties['cardType'];
	}
	public set cardType(v: azdata.CardType) {
		this.setProperty('cardType', v);
	}
	public get actions(): azdata.ActionDescriptor[] {
		return this.properties['actions'];
	}
	public set actions(a: azdata.ActionDescriptor[]) {
		this.setProperty('actions', a);
	}
	public get iconPath(): string | URI | { light: string | URI; dark: string | URI } {
		return this.properties['iconPath'];
	}
	public set iconPath(v: string | URI | { light: string | URI; dark: string | URI }) {
		this.setProperty('iconPath', v);
	}

	public get iconHeight(): number | string {
		return this.properties['iconHeight'];
	}
	public set iconHeight(v: number | string) {
		this.setProperty('iconHeight', v);
	}
	public get iconWidth(): number | string {
		return this.properties['iconWidth'];
	}
	public set iconWidth(v: number | string) {
		this.setProperty('iconWidth', v);
	}

	public get onDidActionClick(): vscode.Event<azdata.ActionDescriptor> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}

	public get onCardSelectedChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class InputBoxWrapper extends ComponentWrapper implements azdata.InputBoxComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.InputBox, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
	}

	public get value(): string {
		return this.properties['value'];
	}
	public set value(v: string) {
		this.setProperty('value', v);
	}

	public get ariaLabel(): string {
		return this.properties['ariaLabel'];
	}
	public set ariaLabel(v: string) {
		this.setProperty('ariaLabel', v);
	}

	public get ariaLive(): string {
		return this.properties['ariaLive'];
	}
	public set ariaLive(v: string) {
		this.setProperty('ariaLabel', v);
	}

	public get placeHolder(): string {
		return this.properties['placeHolder'];
	}
	public set placeHolder(v: string) {
		this.setProperty('placeHolder', v);
	}

	public get rows(): number {
		return this.properties['rows'];
	}
	public set rows(v: number) {
		this.setProperty('rows', v);
	}

	public get min(): number {
		return this.properties['min'];
	}
	public set min(v: number) {
		this.setProperty('min', v);
	}

	public get max(): number {
		return this.properties['max'];
	}
	public set max(v: number) {
		this.setProperty('max', v);
	}

	public get columns(): number {
		return this.properties['columns'];
	}
	public set columns(v: number) {
		this.setProperty('columns', v);
	}

	public get multiline(): boolean {
		return this.properties['multiline'];
	}
	public set multiline(v: boolean) {
		this.setProperty('multiline', v);
	}

	public get inputType(): azdata.InputBoxInputType {
		return this.properties['inputType'];
	}
	public set inputType(v: azdata.InputBoxInputType) {
		this.setProperty('inputType', v);
	}

	public get onTextChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class CheckBoxWrapper extends ComponentWrapper implements azdata.CheckBoxComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.CheckBox, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
	}

	public get checked(): boolean {
		return this.properties['checked'];
	}
	public set checked(v: boolean) {
		this.setProperty('checked', v);
	}

	public get label(): string {
		return this.properties['label'];
	}
	public set label(v: string) {
		this.setProperty('label', v);
	}

	public get onChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class WebViewWrapper extends ComponentWrapper implements azdata.WebViewComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, private _extensionLocation: URI) {
		super(proxy, handle, ModelComponentTypes.WebView, id);
		this.properties = {
			'extensionLocation': this._extensionLocation
		};
		this._emitterMap.set(ComponentEventType.onMessage, new Emitter<any>());
	}

	public get message(): any {
		return this.properties['message'];
	}
	public set message(v: any) {
		this.setProperty('message', v);
	}

	public get html(): string {
		return this.properties['html'];
	}
	public set html(html: string) {
		this.setProperty('html', html);
	}

	public get onMessage(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onMessage);
		return emitter && emitter.event;
	}

	public get options(): vscode.WebviewOptions {
		return this.properties['options'];
	}
	public set options(o: vscode.WebviewOptions) {
		this.setProperty('options', o);
	}
}

class DomComponentWrapper extends ComponentWrapper implements azdata.DomComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Dom, id);
		this.properties = {};
	}

	public get html(): string {
		return this.properties['html'];
	}
	public set html(html: string) {
		this.setProperty('html', html);
	}
}

class EditorWrapper extends ComponentWrapper implements azdata.EditorComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Editor, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
		this._emitterMap.set(ComponentEventType.onComponentCreated, new Emitter<any>());
	}

	public get content(): string {
		return this.properties['content'];
	}
	public set content(v: string) {
		this.setProperty('content', v);
	}

	public get languageMode(): string {
		return this.properties['languageMode'];
	}
	public set languageMode(v: string) {
		this.setProperty('languageMode', v);
	}

	public get editorUri(): string {
		return this.properties['editorUri'];
	}

	public get isAutoResizable(): boolean {
		return this.properties['isAutoResizable'];
	}

	public set isAutoResizable(v: boolean) {
		this.setProperty('isAutoResizable', v);
	}

	public get minimumHeight(): number {
		return this.properties['minimumHeight'];
	}

	public set minimumHeight(v: number) {
		this.setProperty('minimumHeight', v);
	}

	public get onContentChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}

	public get onEditorCreated(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onComponentCreated);
		return emitter && emitter.event;
	}
}

class DiffEditorWrapper extends ComponentWrapper implements azdata.DiffEditorComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.DiffEditor, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
		this._emitterMap.set(ComponentEventType.onComponentCreated, new Emitter<any>());
	}

	public get contentLeft(): string {
		return this.properties['contentLeft'];
	}

	public set contentLeft(v: string) {
		this.setProperty('contentLeft', v);
	}

	public get contentRight(): string {
		return this.properties['contentRight'];
	}

	public set contentRight(v: string) {
		this.setProperty('contentRight', v);
	}

	public get languageMode(): string {
		return this.properties['languageMode'];
	}
	public set languageMode(v: string) {
		this.setProperty('languageMode', v);
	}

	public get editorUri(): string {
		return this.properties['editorUri'];
	}

	public get isAutoResizable(): boolean {
		return this.properties['isAutoResizable'];
	}

	public set isAutoResizable(v: boolean) {
		this.setProperty('isAutoResizable', v);
	}

	public get minimumHeight(): number {
		return this.properties['minimumHeight'];
	}

	public set minimumHeight(v: number) {
		this.setProperty('minimumHeight', v);
	}

	public get onContentChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}

	public get onEditorCreated(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onComponentCreated);
		return emitter && emitter.event;
	}

	public get editorUriLeft(): string {
		return this.properties['editorUriLeft'];
	}

	public set editorUriLeft(v: string) {
		this.setProperty('editorUriLeft', v);
	}

	public get editorUriRight(): string {
		return this.properties['editorUriRight'];
	}

	public set editorUriRight(v: string) {
		this.setProperty('editorUriRight', v);
	}
}

class RadioButtonWrapper extends ComponentWrapper implements azdata.RadioButtonComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.RadioButton, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
	}

	public get name(): string {
		return this.properties['name'];
	}
	public set name(v: string) {
		this.setProperty('name', v);
	}

	public get label(): string {
		return this.properties['label'];
	}
	public set label(v: string) {
		this.setProperty('label', v);
	}

	public get value(): string {
		return this.properties['value'];
	}
	public set value(v: string) {
		this.setProperty('value', v);
	}
	public get checked(): boolean {
		return this.properties['checked'];
	}
	public set checked(v: boolean) {
		this.setProperty('checked', v);
	}
	public get focused(): boolean {
		return this.properties['focused'];
	}
	public set focused(v: boolean) {
		this.setProperty('focused', v);
	}

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class TextComponentWrapper extends ComponentWrapper implements azdata.TextComponentProperties {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Text, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
	}

	public get value(): string {
		return this.properties['value'];
	}
	public set value(v: string) {
		this.setProperty('value', v);
	}

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class ImageComponentWrapper extends ComponentWrapper implements azdata.ImageComponentProperties {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Image, id);
		this.properties = {};
	}

	public get src(): string {
		return this.properties['src'];
	}
	public set src(v: string) {
		this.setProperty('src', v);
	}

	public get alt(): string {
		return this.properties['alt'];
	}
	public set alt(v: string) {
		this.setProperty('alt', v);
	}

	public get height(): number | string {
		return this.properties['height'];
	}
	public set height(v: number | string) {
		this.setProperty('height', v);
	}

	public get width(): number | string {
		return this.properties['width'];
	}
	public set width(v: number | string) {
		this.setProperty('width', v);
	}
}

class TableComponentWrapper extends ComponentWrapper implements azdata.TableComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Table, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onSelectedRowChanged, new Emitter<any>());
		this._emitterMap.set(ComponentEventType.onCellAction, new Emitter<any>());
	}

	public get data(): any[][] {
		return this.properties['data'];
	}
	public set data(v: any[][]) {
		this.setProperty('data', v);
	}

	public get columns(): string[] | azdata.TableColumn[] {
		return this.properties['columns'];
	}
	public set columns(v: string[] | azdata.TableColumn[]) {
		this.setProperty('columns', v);
	}

	public get fontSize(): number | string {
		return this.properties['fontSize'];
	}

	public set fontSize(size: number | string) {
		this.setProperty('fontSize', size);
	}

	public get selectedRows(): number[] {
		return this.properties['selectedRows'];
	}
	public set selectedRows(v: number[]) {
		this.setProperty('selectedRows', v);
	}

	public get forceFitColumns(): ColumnSizingMode {
		return this.properties['forceFitColumns'];
	}
	public set forceFitColunms(v: ColumnSizingMode) {
		this.setProperty('forceFitColumns', v);
	}

	public get title(): string {
		return this.properties['title'];
	}
	public set title(v: string) {
		this.setProperty('title', v);
	}

	public get ariaRowCount(): number {
		return this.properties['ariaRowCount'];
	}
	public set ariaRowCount(v: number) {
		this.setProperty('ariaRowCount', v);
	}

	public get ariaColumnCount(): number {
		return this.properties['ariaColumnCount'];
	}
	public set ariaColumnCount(v: number) {
		this.setProperty('ariaColumnCount', v);
	}

	public get moveFocusOutWithTab(): boolean {
		return this.properties['moveFocusOutWithTab'];
	}
	public set moveFocusOutWithTab(v: boolean) {
		this.setProperty('moveFocusOutWithTab', v);
	}

	public get focused(): boolean {
		return this.properties['focused'];
	}
	public set focused(v: boolean) {
		this.setProperty('focused', v);
	}

	public get onRowSelected(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onSelectedRowChanged);
		return emitter && emitter.event;
	}

	public get onCellAction(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onCellAction);
		return emitter && emitter.event;
	}


}

class DropDownWrapper extends ComponentWrapper implements azdata.DropDownComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.DropDown, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
	}

	public get value(): string | azdata.CategoryValue {
		let val = this.properties['value'];
		if (!val && this.values && this.values.length > 0) {
			val = this.values[0];
		}
		return val;
	}
	public set value(v: string | azdata.CategoryValue) {
		this.setProperty('value', v);
	}

	public get values(): string[] | azdata.CategoryValue[] {
		return this.properties['values'];
	}
	public set values(v: string[] | azdata.CategoryValue[]) {
		this.setProperty('values', v);
	}

	public get editable(): boolean {
		return this.properties['editable'];
	}
	public set editable(v: boolean) {
		this.setProperty('editable', v);
	}

	public get fireOnTextChange(): boolean {
		return this.properties['fireOnTextChange'];
	}
	public set fireOnTextChange(v: boolean) {
		this.setProperty('fireOnTextChange', v);
	}

	public get ariaLabel(): string {
		return this.properties['ariaLabel'];
	}
	public set ariaLabel(v: string) {
		this.setProperty('ariaLabel', v);
	}

	public get onValueChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class DeclarativeTableWrapper extends ComponentWrapper implements azdata.DeclarativeTableComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.DeclarativeTable, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
	}

	public get data(): any[][] {
		return this.properties['data'];
	}
	public set data(v: any[][]) {
		this.setProperty('data', v);
	}

	public get columns(): azdata.DeclarativeTableColumn[] {
		return this.properties['columns'];
	}

	public set columns(v: azdata.DeclarativeTableColumn[]) {
		this.setProperty('columns', v);
	}

	public get onDataChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class ListBoxWrapper extends ComponentWrapper implements azdata.ListBoxComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.ListBox, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onSelectedRowChanged, new Emitter<any>());
	}

	public get selectedRow(): number {
		return this.properties['selectedRow'];
	}
	public set selectedRow(v: number) {
		this.setProperty('selectedRow', v);
	}

	public get values(): string[] {
		return this.properties['values'];
	}
	public set values(v: string[]) {
		this.setProperty('values', v);
	}

	public get onRowSelected(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onSelectedRowChanged);
		return emitter && emitter.event;
	}
}

class ButtonWrapper extends ComponentWrapper implements azdata.ButtonComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Button, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
	}

	public get label(): string {
		return this.properties['label'];
	}
	public set label(v: string) {
		this.setProperty('label', v);
	}

	public get iconPath(): string | URI | { light: string | URI; dark: string | URI } {
		return this.properties['iconPath'];
	}
	public set iconPath(v: string | URI | { light: string | URI; dark: string | URI }) {
		this.setProperty('iconPath', v);
	}

	public get iconHeight(): string | number {
		return this.properties['iconHeight'];
	}
	public set iconHeight(v: string | number) {
		this.setProperty('iconHeight', v);
	}

	public get iconWidth(): string | number {
		return this.properties['iconWidth'];
	}
	public set iconWidth(v: string | number) {
		this.setProperty('iconWidth', v);
	}

	public get title(): string {
		return this.properties['title'];
	}
	public set title(v: string) {
		this.setProperty('title', v);
	}

	public get ariaLabel(): string {
		return this.properties['ariaLabel'];
	}
	public set ariaLabel(v: string) {
		this.setProperty('ariaLabel', v);
	}

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class LoadingComponentWrapper extends ComponentWrapper implements azdata.LoadingComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.LoadingComponent, id);
		this.properties = {};
		this.loading = true;
	}

	public get loading(): boolean {
		return this.properties['loading'];
	}

	public set loading(value: boolean) {
		this.setProperty('loading', value);
	}

	public get component(): azdata.Component {
		return this.items[0];
	}

	public set component(value: azdata.Component) {
		this.addItem(value);
	}
}

class FileBrowserTreeComponentWrapper extends ComponentWrapper implements azdata.FileBrowserTreeComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.FileBrowserTree, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
	}

	public get ownerUri(): string {
		return this.properties['ownerUri'];
	}

	public set ownerUri(value: string) {
		this.setProperty('ownerUri', value);
	}

	public get onDidChange(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class DivContainerWrapper extends ComponentWrapper implements azdata.DivContainer {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string) {
		super(proxy, handle, type, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
	}

	public get overflowY(): string {
		return this.properties['overflowY'];
	}

	public set overflowY(value: string) {
		this.setProperty('overflowY', value);
	}

	public get yOffsetChange(): number {
		return this.properties['yOffsetChange'];
	}

	public set yOffsetChange(value: number) {
		this.setProperty('yOffsetChange', value);
	}

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class TreeComponentWrapper<T> extends ComponentWrapper implements azdata.TreeComponent<T> {

	constructor(
		private _extHostModelViewTree: ExtHostModelViewTreeViewsShape,
		proxy: MainThreadModelViewShape, handle: number, id: string, private _extension: IExtensionDescription) {
		super(proxy, handle, ModelComponentTypes.TreeComponent, id);
		this.properties = {};
	}

	public registerDataProvider<T>(dataProvider: azdata.TreeComponentDataProvider<T>): azdata.TreeComponentView<T> {
		this.setDataProvider();
		return this._extHostModelViewTree.$createTreeView(this._handle, this.id, { treeDataProvider: dataProvider }, this._extension);
	}

	public get withCheckbox(): boolean {
		return this.properties['withCheckbox'];
	}
	public set withCheckbox(v: boolean) {
		this.setProperty('withCheckbox', v);
	}
}

class HyperlinkComponentWrapper extends ComponentWrapper implements azdata.HyperlinkComponentProperties {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Hyperlink, id);
		this.properties = {};
	}

	public get label(): string {
		return this.properties['label'];
	}
	public set label(v: string) {
		this.setProperty('label', v);
	}

	public get url(): string {
		return this.properties['url'];
	}
	public set url(v: string) {
		this.setProperty('url', v);
	}
}

class ModelViewImpl implements azdata.ModelView {

	public onClosedEmitter = new Emitter<any>();
	private _onValidityChangedEmitter = new Emitter<boolean>();
	public readonly onValidityChanged = this._onValidityChangedEmitter.event;

	private _modelBuilder: ModelBuilderImpl;
	private _component: azdata.Component;

	constructor(
		private readonly _proxy: MainThreadModelViewShape,
		private readonly _handle: number,
		private readonly _connection: azdata.connection.Connection,
		private readonly _serverInfo: azdata.ServerInfo,
		private readonly mainContext: IMainContext,
		private readonly _extHostModelViewTree: ExtHostModelViewTreeViewsShape,
		_extension: IExtensionDescription
	) {
		this._modelBuilder = new ModelBuilderImpl(this._proxy, this._handle, this.mainContext, this._extHostModelViewTree, _extension);
	}

	public get onClosed(): vscode.Event<any> {
		return this.onClosedEmitter.event;
	}

	public get connection(): azdata.connection.Connection {
		return deepClone(this._connection);
	}

	public get serverInfo(): azdata.ServerInfo {
		return deepClone(this._serverInfo);
	}

	public get modelBuilder(): azdata.ModelBuilder {
		return this._modelBuilder;
	}

	public get valid(): boolean {
		return this._component.valid;
	}

	public handleEvent(componentId: string, eventArgs: IComponentEventArgs): void {
		this._modelBuilder.handleEvent(componentId, eventArgs);
	}

	public initializeModel<T extends azdata.Component>(component: T): Thenable<void> {
		component.onValidityChanged(valid => this._onValidityChangedEmitter.fire(valid));
		this._component = component;
		let componentImpl = <any>component as ComponentWrapper;
		if (!componentImpl) {
			return Promise.reject(nls.localize('unknownConfig', "Unkown component configuration, must use ModelBuilder to create a configuration object"));
		}
		return this._proxy.$initializeModel(this._handle, componentImpl.toComponentShape());
	}

	public validate(): Thenable<boolean> {
		return this._proxy.$validate(this._handle, this._component.id);
	}

	public runCustomValidations(componentId: string): boolean {
		return this._modelBuilder.runCustomValidations(componentId);
	}
}

export class ExtHostModelView implements ExtHostModelViewShape {
	private readonly _proxy: MainThreadModelViewShape;

	private readonly _modelViews = new Map<number, ModelViewImpl>();
	private readonly _handlers = new Map<string, (view: azdata.ModelView) => void>();
	private readonly _handlerToExtension = new Map<string, IExtensionDescription>();
	constructor(
		private _mainContext: IMainContext,
		private _extHostModelViewTree: ExtHostModelViewTreeViewsShape
	) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadModelView);
	}

	$onClosed(handle: number): void {
		const view = this._modelViews.get(handle);
		view.onClosedEmitter.fire(undefined);
		this._modelViews.delete(handle);
	}

	$registerProvider(widgetId: string, handler: (webview: azdata.ModelView) => void, extension: IExtensionDescription): void {
		this._handlers.set(widgetId, handler);
		this._handlerToExtension.set(widgetId, extension);
		this._proxy.$registerProvider(widgetId);
	}

	$registerWidget(handle: number, id: string, connection: azdata.connection.Connection, serverInfo: azdata.ServerInfo): void {
		let extension = this._handlerToExtension.get(id);
		let view = new ModelViewImpl(this._proxy, handle, connection, serverInfo, this._mainContext, this._extHostModelViewTree, extension);
		this._modelViews.set(handle, view);
		this._handlers.get(id)(view);
	}

	$handleEvent(handle: number, componentId: string, eventArgs: IComponentEventArgs): void {
		const view = this._modelViews.get(handle);
		if (view) {
			view.handleEvent(componentId, eventArgs);
		}
	}

	$runCustomValidations(handle: number, componentId: string): Thenable<boolean> {
		const view = this._modelViews.get(handle);
		return Promise.resolve(view.runCustomValidations(componentId));
	}
}
