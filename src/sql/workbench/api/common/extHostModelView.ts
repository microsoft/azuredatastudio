/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-floating-promises */

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import { deepClone, assign } from 'vs/base/common/objects';
import { URI } from 'vs/base/common/uri';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import { SqlMainContext, ExtHostModelViewShape, MainThreadModelViewShape, ExtHostModelViewTreeViewsShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape, IComponentEventArgs, ComponentEventType, ColumnSizingMode, ModelViewAction } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { ILogService } from 'vs/platform/log/common/log';
import { onUnexpectedError } from 'vs/base/common/errors';

class ModelBuilderImpl implements azdata.ModelBuilder {
	private nextComponentId: number;
	private readonly _componentBuilders = new Map<string, ComponentBuilderImpl<any, azdata.ComponentProperties>>();

	constructor(
		private readonly _proxy: MainThreadModelViewShape,
		private readonly _handle: number,
		private readonly _extHostModelViewTree: ExtHostModelViewTreeViewsShape,
		private readonly _extension: IExtensionDescription,
		private readonly logService: ILogService
	) {
		this.nextComponentId = 0;
	}

	navContainer(): azdata.ContainerBuilder<azdata.NavContainer, any, any, azdata.ComponentProperties> {
		let id = this.getNextComponentId();
		let container: GenericContainerBuilder<azdata.NavContainer, any, any, azdata.ComponentProperties> = new GenericContainerBuilder(this._proxy, this._handle, ModelComponentTypes.NavContainer, id, this.logService);
		this._componentBuilders.set(id, container);
		return container;
	}

	divContainer(): azdata.DivBuilder {
		let id = this.getNextComponentId();
		let container = new DivContainerBuilder(this._proxy, this._handle, ModelComponentTypes.DivContainer, id, this.logService);
		this._componentBuilders.set(id, container);
		return container;
	}

	flexContainer(): azdata.FlexBuilder {
		let id = this.getNextComponentId();
		let container: GenericContainerBuilder<azdata.FlexContainer, any, any, azdata.ComponentProperties> = new GenericContainerBuilder<azdata.FlexContainer, azdata.FlexLayout, azdata.FlexItemLayout, azdata.ComponentProperties>(this._proxy, this._handle, ModelComponentTypes.FlexContainer, id, this.logService);
		this._componentBuilders.set(id, container);
		return container;
	}

	splitViewContainer(): azdata.SplitViewBuilder {
		let id = this.getNextComponentId();
		let container: GenericContainerBuilder<azdata.SplitViewContainer, any, any, azdata.SplitViewContainer> = new GenericContainerBuilder<azdata.SplitViewContainer, azdata.SplitViewLayout, azdata.FlexItemLayout, azdata.SplitViewContainer>(this._proxy, this._handle, ModelComponentTypes.SplitViewContainer, id, this.logService);
		this._componentBuilders.set(id, container);
		return container;
	}

	formContainer(): azdata.FormBuilder {
		let id = this.getNextComponentId();
		let container = new FormContainerBuilder(this._proxy, this._handle, ModelComponentTypes.Form, id, this, this.logService);
		this._componentBuilders.set(id, container);
		return container;
	}

	toolbarContainer(): azdata.ToolbarBuilder {
		let id = this.getNextComponentId();
		let container = new ToolbarContainerBuilder(this._proxy, this._handle, ModelComponentTypes.Toolbar, id, this.logService);
		this._componentBuilders.set(id, container);
		return container;
	}

	groupContainer(): azdata.GroupBuilder {
		let id = this.getNextComponentId();
		let container = new GroupContainerBuilder(this._proxy, this._handle, ModelComponentTypes.Group, id, this.logService);
		this._componentBuilders.set(id, container);
		return container;
	}

