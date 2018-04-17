/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import { SqlMainContext, ExtHostModelViewShape, MainThreadModelViewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';

class ModelBuilderImpl implements sqlops.ModelBuilder {
	private nextComponentId: number;

	constructor(private readonly _proxy: MainThreadModelViewShape, private readonly _handle: number) {
		this.nextComponentId = 0;
	}

	navContainer(): sqlops.ContainerBuilder<sqlops.NavContainer, any, any> {
		let id = this.getNextComponentId();
		return new ContainerBuilderImpl(this._proxy, this._handle, ModelComponentTypes.NavContainer, id);
	}

	flexContainer(): sqlops.FlexBuilder {
		let id = this.getNextComponentId();
		return new ContainerBuilderImpl<sqlops.FlexContainer, sqlops.FlexLayout, sqlops.FlexItemLayout>(this._proxy, this._handle, ModelComponentTypes.FlexContainer, id);
	}

	card(): sqlops.ComponentBuilder<sqlops.CardComponent> {
		let id = this.getNextComponentId();
		return new ComponentBuilderImpl(new CardWrapper(this._proxy, this._handle, id));
	}

	dashboardWidget(widgetId: string): sqlops.ComponentBuilder<sqlops.WidgetComponent> {
		let id = this.getNextComponentId();
		return new ComponentBuilderImpl<sqlops.WidgetComponent>(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWidget, id));
	}

	dashboardWebview(webviewId: string): sqlops.ComponentBuilder<sqlops.WebviewComponent> {
		let id = this.getNextComponentId();
		return new ComponentBuilderImpl(new ComponentWrapper(this._proxy, this._handle, ModelComponentTypes.DashboardWebview, id));
	}

	private getNextComponentId(): string {
		return `component${this._handle}_${this.nextComponentId++}`;
	}
}

class ComponentBuilderImpl<T extends sqlops.Component> implements sqlops.ComponentBuilder<T> {

	constructor(protected _component: ComponentWrapper) {
	}

	component(): T {
		return <T><any>this._component;
	}

	withProperties<U>(properties: U): sqlops.ComponentBuilder<T> {
		this._component.properties = properties;
		return this;
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


class InternalItemConfig {
	constructor(private _component: ComponentWrapper, public config: any) {}

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

	private _onErrorEmitter = new Emitter<Error>();
	public readonly onError: vscode.Event<Error> = this._onErrorEmitter.event;

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

	public toComponentShape(): IComponentShape {
		return <IComponentShape> {
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

	public addItems(items: Array<sqlops.Component>, itemLayout ?: any): void {
		for(let item of items) {
			this.addItem(item, itemLayout);
		}
	}

	public addItem(item: sqlops.Component, itemLayout ?: any): void {
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

	public updateProperties(): Thenable<boolean> {
		return this.notifyPropertyChanged();
	}

	protected notifyPropertyChanged(): Thenable<boolean> {
		return this._proxy.$setProperties(this._handle, this._id, this.properties).then(() => true);
	}

	protected setProperty(key: string, value: any): Thenable<boolean> {
		if (!this.properties[key] || this.properties[key] !== value) {
			// Only notify the front end if a value has been updated
			this.properties[key] = value;
			return this.notifyPropertyChanged();
		}
		return Promise.resolve(true);
	}

	private handleError(err: Error): void {
		this._onErrorEmitter.fire(err);
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
	public get actions(): sqlops.ActionDescriptor[] {
		return this.properties['actions'];
	}
	public set actions(a: sqlops.ActionDescriptor[]) {
		this.setProperty('actions', a);
	}
}

class ModelViewImpl implements sqlops.ModelView {

	public onClosedEmitter = new Emitter<any>();

	private _modelBuilder: sqlops.ModelBuilder;

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

	public initializeModel<T extends sqlops.Component>(component: T): Thenable<void> {
		let componentImpl = <any>component as ComponentWrapper;
		if (!componentImpl) {
			return Promise.reject(nls.localize('unknownConfig', 'Unkown component configuration, must use ModelBuilder to create a configuration object'));
		}
		return this._proxy.$initializeModel(this._handle, componentImpl.toComponentShape());
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
}
