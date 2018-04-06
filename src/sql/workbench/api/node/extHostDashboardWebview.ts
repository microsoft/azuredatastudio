/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlMainContext, ExtHostDashboardWebviewsShape, MainThreadDashboardWebviewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

class ExtHostDashboardWebview implements sqlops.DashboardWebview {

	private _html: string;
	public onMessageEmitter = new Emitter<any>();
	public onClosedEmitter = new Emitter<any>();

	constructor(
		private readonly _proxy: MainThreadDashboardWebviewShape,
		private readonly _handle: number,
		private readonly _connection: sqlops.connection.Connection,
		private readonly _serverInfo: sqlops.ServerInfo
	) { }

	public postMessage(message: any): Thenable<any> {
		return this._proxy.$sendMessage(this._handle, message);
	}

	public get onMessage(): vscode.Event<any> {
		return this.onMessageEmitter.event;
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

	get html(): string {
		return this._html;
	}

	set html(value: string) {
		if (this._html !== value) {
			this._html = value;
			this._proxy.$setHtml(this._handle, value);
		}
	}
}

export class ExtHostDashboardWebviews implements ExtHostDashboardWebviewsShape {
	private readonly _proxy: MainThreadDashboardWebviewShape;

	private readonly _webviews = new Map<number, ExtHostDashboardWebview>();
	private readonly _handlers = new Map<string, (webview: sqlops.DashboardWebview) => void>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadDashboardWebview);
	}

	$onMessage(handle: number, message: any): void {
		const webview = this._webviews.get(handle);
		webview.onMessageEmitter.fire(message);
	}

	$onClosed(handle: number): void {
		const webview = this._webviews.get(handle);
		webview.onClosedEmitter.fire();
		this._webviews.delete(handle);
	}

	$registerProvider(widgetId: string, handler: (webview: sqlops.DashboardWebview) => void): void {
		this._handlers.set(widgetId, handler);
		this._proxy.$registerProvider(widgetId);
	}

	$registerWidget(handle: number, id: string, connection: sqlops.connection.Connection, serverInfo: sqlops.ServerInfo): void {
		let webview = new ExtHostDashboardWebview(this._proxy, handle, connection, serverInfo);
		this._webviews.set(handle, webview);
		this._handlers.get(id)(webview);
	}
}
