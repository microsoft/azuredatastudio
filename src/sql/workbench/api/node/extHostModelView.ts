/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import * as extHostTypes from 'vs/workbench/api/node/extHostTypes';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import { SqlMainContext, ExtHostModelViewShape, MainThreadModelViewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ModelComponentTypes, IComponentConfigurationShape, IItemConfig } from 'sql/parts/dashboard/contents/mvvm/interfaces';

class ModelBuilderImpl implements sqlops.ModelBuilder {
	private nextComponentId: number;

	constructor(private readonly _handle: number) {
		this.nextComponentId = 0;
	}

	component<T extends sqlops.Component>(componentTypeName: string): sqlops.ComponentConfiguration<T> {
		let id =this.getNextComponentId();
		switch (componentTypeName) {
			case ModelComponentTypes[ModelComponentTypes.DashboardWidget]:
				return new ComponentConfigurationImpl(ModelComponentTypes.DashboardWidget, id);
			case ModelComponentTypes[ModelComponentTypes.DashboardWebview]:
				return new ComponentConfigurationImpl(ModelComponentTypes.DashboardWebview, id);
			default:
				throw new Error(nls.localize('unknownComponent', 'Component of type {0} is not known', componentTypeName));
		}
	}

	navContainer(): sqlops.NavContainerConfiguration {
		return new ContainerConfigImpl(ModelComponentTypes.NavContainer, this.getNextComponentId());
	}

	flexContainer(): sqlops.FlexContainerConfiguration {
		return new ContainerConfigImpl(ModelComponentTypes.FlexContainer, this.getNextComponentId());
	}

	card(): sqlops.CardConfiguration {
		let id =this.getNextComponentId();
		return new CardConfigurationImpl(id);
	}
	dashboardWidget(id: string): sqlops.ComponentConfiguration<sqlops.WidgetComponent> {
		return this.component<sqlops.CardComponent>(ModelComponentTypes[ModelComponentTypes.DashboardWidget]);
	}
	dashboardWebview(id: string): sqlops.ComponentConfiguration<sqlops.WebviewComponent> {
		return this.component<sqlops.CardComponent>(ModelComponentTypes[ModelComponentTypes.DashboardWebview]);
	}

	private getNextComponentId(): string {
		return `component${this._handle}_${this.nextComponentId++}`;
	}
}


class ComponentConfigurationImpl<T extends sqlops.Component> implements sqlops.ComponentConfiguration<T>, IComponentConfigurationShape {
	public properties: { [key: string]: any } = {};
	public items: IItemConfig[];
	public layout: any;

	constructor(private _type: ModelComponentTypes, private _id: string) {

	}
	withProperties<U>(properties: U): sqlops.ComponentConfiguration<T> {
		this.properties = properties;
		return this;
	}

	protected setProperty(key: string, value: any): void {
		this.properties[key] = value;
	}

	public get id(): string {
		return this._id;
	}

	public get type(): ModelComponentTypes {
		return this._type;
	}

	public createComponent(proxy: MainThreadModelViewShape, handle: number): T {
		switch(this.type) {
			case ModelComponentTypes.Card:
				return <T><any> new CardWrapper(proxy, handle, this.id);
			case ModelComponentTypes.FlexContainer:
				return <T><any> new ContainerWrapper<sqlops.FlexLayout, sqlops.FlexItemLayout>(proxy, handle, this.id);
			case ModelComponentTypes.DashboardWebview:
				throw new Error('Not Implemented');
			case ModelComponentTypes.DashboardWidget:
				throw new Error('Not Implemented');
		}
		throw new Error('Not Implemented');
	}
}

class CardConfigurationImpl extends ComponentConfigurationImpl<sqlops.CardComponent> implements sqlops.CardConfiguration, IComponentConfigurationShape {

	constructor(id: string) {
		super(ModelComponentTypes.Card, id);
	}

	withLabelValue(label: string, value: string): sqlops.CardConfiguration {
		this.setProperty('label', label);
		this.setProperty('value', value);
		return this;
	}
	withActions(actions: sqlops.ActionDescriptor[]): sqlops.CardConfiguration {
		this.setProperty('actions', actions);
		return this;
	}
}
class ItemConfig implements IItemConfig {
	constructor(public component: IComponentConfigurationShape, public config: any) {}
}

class ContainerConfigImpl<T extends sqlops.Component, U, V> extends ComponentConfigurationImpl<T> implements sqlops.ContainerConfiguration<T, U, V> {
	constructor(type: ModelComponentTypes, id: string) {
		super(type, id);
	}

	withItems(items: sqlops.ComponentConfiguration<any>[], itemLayout?: V): sqlops.ContainerConfiguration<T, U, V> {
		for (let item of items) {
			this.addItem(item, itemLayout);
		}
		return this;
	}

