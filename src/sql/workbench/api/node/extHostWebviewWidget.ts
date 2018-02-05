/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlMainContext, MainThreadModalDialogShape, ExtHostModalDialogsShape, ExtHostWebviewWidgetsShape, MainThreadWebviewWidgetShape } from 'sql/workbench/api/node/sqlextHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import * as vscode from 'vscode';
import * as data from 'data';
import { Emitter } from 'vs/base/common/event';

class ExtHostWebviewWidget implements data.WebviewWidget {

	private _html: string;
	public onMessageEmitter = new Emitter<any>();
	public onClosedEmitter = new Emitter<any>();

	constructor(
		private readonly _proxy: MainThreadWebviewWidgetShape,
		private readonly _handle: number,
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

export class ExtHostWebviewWidgets implements ExtHostWebviewWidgetsShape {
	private readonly _proxy: MainThreadWebviewWidgetShape;

	private readonly _webviews = new Map<number, ExtHostWebviewWidget>();
	private readonly _handlers = new Map<string, (webview: data.WebviewWidget) => void>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.get(SqlMainContext.MainThreadWebviewWidget);
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

	$registerProvider(widgetId: string, handler: (webview: data.WebviewWidget) => void): void {
		this._handlers.set(widgetId, handler);
		this._proxy.$registerProvider(widgetId);
	}

	$registerWidget(handle: number, id: string): void {
		let webview = new ExtHostWebviewWidget(this._proxy, handle);
		this._webviews.set(handle, webview);
		this._handlers.get(id)(webview);
	}
}
