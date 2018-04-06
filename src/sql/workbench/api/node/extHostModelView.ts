/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlMainContext, ExtHostModelViewShape, MainThreadModelViewShape, ModelComponentTypes } from 'sql/workbench/api/node/sqlExtHost.protocol';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

class ComponentWrapperBase implements sqlops.Component {
	protected properties: { [key: string]: any };

	constructor(protected readonly _proxy: MainThreadModelViewShape,
		protected readonly _handle: number, protected _id: string) {
		this.properties = {};
	}

	public get id(): string {
		return this._id;
	}

	withComponents(components: sqlops.Component[], config?: any): sqlops.Container {
		this._proxy.$clearContainer(this._handle, this.id);
		for (let component of components) {
			this.addComponent(component, config);
		}
		return this;
	}
	addComponent(component: sqlops.Component, config?: any): sqlops.Container {
		this._proxy.$addToContainer(this._handle, this.id, component.id, config);
		return this;
	}

	withProperties(properties: { [key: string]: any }): sqlops.Component {
		this.properties = properties;
		this.notifyPropertyChanged();
		return this;
	}

	protected notifyPropertyChanged() {
		this._proxy.$setProperties(this._handle, this._id, this.properties);
	}

	protected setProperty(key: string, value: any): void {
		if (!this.properties[key] || this.properties[key] !== value) {
			// Only notify the frontend if a value has been updated
			this.properties[key] = value;
			this.notifyPropertyChanged();
		}
	}

}

class NavContainerWrapper extends ComponentWrapperBase implements sqlops.NavContainer {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, id);
	}
}

class FlexContainerWrapper extends ComponentWrapperBase implements sqlops.FlexContainer {
	constructor(proxy: MainThreadModelViewShape, handle: number, id: string) {
		super(proxy, handle, id);
	}

	withLayout(layout: sqlops.FlexContainerConfig): sqlops.FlexContainer {
		this._proxy.$setLayout(this._handle, this._id, layout);
		return this;
	}
}

class CardContainerWrapper extends ComponentWrapperBase implements sqlops.CardComponent {

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

	withConfig(label: string, value: string, actions?: sqlops.ActionDescriptor[]) {
		this.withProperties({
			label: label,
			value: value,
			actions: actions
		});
	}
}

class ModelBuilderImpl implements sqlops.ViewModelBuilder {

	constructor(private readonly _proxy: MainThreadModelViewShape,
		private readonly _handle: number,
	) {

	}
	createNavContainer(): sqlops.NavContainer {
		let componentId = this._proxy.$createComponent(this._handle, ModelComponentTypes.NavContainer);
		return new NavContainerWrapper(this._proxy, this._handle, componentId);
	}
	createFlexContainer(): sqlops.FlexContainer {
		let componentId = this._proxy.$createComponent(this._handle, ModelComponentTypes.FlexContainer);
		return new FlexContainerWrapper(this._proxy, this._handle, componentId);
	}
	createCard(): sqlops.CardComponent {
		throw new Error('Method not implemented.');
	}
	createDashboardWidget(id: string): sqlops.CardComponent {
		throw new Error('Method not implemented.');
	}
	createDashboardWebview(id: string): sqlops.CardComponent {
		throw new Error('Method not implemented.');
	}
}
class ModelViewImpl implements sqlops.DashboardModelView {

	public onClosedEmitter = new Emitter<any>();

	private _modelBuilder: sqlops.ViewModelBuilder;

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

	public get modelBuilder(): sqlops.ViewModelBuilder {
		return this._modelBuilder;
	}

	public set model(component: sqlops.Component) {
		this._proxy.$setModel(this._handle, component.id);
	}
}

export class ExtHostModelView implements ExtHostModelViewShape {
	private readonly _proxy: MainThreadModelViewShape;

	private readonly _modelViews = new Map<number, ModelViewImpl>();
	private readonly _handlers = new Map<string, (view: sqlops.DashboardModelView) => void>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.get(SqlMainContext.MainThreadModelView);
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
