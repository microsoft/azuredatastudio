/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import Event, { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import { SqlMainContext, ExtHostModelViewDialogShape, MainThreadModelViewDialogShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';

class DialogImpl implements sqlops.window.modelviewdialog.Dialog {
	public title: string;
	public content: string | TabImpl[];
	public okTitle: string;
	public cancelTitle: string;
	public customButtons: ButtonImpl[];

	private readonly _onOk = new Emitter<void>();
	public readonly onOk = this._onOk.event;
	private readonly _onCancel = new Emitter<void>();
	public readonly onCancel = this._onCancel.event;

	constructor(private _handle: number, private _extHostModelViewDialog: ExtHostModelViewDialog) {
		this._extHostModelViewDialog.registerOnOkCallback(this._handle, () => this._onOk.fire());
		this._extHostModelViewDialog.registerOnCancelCallback(this._handle, () => this._onCancel.fire());
	}

	public open(): void {
		this._extHostModelViewDialog.open(this._handle);
	}

	public close(): void {
		this._extHostModelViewDialog.close(this._handle);
	}

	public updateContent(): void {
		this._extHostModelViewDialog.updateDialogContent(this._handle);
	}
}

class TabImpl implements sqlops.window.modelviewdialog.DialogTab {
	public title: string;
	public content: string;

	constructor(private _handle: number, private _extHostModelViewDialog: ExtHostModelViewDialog) { }

	public updateContent(): void {
		this._extHostModelViewDialog.updateTabContent(this._handle);
	}
}

class ButtonImpl implements sqlops.window.modelviewdialog.Button {
	private _label: string;
	private _enabled: boolean;

	private _onClick = new Emitter<void>();
	public onClick = this._onClick.event;

	constructor(private _handle: number, private _extHostModelViewDialog: ExtHostModelViewDialog) {
		this._extHostModelViewDialog.registerOnClickCallback(this._handle, () => this._onClick.fire());
	}

	public get label(): string {
		return this._label;
	}

	public set label(label: string) {
		this._label = label;
		this._extHostModelViewDialog.updateButton(this._handle);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		this._enabled = enabled;
		this._extHostModelViewDialog.updateButton(this._handle);
	}
}

export class ExtHostModelViewDialog implements ExtHostModelViewDialogShape {
	private static _currentHandle = 0;

	private readonly _proxy: MainThreadModelViewDialogShape;

	private readonly _dialogs = new Map<number, DialogImpl>();
	private readonly _tabs = new Map<number, TabImpl>();
	private readonly _buttons = new Map<number, ButtonImpl>();

	private readonly _onOkCallbacks = new Map<number, () => void>();
	private readonly _onCancelCallbacks = new Map<number, () => void>();
	private readonly _onClickCallbacks = new Map<number, () => void>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadModelViewDialog);
	}

	public $onOk(handle: number): void {
		this._onOkCallbacks.get(handle)();
	}

	public $onCancel(handle: number): void {
		this._onCancelCallbacks.get(handle)();
	}

	public $onButtonClick(handle: number): void {
		this._onClickCallbacks.get(handle)();
	}

	public open(handle: number): void {
		this.updateDialogContent(handle);
		this._proxy.$open(handle);
	}

	public close(handle: number): void {
		this._proxy.$close(handle);
	}

	public updateDialogContent(handle: number): void {
		let dialog = this._dialogs.get(handle);
		let tabs = dialog.content;
		if (tabs && typeof tabs !== 'string') {
			tabs.forEach(tab => this._proxy.$setTabDetails((tab as any)._handle, {
				title: tab.title,
				content: tab.content
			}));
		}
		if (dialog.customButtons) {
			dialog.customButtons.forEach(button => this._proxy.$setButtonDetails((button as any)._handle, {
				label: button.label,
				enabled: button.enabled
			}));
		}
		this._proxy.$setDialogDetails(handle, {
			title: dialog.title,
			okTitle: dialog.okTitle,
			cancelTitle: dialog.cancelTitle,
			content: dialog.content && typeof dialog.content !== 'string' ? dialog.content.map(tab => (tab as any)._handle) : dialog.content as string,
			customButtons: dialog.customButtons ? dialog.customButtons.map(button => (button as any)._handle) : undefined
		});
	}

	public updateTabContent(handle: number): void {
		let tab = this._tabs.get(handle);
		this._proxy.$setTabDetails(handle, {
			title: tab.title,
			content: tab.content
		});
	}

	public updateButton(handle: number): void {
		let button = this._buttons.get(handle);
		this._proxy.$setButtonDetails(handle, {
			label: button.label,
			enabled: button.enabled
		});
	}

	public registerOnOkCallback(handle: number, callback: () => void) {
		this._onOkCallbacks.set(handle, callback);
	}

	public registerOnCancelCallback(handle: number, callback: () => void) {
		this._onCancelCallbacks.set(handle, callback);
	}

	public registerOnClickCallback(handle: number, callback: () => void) {
		this._onClickCallbacks.set(handle, callback);
	}

	public createDialog(title: string): sqlops.window.modelviewdialog.Dialog {
		let dialog = new DialogImpl(ExtHostModelViewDialog._currentHandle, this);
		dialog.title = title;
		this._dialogs.set(ExtHostModelViewDialog._currentHandle, dialog);
		ExtHostModelViewDialog._currentHandle += 1;
		return dialog;
	}

	public createTab(title: string): sqlops.window.modelviewdialog.DialogTab {
		let tab = new TabImpl(ExtHostModelViewDialog._currentHandle, this);
		tab.title = title;
		this._tabs.set(ExtHostModelViewDialog._currentHandle, tab);
		ExtHostModelViewDialog._currentHandle += 1;
		return tab;
	}

	public createButton(label: string): sqlops.window.modelviewdialog.Button {
		let button = new ButtonImpl(ExtHostModelViewDialog._currentHandle, this);
		button.label = label;
		this._buttons.set(ExtHostModelViewDialog._currentHandle, button);
		ExtHostModelViewDialog._currentHandle += 1;
		return button;
	}
}