	private cardDeprecationMessagePrinted = false;
	card(): azdata.ComponentBuilder<azdata.CardComponent, azdata.CardProperties> {
		if (!this.cardDeprecationMessagePrinted) {
			this.logService.warn(`Extension '${this._extension.identifier.value}' is using card component which has been replaced by radioCardGroup. the card component will be removed in a future release.`);
			this.cardDeprecationMessagePrinted = true;
		}
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.CardComponent, azdata.CardProperties> = this.getComponentBuilder(new CardWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	tree<T>(): azdata.ComponentBuilder<azdata.TreeComponent<T>, azdata.TreeProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.TreeComponent<T>, azdata.TreeProperties> = this.getComponentBuilder(new TreeComponentWrapper(this._extHostModelViewTree, this._proxy, this._handle, id, this._extension, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	inputBox(): azdata.ComponentBuilder<azdata.InputBoxComponent, azdata.InputBoxProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.InputBoxComponent, azdata.InputBoxProperties> = this.getComponentBuilder(new InputBoxWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	text(): azdata.ComponentBuilder<azdata.TextComponent, azdata.TextComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.TextComponent, azdata.TextComponentProperties> = this.getComponentBuilder(new TextComponentWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	image(): azdata.ComponentBuilder<azdata.ImageComponent, azdata.ImageComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.ImageComponent, azdata.ImageComponentProperties> = this.getComponentBuilder(new ImageComponentWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	radioButton(): azdata.ComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.RadioButtonComponent, azdata.RadioButtonProperties> = this.getComponentBuilder(new RadioButtonWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	checkBox(): azdata.ComponentBuilder<azdata.CheckBoxComponent, azdata.CheckBoxProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.CheckBoxComponent, azdata.CheckBoxProperties> = this.getComponentBuilder(new CheckBoxWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	webView(): azdata.ComponentBuilder<azdata.WebViewComponent, azdata.WebViewProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.WebViewComponent, azdata.WebViewProperties> = this.getComponentBuilder(new WebViewWrapper(this._proxy, this._handle, id, this._extension.extensionLocation, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	editor(): azdata.ComponentBuilder<azdata.EditorComponent, azdata.EditorProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.EditorComponent, azdata.EditorProperties> = this.getComponentBuilder(new EditorWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	diffeditor(): azdata.ComponentBuilder<azdata.DiffEditorComponent, azdata.DiffEditorComponent> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DiffEditorComponent, azdata.DiffEditorComponent> = this.getComponentBuilder(new DiffEditorWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	button(): azdata.ComponentBuilder<azdata.ButtonComponent, azdata.ButtonProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.ButtonComponent, azdata.ButtonProperties> = this.getComponentBuilder(new ButtonWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	separator(): azdata.ComponentBuilder<azdata.SeparatorComponent, azdata.SeparatorComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.SeparatorComponent, azdata.SeparatorComponentProperties> = this.getComponentBuilder(new SeparatorWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dropDown(): azdata.ComponentBuilder<azdata.DropDownComponent, azdata.DropDownProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DropDownComponent, azdata.DropDownProperties> = this.getComponentBuilder(new DropDownWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	listBox(): azdata.ComponentBuilder<azdata.ListBoxComponent, azdata.ListBoxProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.ListBoxComponent, azdata.ListBoxProperties> = this.getComponentBuilder(new ListBoxWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	table(): azdata.ComponentBuilder<azdata.TableComponent, azdata.TableComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.TableComponent, azdata.TableComponentProperties> = this.getComponentBuilder(new TableComponentWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	declarativeTable(): azdata.ComponentBuilder<azdata.DeclarativeTableComponent, azdata.DeclarativeTableProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DeclarativeTableComponent, azdata.DeclarativeTableProperties> = this.getComponentBuilder(new DeclarativeTableWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dashboardWidget(widgetId: string): azdata.ComponentBuilder<azdata.DashboardWidgetComponent, azdata.ComponentProperties> {
		let id = this.getNextComponentId();
		let builder = this.getComponentBuilder<azdata.DashboardWidgetComponent, azdata.ComponentProperties>(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWidget, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	dashboardWebview(webviewId: string): azdata.ComponentBuilder<azdata.DashboardWebviewComponent, azdata.ComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.DashboardWebviewComponent, azdata.ComponentProperties> = this.getComponentBuilder(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWebview, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	loadingComponent(): azdata.LoadingComponentBuilder {
		let id = this.getNextComponentId();
		let builder = new LoadingComponentBuilder(new LoadingComponentWrapper(this._proxy, this._handle, id, this.logService));
		this._componentBuilders.set(id, builder);
		return builder;
	}

	fileBrowserTree(): azdata.ComponentBuilder<azdata.FileBrowserTreeComponent, azdata.FileBrowserTreeProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.FileBrowserTreeComponent, azdata.FileBrowserTreeProperties> = this.getComponentBuilder(new FileBrowserTreeComponentWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	hyperlink(): azdata.ComponentBuilder<azdata.HyperlinkComponent, azdata.HyperlinkComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.HyperlinkComponent, azdata.HyperlinkComponentProperties> = this.getComponentBuilder(new HyperlinkComponentWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	radioCardGroup(): azdata.ComponentBuilder<azdata.RadioCardGroupComponent, azdata.RadioCardGroupComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.RadioCardGroupComponent, azdata.RadioCardGroupComponentProperties> = this.getComponentBuilder(new RadioCardGroupComponentWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	listView(): azdata.ComponentBuilder<azdata.ListViewComponent, azdata.ListViewComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.ListViewComponent, azdata.ListViewComponentProperties> = this.getComponentBuilder(new ListViewComponentWrapper(this._proxy, this._handle, id, this.logService), id);
		this._componentBuilders.set(id, builder);
		return builder;
	}

	tabbedPanel(): azdata.TabbedPanelComponentBuilder {
		let id = this.getNextComponentId();
		let builder = new TabbedPanelComponentBuilder(new TabbedPanelComponentWrapper(this._proxy, this._handle, id, this.logService));
		this._componentBuilders.set(id, builder);
		return builder;
	}

	propertiesContainer(): azdata.ComponentBuilder<azdata.PropertiesContainerComponent, azdata.PropertiesContainerComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.PropertiesContainerComponent, azdata.PropertiesContainerComponentProperties> = this.getComponentBuilder(new PropertiesContainerComponentWrapper(this._proxy, this._handle, id, this.logService), id);

		this._componentBuilders.set(id, builder);
		return builder;
	}

	infoBox(): azdata.ComponentBuilder<azdata.InfoBoxComponent, azdata.InfoBoxComponentProperties> {
		let id = this.getNextComponentId();
		let builder: ComponentBuilderImpl<azdata.InfoBoxComponent, azdata.InfoBoxComponentProperties> = this.getComponentBuilder(new InfoBoxComponentWrapper(this._proxy, this._handle, id, this.logService), id);

		this._componentBuilders.set(id, builder);
		return builder;
	}

	slider(): azdata.ComponentBuilder<azdata.SliderComponent, azdata.SliderComponentProperties> {
		const id = this.getNextComponentId();
		const builder: ComponentBuilderImpl<azdata.SliderComponent, azdata.SliderComponentProperties> = this.getComponentBuilder(new SliderComponentWrapper(this._proxy, this._handle, id, this.logService), id);

		this._componentBuilders.set(id, builder);
		return builder;
	}

	getComponentBuilder<T extends azdata.Component, TPropertyBag extends azdata.ComponentProperties>(component: ComponentWrapper, id: string): ComponentBuilderImpl<T, TPropertyBag> {
		let componentBuilder: ComponentBuilderImpl<T, TPropertyBag> = new ComponentBuilderImpl<T, TPropertyBag>(component);
		this._componentBuilders.set(id, componentBuilder);
		return componentBuilder;
	}

	handleEvent(componentId: string, eventArgs: IComponentEventArgs): void {
		let eventHandler = this._componentBuilders.get(componentId);
		if (eventHandler) {
			eventHandler.handleEvent(eventArgs);
		}
	}

	public runCustomValidations(componentId: string): Thenable<boolean> {
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

class ComponentBuilderImpl<T extends azdata.Component, TPropertyBag extends azdata.ComponentProperties> implements azdata.ComponentBuilder<T, TPropertyBag>, IWithEventHandler {

	constructor(protected _component: ComponentWrapper) {
		_component.registerEvent();
	}

	component(): T {
		return <T><any>this._component;
	}

	componentWrapper(): ComponentWrapper {
		return this._component;
	}

	withProperties<U>(properties: U): azdata.ComponentBuilder<T, TPropertyBag> {
		// Keep any properties that may have been set during initial object construction
		this._component.properties = assign({}, this._component.properties, properties);
		return this;
	}

	withProps(properties: TPropertyBag): azdata.ComponentBuilder<T, TPropertyBag> {
		this._component.properties = assign({}, this._component.properties, properties);
		return this;
	}

	withValidation(validation: (component: T) => boolean | Thenable<boolean>): azdata.ComponentBuilder<T, TPropertyBag> {
		this._component.customValidations.push(validation);
		return this;
	}

	handleEvent(eventArgs: IComponentEventArgs) {
		this._component.onEvent(eventArgs);
	}
}

class ContainerBuilderImpl<TComponent extends azdata.Component, TLayout, TItemLayout, TPropertyBag extends azdata.ComponentProperties> extends ComponentBuilderImpl<TComponent, TPropertyBag> implements azdata.ContainerBuilder<TComponent, TLayout, TItemLayout, TPropertyBag> {
	constructor(componentWrapper: ComponentWrapper) {
		super(componentWrapper);
	}

	withLayout(layout: TLayout): azdata.ContainerBuilder<TComponent, TLayout, TItemLayout, TPropertyBag> {
		this._component.layout = layout;
		return this;
	}

	withItems(components: azdata.Component[], itemLayout?: TItemLayout): azdata.ContainerBuilder<TComponent, TLayout, TItemLayout, TPropertyBag> {
		this._component.itemConfigs = components.map(item => {
			let componentWrapper = item as ComponentWrapper;
			return new InternalItemConfig(componentWrapper, itemLayout);
		});
		return this;
	}
}

class GenericContainerBuilder<T extends azdata.Component, TLayout, TItemLayout, TPropertyBag extends azdata.ComponentProperties> extends ContainerBuilderImpl<T, TLayout, TItemLayout, TPropertyBag> {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, logService: ILogService) {
		super(new ComponentWrapper(proxy, handle, type, id, logService));
	}
}

class DivContainerBuilder extends ContainerBuilderImpl<azdata.DivContainer, azdata.DivLayout, azdata.DivItemLayout, azdata.DivContainerProperties> {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, logService: ILogService) {
		super(new DivContainerWrapper(proxy, handle, type, id, logService));
	}
}

class FormContainerBuilder extends GenericContainerBuilder<azdata.FormContainer, azdata.FormLayout, azdata.FormItemLayout, azdata.ComponentProperties> implements azdata.FormBuilder {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, private _builder: ModelBuilderImpl, logService: ILogService) {
		super(proxy, handle, type, id, logService);
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
		if (formComponent.title && componentWrapper) {
			componentWrapper.ariaLabel = formComponent.title;
			if (componentWrapper instanceof LoadingComponentWrapper) {
				componentWrapper.component.ariaLabel = formComponent.title;
				let containedComponent = componentWrapper.component as any;
				if (containedComponent.required) {
					componentWrapper.required = containedComponent.required;
				}
			}
		}
		let actions: string[] = undefined;
		if (formComponent.actions) {
			actions = formComponent.actions.map(action => {
				let actionComponentWrapper = action as ComponentWrapper;
				return actionComponentWrapper.id;
			});
		}

		return new InternalItemConfig(componentWrapper, assign({}, itemLayout || {}, {
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
			if (index !== -1) {
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

class GroupContainerBuilder extends ContainerBuilderImpl<azdata.GroupContainer, azdata.GroupLayout, azdata.GroupItemLayout, azdata.GroupContainerProperties> {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, logService: ILogService) {
		super(new GroupContainerComponentWrapper(proxy, handle, type, id, logService));
	}
}

class ToolbarContainerBuilder extends GenericContainerBuilder<azdata.ToolbarContainer, azdata.ToolbarLayout, any, azdata.ComponentProperties> implements azdata.ToolbarBuilder {
	withToolbarItems(components: azdata.ToolbarComponent[]): azdata.ContainerBuilder<azdata.ToolbarContainer, any, any, azdata.ComponentProperties> {
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

class TabbedPanelComponentBuilder extends ContainerBuilderImpl<azdata.TabbedPanelComponent, azdata.TabbedPanelLayout, any, azdata.ComponentProperties> implements azdata.TabbedPanelComponentBuilder {
	withTabs(items: (azdata.Tab | azdata.TabGroup)[]): azdata.ContainerBuilder<azdata.TabbedPanelComponent, azdata.TabbedPanelLayout, any, azdata.ComponentProperties> {
		this._component.itemConfigs = createFromTabs(items);
		return this;
	}
}

function createFromTabs(items: (azdata.Tab | azdata.TabGroup)[]): InternalItemConfig[] {
	const itemConfigs = [];
	items.forEach(item => {
		if (item && 'tabs' in item) {
			item.tabs.forEach(tab => {
				itemConfigs.push(toTabItemConfig(tab.content, tab.title, tab.id, item.title, tab.icon));
			});
		} else {
			const tab = <azdata.Tab>item;
			itemConfigs.push(toTabItemConfig(tab.content, tab.title, tab.id, undefined, tab.icon));
		}
	});
	return itemConfigs;
}

function toTabItemConfig(content: azdata.Component, title: string, id?: string, group?: string, icon?: azdata.IconPath): InternalItemConfig {
	return new InternalItemConfig(content as ComponentWrapper, {
		title: title,
		group: group,
		id: id,
		icon: icon
	});
}

class LoadingComponentBuilder extends ComponentBuilderImpl<azdata.LoadingComponent, azdata.LoadingComponentProperties> implements azdata.LoadingComponentBuilder {
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
	public customValidations: ((component: ThisType<ComponentWrapper>) => boolean | Thenable<boolean>)[] = [];
	private _valid: boolean = true;
	private _onValidityChangedEmitter = new Emitter<boolean>();
	public readonly onValidityChanged = this._onValidityChangedEmitter.event;

	private _onErrorEmitter = new Emitter<Error>();
	public readonly onError: vscode.Event<Error> = this._onErrorEmitter.event;
	protected _emitterMap = new Map<ComponentEventType, Emitter<any>>();

	constructor(protected readonly _proxy: MainThreadModelViewShape,
		protected readonly _handle: number,
		protected _type: ModelComponentTypes,
		protected _id: string,
		protected _logService: ILogService
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

	public get display(): azdata.DisplayType {
		return this.properties['display'];
	}
	public set display(v: azdata.DisplayType) {
		this.setProperty('display', v);
	}

	public get ariaLabel(): string {
		return this.properties['ariaLabel'];
	}

	public set ariaLabel(v: string) {
		this.setProperty('ariaLabel', v);
	}

	public get ariaRole(): string {
		return this.properties['ariaRole'];
	}

	public set ariaRole(v: string) {
		this.setProperty('ariaRole', v);
	}

	public get ariaSelected(): boolean {
		return this.properties['ariaSelected'];
	}

	public set ariaSelected(v: boolean) {
		this.setProperty('ariaSelected', v);
	}

	public get ariaHidden(): boolean {
		return this.properties['ariaHidden'];
	}

	public set ariaHidden(v: boolean) {
		this.setProperty('ariaHidden', v);
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
		items = items.filter(item => {
			if (this.itemConfigs.find(itemConfig => itemConfig.component.id === item.id)) {
				this._logService.warn(`Trying to add duplicate component ${item.id} to container ${this.id}`);
				return false;
			}
			return true;
		});
		if (items.length === 0) {
			return;
		}
		const itemConfigs = items.map(item => {
			return {
				itemConfig: this.createAndAddItemConfig(item, itemLayout).toIItemConfig()
			};
		});
		this._proxy.$addToContainer(this._handle, this.id, itemConfigs).then(undefined, (err) => this.handleError(err));
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
		if (this.itemConfigs.find(itemConfig => itemConfig.component.id === item.id)) {
			this._logService.warn(`Trying to add duplicate component ${item.id} to container ${this.id}`);
			return;
		}
		const config = this.createAndAddItemConfig(item, itemLayout, index);
		this._proxy.$addToContainer(this._handle, this.id, [{ itemConfig: config.toIItemConfig(), index }]).then(undefined, (err) => this.handleError(err));
	}

	/**
	 * Creates the internal item config for the component and adds it to the list of child configs for this component.
	 * @param item The child component to add
	 * @param itemLayout The optional layout to apply to the child component
	 * @param index The optional index to insert the child component at
	 */
	private createAndAddItemConfig(item: azdata.Component, itemLayout?: any, index?: number): InternalItemConfig {
		const itemImpl = item as ComponentWrapper;
		if (!itemImpl) {
			throw new Error(nls.localize('unknownComponentType', "Unknown component type. Must use ModelBuilder to create objects"));
		}
		const config = new InternalItemConfig(itemImpl, itemLayout);
		if (index !== undefined && index >= 0 && index <= this.items.length) {
			this.itemConfigs.splice(index, 0, config);
		} else if (!index) {
			this.itemConfigs.push(config);
		} else {
			throw new Error(nls.localize('invalidIndex', "The index {0} is invalid.", index));
		}
		return config;
	}

	public setLayout(layout: any): Thenable<void> {
		return this._proxy.$setLayout(this._handle, this.id, layout);
	}

	public setItemLayout(item: azdata.Component, itemLayout: any): boolean {
		const itemConfig = this.itemConfigs.find(c => c.component.id === item.id);
		if (itemConfig) {
			itemConfig.config = itemLayout;
			this._proxy.$setItemLayout(this._handle, this.id, itemConfig.toIItemConfig()).then(undefined, onUnexpectedError);
		}
		return false;
	}

	public updateProperties(properties: { [key: string]: any }): Thenable<void> {
		this.properties = assign(this.properties, properties);
		return this.notifyPropertyChanged();
	}

	public updateProperty(key: string, value: any): Thenable<void> {
		return this.setProperty(key, value);
	}

	public updateCssStyles(cssStyles: { [key: string]: string }): Thenable<void> {
		this.properties.CSSStyles = assign(this.properties.CSSStyles || {}, cssStyles);
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

	public async runCustomValidations(): Promise<boolean> {
		let isValid = true;
		try {
			await Promise.all(this.customValidations.map(async validation => {
				if (!await validation(this)) {
					isValid = false;
				}
			}));
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

	public focus() {
		return this._proxy.$focus(this._handle, this._id);
	}

	public doAction(action: ModelViewAction, ...args: any[]): Thenable<void> {
		return this._proxy.$doAction(this._handle, this._id, action, ...args);
	}
}

class ComponentWithIconWrapper extends ComponentWrapper {

	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, logService: ILogService) {
		super(proxy, handle, type, id, logService);
	}

	public get iconPath(): azdata.IconPath {
		return this.properties['iconPath'];
	}
	public set iconPath(v: azdata.IconPath) {
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
}

class CardWrapper extends ComponentWrapper implements azdata.CardComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Card, id, logService);
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
	public get iconPath(): azdata.IconPath {
		return this.properties['iconPath'];
	}
	public set iconPath(v: azdata.IconPath) {
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

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.InputBox, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
		this._emitterMap.set(ComponentEventType.onEnterKeyPressed, new Emitter<string>());
	}

	public get value(): string {
		return this.properties['value'];
	}
	public set value(v: string) {
		this.setProperty('value', v);
	}

	public get ariaLive(): string {
		return this.properties['ariaLive'];
	}
	public set ariaLive(v: string) {
		this.setProperty('ariaLive', v);
	}

	public get placeHolder(): string {
		return this.properties['placeHolder'];
	}
	public set placeHolder(v: string) {
		this.setProperty('placeHolder', v);
	}

	public get title(): string {
		return this.properties['title'];
	}
	public set title(v: string) {
		this.setProperty('title', v);
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

	public get stopEnterPropagation(): boolean {
		return this.properties['stopEnterPropagation'];
	}
	public set stopEnterPropagation(v: boolean) {
		this.setProperty('stopEnterPropagation', v);
	}

	public get validationErrorMessage(): string {
		return this.properties['validationErrorMessage'];
	}
	public set validationErrorMessage(v: string) {
		this.setProperty('validationErrorMessage', v);
	}

	public get maxLength(): number | undefined {
		return this.properties['maxLength'];
	}

	public set maxLength(v: number | undefined) {
		this.setProperty('maxLength', v);
	}

	public get onTextChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}

	public get onEnterKeyPressed(): vscode.Event<string> {
		const emitter = this._emitterMap.get(ComponentEventType.onEnterKeyPressed);
		return emitter && emitter.event;
	}
}

class CheckBoxWrapper extends ComponentWrapper implements azdata.CheckBoxComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.CheckBox, id, logService);
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
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, private _extensionLocation: URI, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.WebView, id, logService);
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

class EditorWrapper extends ComponentWrapper implements azdata.EditorComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Editor, id, logService);
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
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.DiffEditor, id, logService);
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

	public get title(): string {
		return this.properties['title'];
	}

	public set title(v: string) {
		this.setProperty('title', v);
	}
}

class RadioButtonWrapper extends ComponentWrapper implements azdata.RadioButtonComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.RadioButton, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<boolean>());
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

	public get onDidChangeCheckedState(): vscode.Event<boolean> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class TextComponentWrapper extends ComponentWrapper implements azdata.TextComponentProperties {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Text, id, logService);
		this.properties = {};
	}

	public get value(): string {
		return this.properties['value'];
	}
	public set value(v: string) {
		this.setProperty('value', v);
	}

	public get title(): string {
		return this.properties['title'];
	}
	public set title(title: string) {
		this.setProperty('title', title);
	}

	public get requiredIndicator(): boolean {
		return this.properties['requiredIndicator'];
	}
	public set requiredIndicator(requiredIndicator: boolean) {
		this.setProperty('requiredIndicator', requiredIndicator);
	}
}

class ImageComponentWrapper extends ComponentWithIconWrapper implements azdata.ImageComponentProperties {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Image, id, logService);
		this.properties = {};
	}
}

class TableComponentWrapper extends ComponentWrapper implements azdata.TableComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Table, id, logService);
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

	public get updateCells(): azdata.TableCell[] {
		return this.properties['updateCells'];
	}

	public set updateCells(v: azdata.TableCell[]) {
		this.setProperty('updateCells', v);
	}

	public get onRowSelected(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onSelectedRowChanged);
		return emitter && emitter.event;
	}

	public get onCellAction(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onCellAction);
		return emitter && emitter.event;
	}

	public appendData(v: any[][]): Thenable<void> {
		return this.doAction(ModelViewAction.AppendData, v);
	}
}

class DropDownWrapper extends ComponentWrapper implements azdata.DropDownComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.DropDown, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
	}

	public get value(): string | azdata.CategoryValue {
		let val = this.properties['value'];
		if (!this.editable && !val && this.values && this.values.length > 0) {
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

	public get loading(): boolean {
		return this.properties['loading'];
	}

	public set loading(v: boolean) {
		this.setProperty('loading', v);
	}

	public get loadingText(): string {
		return this.properties['loadingText'];
	}

	public set loadingText(v: string) {
		this.setProperty('loadingText', v);
	}

	public get onValueChanged(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class DeclarativeTableWrapper extends ComponentWrapper implements azdata.DeclarativeTableComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.DeclarativeTable, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<any>());
		this._emitterMap.set(ComponentEventType.onSelectedRowChanged, new Emitter<azdata.DeclarativeTableRowSelectedEvent>());

	}

	public get data(): any[][] {
		return this.properties['data'];
	}

	public set data(v: any[][]) {
		this.clearItems().then(() => {
			this.setProperty('data', v);
		});
	}

	public get dataValues(): azdata.DeclarativeTableCellValue[][] {
		return this.properties['dataValues'];
	}

	public set dataValues(v: azdata.DeclarativeTableCellValue[][]) {
		this.clearItems().then(() => {
			this.setProperty('dataValues', v);
		});
	}

	async setDataValues(v: azdata.DeclarativeTableCellValue[][]): Promise<void> {
		await this.clearItems();
		await this.setProperty('dataValues', v);
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

	public get onRowSelected(): vscode.Event<azdata.DeclarativeTableRowSelectedEvent> {
		let emitter = this._emitterMap.get(ComponentEventType.onSelectedRowChanged);
		return emitter && emitter.event;
	}

	protected override notifyPropertyChanged(): Thenable<void> {
		return this._proxy.$setProperties(this._handle, this._id, this.getPropertiesForMainThread());
	}

	public get enableRowSelection(): boolean | undefined {
		return this.properties['enableRowSelection'];
	}

	public set enableRowSelection(v: boolean | undefined) {
		this.setProperty('enableRowSelection', v);
	}

	public setFilter(rowIndexes: number[]): void {
		this._proxy.$doAction(this._handle, this._id, ModelViewAction.Filter, rowIndexes);
	}

	public get selectedRow(): number {
		return this.properties['selectedRow'] ?? -1;
	}

	public set selectedRow(v: number) {
		this.setProperty('selectedRow', v);
	}

	public override toComponentShape(): IComponentShape {
		// Overridden to ensure we send the correct properties mapping.
		return <IComponentShape>{
			id: this.id,
			type: this.type,
			layout: this.layout,
			properties: this.getPropertiesForMainThread(),
			itemConfigs: this.itemConfigs ? this.itemConfigs.map<IItemConfig>(item => item.toIItemConfig()) : undefined
		};
	}

	/**
	 * Gets the properties map to send to the main thread.
	 */
	private getPropertiesForMainThread(): { [key: string]: string } {
		// This is necessary because we can't send the actual ComponentWrapper objects
		// and so map them into their IDs instead. We don't want to update the actual
		// data property though since the caller would still expect that to contain
		// the Component objects they created
		const properties = assign({}, this.properties);
		const componentsToAdd: ComponentWrapper[] = [];
		if (properties.data?.length > 0) {

			properties.data = properties.data.map((row: any[]) => row.map(cell => {
				if (cell instanceof ComponentWrapper) {
					if (!this.itemConfigs.find(item => item.component.id === cell.id)) {
						// First ensure that we register the component using addItem
						// such that it gets added to the ModelStore. We don't want to
						// make the table component an actual container since that exposes
						// a lot of functionality we don't need.
						componentsToAdd.push(cell);
					}
					return cell.id;
				}
				return cell;
			}));
		} else {
			if (properties.dataValues) {
				properties.dataValues = properties.dataValues.map((row: azdata.DeclarativeTableCellValue[]) => row.map(cell => {
					const cellValue = cell.value;
					if (cellValue instanceof ComponentWrapper) {
						if (!this.itemConfigs.find(item => item.component.id === cellValue.id)) {
							// First ensure that we register the component using addItem
							// such that it gets added to the ModelStore. We don't want to
							// make the table component an actual container since that exposes
							// a lot of functionality we don't need.
							componentsToAdd.push(cellValue);
						}
						return { value: cellValue.id, ariaLabel: cell.ariaLabel, style: cell.style };
					}
					return cell;
				}));
			}
		}
		this.addItems(componentsToAdd);
		return properties;
	}
}

class ListBoxWrapper extends ComponentWrapper implements azdata.ListBoxComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.ListBox, id, logService);
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

class ButtonWrapper extends ComponentWithIconWrapper implements azdata.ButtonComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Button, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
	}

	public get label(): string {
		return this.properties['label'];
	}
	public set label(v: string) {
		this.setProperty('label', v);
	}

	public get fileType(): string {
		return this.properties['fileType'];
	}
	public set fileType(v: string) {
		this.setProperty('fileType', v);
	}

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class LoadingComponentWrapper extends ComponentWrapper implements azdata.LoadingComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.LoadingComponent, id, logService);
		this.properties = {
			loading: true
		};
	}

	public get loading(): boolean {
		return this.properties['loading'];
	}

	public set loading(value: boolean) {
		this.setProperty('loading', value);
	}

	public get showText(): boolean {
		return this.properties['showText'];
	}

	public set showText(value: boolean) {
		this.setProperty('showText', value);
	}

	public get loadingText(): string {
		return this.properties['loadingText'];
	}

	public set loadingText(value: string) {
		this.setProperty('loadingText', value);
	}

	public get loadingCompletedText(): string {
		return this.properties['loadingCompletedText'];
	}

	public set loadingCompletedText(value: string) {
		this.setProperty('loadingCompletedText', value);
	}

	public get component(): azdata.Component {
		return this.items[0];
	}

	public set component(value: azdata.Component) {
		this.addItem(value);
	}
}

class FileBrowserTreeComponentWrapper extends ComponentWrapper implements azdata.FileBrowserTreeComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.FileBrowserTree, id, logService);
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

class SeparatorWrapper extends ComponentWrapper implements azdata.SeparatorComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Separator, id, logService);
	}
}

class DivContainerWrapper extends ComponentWrapper implements azdata.DivContainer {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, logService: ILogService) {
		super(proxy, handle, type, id, logService);
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
		proxy: MainThreadModelViewShape, handle: number, id: string, private _extension: IExtensionDescription, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.TreeComponent, id, logService);
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

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Hyperlink, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<any>());
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

	public get onDidClick(): vscode.Event<any> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class RadioCardGroupComponentWrapper extends ComponentWrapper implements azdata.RadioCardGroupComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.RadioCardGroup, id, logService);
		this.properties = {};

		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<azdata.RadioCardSelectionChangedEvent>());
		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<azdata.RadioCardLinkClickEvent>());
	}

	public get iconWidth(): string | undefined {
		return this.properties['iconWidth'];
	}

	public set iconWidth(v: string | undefined) {
		this.setProperty('iconWidth', v);
	}

	public get iconHeight(): string | undefined {
		return this.properties['iconHeight'];
	}

	public set iconHeight(v: string | undefined) {
		this.setProperty('iconHeight', v);
	}

	public get cardWidth(): string | undefined {
		return this.properties['cardWidth'];
	}

	public set cardWidth(v: string | undefined) {
		this.setProperty('cardWidth', v);
	}

	public get cardHeight(): string | undefined {
		return this.properties['cardHeight'];
	}

	public set cardHeight(v: string | undefined) {
		this.setProperty('cardHeight', v);
	}

	public get cards(): azdata.RadioCard[] {
		return this.properties['cards'];
	}
	public set cards(v: azdata.RadioCard[]) {
		this.setProperty('cards', v);
	}

	public get selectedCardId(): string | undefined {
		return this.properties['selectedCardId'];
	}

	public set selectedCardId(v: string | undefined) {
		this.setProperty('selectedCardId', v);
	}

	public get orientation(): azdata.Orientation | undefined {
		return this.properties['orientation'];
	}

	public set orientation(orientation: azdata.Orientation | undefined) {
		this.setProperty('orientation', orientation);
	}

	public get onSelectionChanged(): vscode.Event<azdata.RadioCardSelectionChangedEvent> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}

	public get onLinkClick(): vscode.Event<azdata.RadioCardLinkClickEvent> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class ListViewComponentWrapper extends ComponentWrapper implements azdata.ListViewComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.ListView, id, logService);
		this.properties = {};

