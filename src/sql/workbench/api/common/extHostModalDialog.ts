/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlMainContext, MainThreadModalDialogShape, ExtHostModalDialogsShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { Emitter } from 'vs/base/common/event';

class ExtHostDialog implements azdata.ModalDialog {
	private _title: string;
	private _html: string;
	private _okTitle: string;
	private _closeTitle: string;
	public onMessageEmitter = new Emitter<any>();
	public onClosedEmitter = new Emitter<any>();

	constructor(
		private readonly _proxy: MainThreadModalDialogShape,
		private readonly _handle: number,
	) { }

	get title(): string {
		return this._title;
	}

	set title(value: string) {
		if (this._title !== value) {
			this._title = value;
			this._proxy.$setTitle(this._handle, value);
		}
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

	public set okTitle(value: string) {
		this._okTitle = value;
	}

	public get okTitle(): string {
		return this._okTitle;
	}

	public set closeTitle(value: string) {
		this._closeTitle = value;
	}

	public get closeTitle(): string {
		return this._closeTitle;
	}

	public open(): void {
		this._proxy.$show(this._handle);
	}

	public close(): void {
		this._proxy.$disposeDialog(this._handle);
	}

	public postMessage(message: any): Thenable<any> {
		return this._proxy.$sendMessage(this._handle, message);
	}

	public get onMessage(): vscode.Event<any> {
		return this.onMessageEmitter.event;
	}

	public get onClosed(): vscode.Event<any> {
		return this.onClosedEmitter.event;
	}
}

export class ExtHostModalDialogs implements ExtHostModalDialogsShape {
	private static _handlePool = 0;

	private readonly _proxy: MainThreadModalDialogShape;

	private readonly _webviews = new Map<number, ExtHostDialog>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadModalDialog);
	}

	createDialog(
		title: string
	): azdata.ModalDialog {
		const handle = ExtHostModalDialogs._handlePool++;
		this._proxy.$createDialog(handle);

		const webview = new ExtHostDialog(this._proxy, handle);
		this._webviews.set(handle, webview);
		webview.title = title;
		//webview.options = options;
		//this._proxy.$show(handle);
		return webview;
	}

	$onMessage(handle: number, message: any): void {
		const webview = this._webviews.get(handle);
		webview.onMessageEmitter.fire(message);
	}

	$onClosed(handle: number): void {
		const webview = this._webviews.get(handle);
		webview.onClosedEmitter.fire(undefined);
	}
}