	addItem(item: sqlops.ComponentConfiguration<any>, itemLayout?: V): sqlops.ContainerConfiguration<T, U, V> {
		this.ensureItems();
		let itemImpl = item as ComponentConfigurationImpl<any>;
		this.items.push(new ItemConfig(itemImpl, itemLayout));
		return this;
	}

	private ensureItems() {
		if (!this.items) {
			this.items = [];
		}
		return this;
	}

	withLayout(layout: U): sqlops.ContainerConfiguration<T, U, V> {
		this.layout = layout;
		return this;
	}
}

class ComponentWrapper implements sqlops.Component {
	protected properties: { [key: string]: any } = {};

	constructor(protected readonly _proxy: MainThreadModelViewShape,
		protected readonly _handle: number, protected _id: string
	) {
		this.properties = {};
	}

	public get id(): string {
		return this._id;
	}

	get items(): sqlops.Component[] {
		// TODO
		return undefined;
	}

	public clearItems(): Thenable<void> {
		return this._proxy.$clearContainer(this._handle, this.id);
	}

	public createItems(itemConfigs: Array<sqlops.ComponentConfiguration<any>>, itemLayout ?: any): Thenable<Array<sqlops.Component>> {
		let promises: Thenable<any>[] = [];
		let items = new Map<number, sqlops.Component>();
		// Kick off all createComponent requests
		for(let i = 0; i < itemConfigs.length; i++) {
			let item = itemConfigs[0];
			let promise = this.createItem(item, itemLayout).then(component => {
				items.set(i, component);
			});
		}
		// On finishing the creation, return a single object with component references
		return Promise.all(promises).then(success => {
			let components: sqlops.Component[] = [];
			for (let i = 0; i < itemConfigs.length; i++) {
				components.push(items[i]);
			}
			return components;
		}, error => Promise.reject(error));
	}

	public createItem(item: sqlops.ComponentConfiguration<any>, itemLayout ?: any): Thenable<sqlops.Component> {
		let itemImpl = item as ComponentConfigurationImpl<any>;
		return this._proxy.$addToContainer(this._handle, this.id, {
			component: itemImpl,
			config: itemLayout
		}).then(() => {
			return new ComponentWrapper(this._proxy, this._handle, itemImpl.id);
		});
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
			// Only notify the frontend if a value has been updated
			this.properties[key] = value;
			return this.notifyPropertyChanged();
		}
		return Promise.resolve(true);
	}
}

class ContainerWrapper<T, U> extends ComponentWrapper implements sqlops.Container<T, U> {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, id);
	}

}


class CardWrapper extends ComponentWrapper implements sqlops.CardComponent {

	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, id);
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

class ModelViewImpl implements sqlops.DashboardModelView {

	public onClosedEmitter = new Emitter<any>();

	private _modelBuilder: sqlops.ModelBuilder;

	constructor(
		private readonly _proxy: MainThreadModelViewShape,
		private readonly _handle: number,
		private readonly _connection: sqlops.connection.Connection,
		private readonly _serverInfo: sqlops.ServerInfo
	) {
		this._modelBuilder = undefined; // new ModelBuilderImpl(this._handle);
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

	public initializeModel<T extends sqlops.Component>(config: sqlops.ComponentConfiguration<T>): Thenable<T> {
		// let configImpl = config as ComponentConfigurationImpl<T>;
		// if (!configImpl) {
		// 	return Promise.reject<T>(nls.localize('unknownConfig', 'Unkown component configuration, must use ModelBuilder to create a configuration object'));
		// }
		// return this._proxy.$initializeModel(this._handle, configImpl).then(() => {
		// 	// TODO convert back into a set of components by walking the tree
		// 	return configImpl.createComponent(this._proxy, this._handle);
		// });
		return undefined;
	}

}

export class ExtHostModelView implements ExtHostModelViewShape {
	private readonly _proxy: MainThreadModelViewShape;

	private readonly _modelViews = new Map<number, ModelViewImpl>();
	private readonly _handlers = new Map<string, (view: sqlops.DashboardModelView) => void>();

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

	$registerProvider(widgetId: string, handler: (webview: sqlops.DashboardModelView) => void): void {
		this._handlers.set(widgetId, handler);
		this._proxy.$registerProvider(widgetId);
	}

	$registerWidget(handle: number, id: string, connection: sqlops.connection.Connection, serverInfo: sqlops.ServerInfo): void {
		let view = new ModelViewImpl(this._proxy, handle, connection, serverInfo);
		this._modelViews.set(handle, view);
		this._handlers.get(id)(view);
	}
}