		this._emitterMap.set(ComponentEventType.onDidClick, new Emitter<azdata.ListViewClickEvent>());
	}

	public get title(): azdata.ListViewTitle {
		return this.properties['title'];
	}

	public set title(v: azdata.ListViewTitle) {
		this.setProperty('title', v);
	}

	public get options(): azdata.ListViewOption[] {
		return this.properties['options'];
	}
	public set options(v: azdata.ListViewOption[]) {
		this.setProperty('options', v);
	}

	public get selectedOptionId(): string | undefined {
		return this.properties['selectedOptionId'];
	}

	public set selectedOptionId(v: string | undefined) {
		this.setProperty('selectedOptionId', v);
	}

	public get onDidClick(): vscode.Event<azdata.ListViewClickEvent> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidClick);
		return emitter && emitter.event;
	}
}

class TabbedPanelComponentWrapper extends ComponentWrapper implements azdata.TabbedPanelComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.TabbedPanel, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<string>());
	}

	updateTabs(tabs: (azdata.Tab | azdata.TabGroup)[]): void {
		const itemConfigs = createFromTabs(tabs);
		// Go through all of the tabs and either update their layout if they already exist
		// or add them if they don't.
		// We do not currently support reordering or removing tabs.
		itemConfigs.forEach(newItemConfig => {
			const existingTab = this.itemConfigs.find(itemConfig => newItemConfig.config.id === itemConfig.config.id);
			if (existingTab) {
				this.setItemLayout(existingTab.component, newItemConfig.config);
			} else {
				this.addItem(newItemConfig.component, newItemConfig.config);
			}
		});
	}

	public selectTab(id: string): void {
		this.doAction(ModelViewAction.SelectTab, id);
	}

	public get onTabChanged(): vscode.Event<string> {
		let emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter && emitter.event;
	}
}

