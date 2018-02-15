/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlMainContext, MainThreadModalDialogShape, ExtHostModalDialogsShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import * as vscode from 'vscode';
import * as data from 'data';
import * as views from 'views';
import { Emitter } from 'vs/base/common/event';

export enum ControlTypes {
	button = 0
}

export class ExtButton implements views.Button {
	public label: string;
	private _containerId: string;
	private _onClickedEmitter = new Emitter<any>();
	private _events: {[name: string]: Emitter<any>} = {}

	constructor() {
		this._events["onclick"] = this._onClickedEmitter;
	}

	public set containerId(value: string) {
		this._containerId = value;
	}

	public get containerId(): string {
		return this._containerId;
	}

	public get onClicked(): vscode.Event<any> {
		return this._onClickedEmitter.event;
	}

	public fireEvent(eventName: string) {
		let event = this._events[eventName];
		if (event) {
			event.fire();
		}
	}
}

class ExtHostDialog implements data.ModalDialog {
	private _title: string;
	private _html: string;
	private _okTitle: string;
	private _closeTitle: string;
	public onMessageEmitter = new Emitter<any>();
	public onClosedEmitter = new Emitter<any>();
	private _buttons : ExtButton[] = [];

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

	public addControl(controlType: ControlTypes, containerId: string): any {
		switch (controlType) {
			case ControlTypes.button:
				return this.addButton(containerId);
			default:
				return undefined;
		}
	}

	private loadButtons() {
		let index = 0;
		this._buttons.forEach(control => {
			let uiControl: views.UIControl = {
				type: ControlTypes.button,
				control: control,
				container: control.containerId,
				id: index
			};
			this.postMessage(uiControl);
			index = index + 1;
		});
	}

	private addButton(containerId: string): views.Button {
		let button = new ExtButton();
		button.containerId = containerId;
		this._buttons.push(button);
		return button;
	}

	public onLoaded() {
		this.loadButtons();
	}

	public onControlEvent(args: views.ControlEventArgs) {
		let id: number = args.id;
		let button = this._buttons[id];
		if (button) {
			button.fireEvent(args.event);
		}
	}
}

export class ExtHostModalDialogs implements ExtHostModalDialogsShape {
	private static _handlePool = 0;

	private readonly _proxy: MainThreadModalDialogShape;

	private readonly _webviews = new Map<number, ExtHostDialog>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.get(SqlMainContext.MainThreadModalDialog);
	}

	createDialog(
		title: string
	): data.ModalDialog {
		const handle = ExtHostModalDialogs._handlePool++;
		this._proxy.$createDialog(handle);

		const webview = new ExtHostDialog(this._proxy, handle);
		this._webviews.set(handle, webview);
		webview.title = title;
		return webview;
	}

	$onMessage(handle: number, message: any): void {
		const webview = this._webviews.get(handle);
		if (message && message.event) {
			webview.onControlEvent(message);
		}
		webview.onMessageEmitter.fire(message);
	}

	$onClosed(handle: number): void {
		const webview = this._webviews.get(handle);
		webview.onClosedEmitter.fire();
	}

	$onLoaded(handle: number): void {
		const webview = this._webviews.get(handle);
		webview.onLoaded();
	}
}