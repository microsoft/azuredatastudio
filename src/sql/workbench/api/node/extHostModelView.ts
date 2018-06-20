/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import { IActionDescriptor } from 'vs/editor/standalone/browser/standaloneCodeEditor';
import URI from 'vs/base/common/uri';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import { SqlMainContext, ExtHostModelViewShape, MainThreadModelViewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape, IComponentEventArgs, ComponentEventType } from 'sql/workbench/api/common/sqlExtHostTypes';

class ModelBuilderImpl implements sqlops.ModelBuilder {
	private nextComponentId: number;
	private readonly _componentBuilders = new Map<string, ComponentBuilderImpl<any>>();

	constructor(private readonly _proxy: MainThreadModelViewShape, private readonly _handle: number) {
		this.nextComponentId = 0;
	}

	navContainer(): sqlops.ContainerBuilder<sqlops.NavContainer, any, any> {
		let id = this.getNextComponentId();
		let container: ContainerBuilderImpl<sqlops.NavContainer, any, any> = new ContainerBuilderImpl(this._proxy, this._handle, ModelComponentTypes.NavContainer, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	flexContainer(): sqlops.FlexBuilder {
		let id = this.getNextComponentId();
		let container: ContainerBuilderImpl<sqlops.FlexContainer, any, any> = new ContainerBuilderImpl<sqlops.FlexContainer, sqlops.FlexLayout, sqlops.FlexItemLayout>(this._proxy, this._handle, ModelComponentTypes.FlexContainer, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	formContainer(): sqlops.FormBuilder {
		let id = this.getNextComponentId();
		let container = new FormContainerBuilder(this._proxy, this._handle, ModelComponentTypes.Form, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	toolbarContainer(): sqlops.ToolbarBuilder {
		let id = this.getNextComponentId();
		let container = new ToolbarContainerBuilder(this._proxy, this._handle, ModelComponentTypes.Toolbar, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	groupContainer(): sqlops.GroupBuilder {
		let id = this.getNextComponentId();
		let container: ContainerBuilderImpl<sqlops.GroupContainer, any, any> = new ContainerBuilderImpl<sqlops.GroupContainer, sqlops.GroupLayout, sqlops.GroupItemLayout>(this._proxy, this._handle, ModelComponentTypes.Group, id);
		this._componentBuilders.set(id, container);
		return container;
	}

	card(): sqlops.ComponentBuilder<sqlops.CardComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.CardComponent> = this.getComponentBuilder(new CardWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	inputBox(): sqlops.ComponentBuilder<sqlops.InputBoxComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.InputBoxComponent> = this.getComponentBuilder(new InputBoxWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	text(): sqlops.ComponentBuilder<sqlops.TextComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.TextComponent> = this.getComponentBuilder(new TextComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	radioButton(): sqlops.ComponentBuilder<sqlops.RadioButtonComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.RadioButtonComponent> = this.getComponentBuilder(new RadioButtonWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	checkBox(): sqlops.ComponentBuilder<sqlops.CheckBoxComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.CheckBoxComponent> = this.getComponentBuilder(new CheckBoxWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	webView(): sqlops.ComponentBuilder<sqlops.WebViewComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.WebViewComponent> = this.getComponentBuilder(new WebViewWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	button(): sqlops.ComponentBuilder<sqlops.ButtonComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.ButtonComponent> = this.getComponentBuilder(new ButtonWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dropDown(): sqlops.ComponentBuilder<sqlops.DropDownComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.DropDownComponent> = this.getComponentBuilder(new DropDownWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	listBox(): sqlops.ComponentBuilder<sqlops.ListBoxComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.ListBoxComponent> = this.getComponentBuilder(new ListBoxWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	table(): sqlops.ComponentBuilder<sqlops.TableComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.TableComponent> = this.getComponentBuilder(new TableComponentWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	declarativeTable(): sqlops.ComponentBuilder<sqlops.DeclarativeTableComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.DeclarativeTableComponent> = this.getComponentBuilder(new DeclarativeTableWrapper(this._proxy, this._handle, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dashboardWidget(widgetId: string): sqlops.ComponentBuilder<sqlops.DashboardWidgetComponent> {
		let id = this.getNextComponentId();
		let builder = this.getComponentBuilder<sqlops.DashboardWidgetComponent>(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWidget, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dashboardWebview(webviewId: string): sqlops.ComponentBuilder<sqlops.DashboardWebviewComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<sqlops.DashboardWebviewComponent> = this.getComponentBuilder(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWebview, id), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	loadingComponent(): sqlops.LoadingComponentBuilder {
		let id = this.getNextComponentId();
		let builder = new LoadingComponentBuilder(new LoadingComponentWrapper(this._proxy, this._handle, id));
		this._componentBuilders.set(id, builder);
		return builder;
	}

	getComponentBuilder<T extends sqlops.Component>(component: ComponentWrapper, id: string): ComponentBuilderImpl<T> {
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

class ComponentBuilderImpl<T extends sqlops.Component> implements sqlops.ComponentBuilder<T>, IWithEventHandler {

	constructor(protected _component: ComponentWrapper) {
		_component.registerEvent();
	}

	component(): T {
		return <T><any>this._component;
	}

	componentWrapper(): ComponentWrapper {
		return this._component;
	}

	withProperties<U>(properties: U): sqlops.ComponentBuilder<T> {
		this._component.properties = properties;
		return this;
	}

	withValidation(validation: (component: T) => boolean): sqlops.ComponentBuilder<T> {
		this._component.customValidations.push(validation);
		return this;
	}

	handleEvent(eventArgs: IComponentEventArgs) {
		this._component.onEvent(eventArgs);
	}
}

class GenericComponentBuilder<T extends sqlops.Component> extends ComponentBuilderImpl<T> {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string) {
		super(new ComponentWrapper(proxy, handle, type, id));
	}

}


class ContainerBuilderImpl<T extends sqlops.Component, TLayout, TItemLayout> extends ComponentBuilderImpl<T> implements sqlops.ContainerBuilder<T, TLayout, TItemLayout> {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string) {
		super(new ComponentWrapper(proxy, handle, type, id));
	}

	withLayout(layout: TLayout): sqlops.ContainerBuilder<T, TLayout, TItemLayout> {
		this._component.layout = layout;
		return this;
	}

	withItems(components: sqlops.Component[], itemLayout?: TItemLayout): sqlops.ContainerBuilder<T, TLayout, TItemLayout> {
		this._component.itemConfigs = components.map(item => {
			let componentWrapper = item as ComponentWrapper;
			return new InternalItemConfig(componentWrapper, itemLayout);
		});
		return this;
	}
}

class FormContainerBuilder extends ContainerBuilderImpl<sqlops.FormContainer, sqlops.FormLayout, sqlops.FormItemLayout> implements sqlops.FormBuilder {
	withFormItems(components: sqlops.FormComponent[], itemLayout?: sqlops.FormItemLayout): sqlops.ContainerBuilder<sqlops.FormContainer, sqlops.FormLayout, sqlops.FormItemLayout> {
		this._component.itemConfigs = components.map(item => {
			return this.convertToItemConfig(item, itemLayout);
		});

		components.forEach(formItem => {
			this.addComponentActions(formItem, itemLayout);
		});
		return this;
	}

	private convertToItemConfig(formComponent: sqlops.FormComponent, itemLayout?: sqlops.FormItemLayout): InternalItemConfig {
		let componentWrapper = formComponent.component as ComponentWrapper;
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
			isFormComponent: true
		}));
	}

	private addComponentActions(formComponent: sqlops.FormComponent, itemLayout?: sqlops.FormItemLayout): void {
		if (formComponent.actions) {
			formComponent.actions.forEach(component => {
				let componentWrapper = component as ComponentWrapper;
				this._component.addItem(componentWrapper, itemLayout);
			});
		}
	}

	addFormItems(formComponents: Array<sqlops.FormComponent>, itemLayout?: sqlops.FormItemLayout): void {
		formComponents.forEach(formComponent => {
			this.addFormItem(formComponent, itemLayout);
		});
	}

	addFormItem(formComponent: sqlops.FormComponent, itemLayout?: sqlops.FormItemLayout): void {
		let itemImpl = this.convertToItemConfig(formComponent, itemLayout);
		this._component.addItem(formComponent.component as ComponentWrapper, itemImpl.config);
		this.addComponentActions(formComponent, itemLayout);
	}
}

class ToolbarContainerBuilder extends ContainerBuilderImpl<sqlops.ToolbarContainer, any, any> implements sqlops.ToolbarBuilder {
	withToolbarItems(components: sqlops.ToolbarComponent[]): sqlops.ContainerBuilder<sqlops.ToolbarContainer, any, any> {
		this._component.itemConfigs = components.map(item => {
			return this.convertToItemConfig(item);
		});
		return this;
	}

	private convertToItemConfig(toolbarComponent: sqlops.ToolbarComponent): InternalItemConfig {
		let componentWrapper = toolbarComponent.component as ComponentWrapper;

		return new InternalItemConfig(componentWrapper, {
			title: toolbarComponent.title
		});
	}

	addToolbarItems(toolbarComponent: Array<sqlops.ToolbarComponent>): void {
		toolbarComponent.forEach(toolbarComponent => {
			this.addToolbarItem(toolbarComponent);
		});
	}

	addToolbarItem(toolbarComponent: sqlops.ToolbarComponent): void {
		let itemImpl = this.convertToItemConfig(toolbarComponent);
		this._component.addItem(toolbarComponent.component as ComponentWrapper, itemImpl.config);
	}
}

class LoadingComponentBuilder extends ComponentBuilderImpl<sqlops.LoadingComponent> implements sqlops.LoadingComponentBuilder {
	withItem(component: sqlops.Component) {
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

	public get component(): sqlops.Component {
		return this._component;
	}
}

class ComponentWrapper implements sqlops.Component {
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

	public get items(): sqlops.Component[] {
		return this.itemConfigs.map(itemConfig => itemConfig.component);
	}

	public get enabled(): boolean {
		return this.properties['enabled'];
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

	public addItems(items: Array<sqlops.Component>, itemLayout?: any): void {
		for (let item of items) {
			this.addItem(item, itemLayout);
		}
	}

	public addItem(item: sqlops.Component, itemLayout?: any): void {
		let itemImpl = item as ComponentWrapper;
		if (!itemImpl) {
			throw new Error(nls.localize('unknownComponentType', 'Unkown component type. Must use ModelBuilder to create objects'));
		}
		let config = new InternalItemConfig(itemImpl, itemLayout);
		this.itemConfigs.push(config);
		this._proxy.$addToContainer(this._handle, this.id, config.toIItemConfig()).then(undefined, this.handleError);
	}

	public setLayout(layout: any): Thenable<void> {
		return this._proxy.$setLayout(this._handle, this.id, layout);
	}

	public updateProperties(properties: { [key: string]: any }): Thenable<void> {
		this.properties = Object.assign(this.properties, properties);
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

class ContainerWrapper<T, U> extends ComponentWrapper implements sqlops.Container<T, U> {

	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string) {
		super(proxy, handle, type, id);
	}

}

class CardWrapper extends ComponentWrapper implements sqlops.CardComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Card, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
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
	public get selectable(): boolean {
		return this.properties['selectable'];
	}
	public set selectable(v: boolean) {
		this.setProperty('selectable', v);
	}
	public get actions(): sqlops.ActionDescriptor[] {
		return this.properties['actions'];
	}
	public set actions(a: sqlops.ActionDescriptor[]) {
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

	public get onDidActionClick(): vscode.Event<sqlops.ActionDescriptor> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}

	public get onCardSelectedChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class InputBoxWrapper extends ComponentWrapper implements sqlops.InputBoxComponent {

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

	public get inputType(): sqlops.InputBoxInputType {
		return this.properties['inputType'];
	}
	public set inputType(v: sqlops.InputBoxInputType) {
		this.setProperty('inputType', v);
	}

	public get onTextChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class CheckBoxWrapper extends ComponentWrapper implements sqlops.CheckBoxComponent {

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

class WebViewWrapper extends ComponentWrapper implements sqlops.WebViewComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.WebView, id);
		this.properties = {};
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
	public set html(v: string) {
		this.setProperty('html', v);
	}

	public get onMessage(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onMessage);
		return emitter && emitter.event;
	}
}

class RadioButtonWrapper extends ComponentWrapper implements sqlops.RadioButtonComponent {

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

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class TextComponentWrapper extends ComponentWrapper implements sqlops.TextComponentProperties {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Text, id);
		this.properties = {};
	}

	public get value(): string {
		return this.properties['value'];
	}
	public set value(v: string) {
		this.setProperty('value', v);
	}
}

class TableComponentWrapper extends ComponentWrapper implements sqlops.TableComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.Table, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onSelectedRowChanged, new Emitter<any>());
	}

	public get data(): any[][] {
		return this.properties['data'];
	}
	public set data(v: any[][]) {
		this.setProperty('data', v);
	}

	public get columns(): string[] | sqlops.TableColumn[] {
		return this.properties['columns'];
	}
	public set columns(v: string[] | sqlops.TableColumn[]) {
		this.setProperty('columns', v);
	}

	public get selectedRows(): number[] {
		return this.properties['selectedRows'];
	}
	public set selectedRows(v: number[]) {
		this.setProperty('selectedRows', v);
	}

	public get onRowSelected(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onSelectedRowChanged);
		return emitter && emitter.event;
	}
}

class DropDownWrapper extends ComponentWrapper implements sqlops.DropDownComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, ModelComponentTypes.DropDown, id);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
	}

	public get value(): string | sqlops.CategoryValue {
		return this.properties['value'];
	}
	public set value(v: string | sqlops.CategoryValue) {
		this.setProperty('value', v);
	}

	public get values(): string[] | sqlops.CategoryValue[] {
		return this.properties['values'];
	}
	public set values(v: string[] | sqlops.CategoryValue[]) {
		this.setProperty('values', v);
	}

	public get editable(): boolean {
		return this.properties['editable'];
	}
	public set editable(v: boolean) {
		this.setProperty('editable', v);
	}

	public get onValueChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class DeclarativeTableWrapper extends ComponentWrapper implements sqlops.DeclarativeTableComponent {

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

	public get columns(): sqlops.DeclarativeTableColumn[] {
		return this.properties['columns'];
	}

	public set columns(v: sqlops.DeclarativeTableColumn[]) {
		this.setProperty('columns', v);
	}

	public get onDataChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class ListBoxWrapper extends ComponentWrapper implements sqlops.ListBoxComponent {

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

class ButtonWrapper extends ComponentWrapper implements sqlops.ButtonComponent {

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

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class LoadingComponentWrapper extends ComponentWrapper implements sqlops.LoadingComponent {
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

	public get component(): sqlops.Component {
		return this.items[0];
	}

	public set component(value: sqlops.Component) {
		this.addItem(value);
	}
}

class ModelViewImpl implements sqlops.ModelView {

	public onClosedEmitter = new Emitter<any>();
	private _onValidityChangedEmitter = new Emitter<boolean>();
	public readonly onValidityChanged = this._onValidityChangedEmitter.event;

	private _modelBuilder: ModelBuilderImpl;
	private _component: sqlops.Component;

	constructor(
		private readonly _proxy: MainThreadModelViewShape,
		private readonly _handle: number,
		private readonly _connection: sqlops.connection.Connection,
		private readonly _serverInfo: sqlops.ServerInfo
	) {
		this._modelBuilder = new ModelBuilderImpl(this._proxy, this._handle);
	}

	public get onClosed(): vscode.Event<any> {
		return this.onClosedEmitter.event;
	}

	public get connection(): sqlops.connection.Connection {
		return deepClone(this._connection);
	}

	public get serverInfo(): sqlops.ServerInfo {
		return deepClone(this._serverInfo);
	}

	public get modelBuilder(): sqlops.ModelBuilder {
		return this._modelBuilder;
	}

	public get valid(): boolean {
		return this._component.valid;
	}

	public handleEvent(componentId: string, eventArgs: IComponentEventArgs): void {
		this._modelBuilder.handleEvent(componentId, eventArgs);
	}

	public initializeModel<T extends sqlops.Component>(component: T): Thenable<void> {
		component.onValidityChanged(valid => this._onValidityChangedEmitter.fire(valid));
		this._component = component;
		let componentImpl = <any>component as ComponentWrapper;
		if (!componentImpl) {
			return Promise.reject(nls.localize('unknownConfig', 'Unkown component configuration, must use ModelBuilder to create a configuration object'));
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
	private readonly _handlers = new Map<string, (view: sqlops.ModelView) => void>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadModelView);
	}

	$onClosed(handle: number): void {
		const view = this._modelViews.get(handle);
		view.onClosedEmitter.fire();
		this._modelViews.delete(handle);
	}

	$registerProvider(widgetId: string, handler: (webview: sqlops.ModelView) => void): void {
		this._handlers.set(widgetId, handler);
		this._proxy.$registerProvider(widgetId);
	}

	$registerWidget(handle: number, id: string, connection: sqlops.connection.Connection, serverInfo: sqlops.ServerInfo): void {
		let view = new ModelViewImpl(this._proxy, handle, connection, serverInfo);
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