class PropertiesContainerComponentWrapper extends ComponentWrapper implements azdata.PropertiesContainerComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.PropertiesContainer, id, logService);
		this.properties = {};
	}

	public get propertyItems(): azdata.PropertiesContainerItem[] {
		return this.properties['propertyItems'];
	}
	public set propertyItems(v: azdata.PropertiesContainerItem[]) {
		this.setProperty('propertyItems', v);
	}

	public get loading(): boolean {
		return this.properties['loading'];
	}
	public set loading(v: boolean) {
		this.setProperty('loading', v);
	}
}

class InfoBoxComponentWrapper extends ComponentWrapper implements azdata.InfoBoxComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.InfoBox, id, logService);
		this.properties = {};
	}

	public get style(): azdata.InfoBoxStyle {
		return this.properties['style'];
	}

	public set style(v: azdata.InfoBoxStyle) {
		this.setProperty('style', v);
	}

	public get text(): string {
		return this.properties['text'];
	}

	public set text(v: string) {
		this.setProperty('text', v);
	}

	public get announceText(): boolean {
		return this.properties['announceText'];
	}

	public set announceText(v: boolean) {
		this.setProperty('announceText', v);
	}
}

class SliderComponentWrapper extends ComponentWrapper implements azdata.SliderComponent {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string, logService: ILogService) {
		super(proxy, handle, ModelComponentTypes.Slider, id, logService);
		this.properties = {};
		this._emitterMap.set(ComponentEventType.onDidChange, new Emitter<number>());
		this._emitterMap.set(ComponentEventType.onInput, new Emitter<number>());
	}

	public get min(): number | undefined {
		return this.properties['min'];
	}

	public set min(v: number | undefined) {
		this.setProperty('min', v);
	}

	public get max(): number | undefined {
		return this.properties['max'];
	}

	public set max(v: number | undefined) {
		this.setProperty('max', v);
	}

	public get step(): number | undefined {
		return this.properties['step'];
	}

	public set step(v: number | undefined) {
		this.setProperty('step', v);
	}

	public get value(): number | undefined {
		return this.properties['value'];
	}

	public set value(v: number | undefined) {
		this.setProperty('value', v);
	}

	public get showTicks(): boolean | undefined {
		return this.properties['showTicks'];
	}

	public set showTicks(v: boolean | undefined) {
		this.setProperty('showTicks', v);
	}

	public get onChanged(): vscode.Event<number> {
		const emitter = this._emitterMap.get(ComponentEventType.onDidChange);
		return emitter!.event;
	}

	public get onInput(): vscode.Event<number> {
		const emitter = this._emitterMap.get(ComponentEventType.onInput);
		return emitter!.event;
	}
}

class GroupContainerComponentWrapper extends ComponentWrapper implements azdata.GroupContainer {
	constructor(proxy: MainThreadModelViewShape, handle: number, type: ModelComponentTypes, id: string, logService: ILogService) {
		super(proxy, handle, type, id, logService);
		this.properties = {};
	}
	public get collapsed(): boolean {
		return this.properties['collapsed'];
	}
	public set collapsed(v: boolean) {
		this.setProperty('collapsed', v);
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
		private readonly _extHostModelViewTree: ExtHostModelViewTreeViewsShape,
		_extension: IExtensionDescription,
		logService: ILogService
	) {
		this._modelBuilder = new ModelBuilderImpl(this._proxy, this._handle, this._extHostModelViewTree, _extension, logService);
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

	public runCustomValidations(componentId: string): Thenable<boolean> {
		return this._modelBuilder.runCustomValidations(componentId);
	}
}

export class ExtHostModelView implements ExtHostModelViewShape {
	private readonly _proxy: MainThreadModelViewShape;

	private readonly _modelViews = new Map<number, ModelViewImpl>();
	private readonly _handlers = new Map<string, (view: azdata.ModelView) => void>();
	private readonly _handlerToExtension = new Map<string, IExtensionDescription>();
	constructor(
		_mainContext: IMainContext,
		private _extHostModelViewTree: ExtHostModelViewTreeViewsShape,
		private readonly logService: ILogService
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
		let view = new ModelViewImpl(this._proxy, handle, connection, serverInfo, this._extHostModelViewTree, extension, this.logService);
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
		return view.runCustomValidations(componentId);
	}
}
