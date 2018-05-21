/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { MainThreadModelViewDialogShape, SqlMainContext, ExtHostModelViewDialogShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { Dialog, DialogTab, DialogButton } from 'sql/platform/dialog/dialogTypes';
import { CustomDialogService } from 'sql/platform/dialog/customDialogService';
import { IModelViewDialogDetails, IModelViewTabDetails, IModelViewButtonDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ModelViewInput } from 'sql/parts/modelComponents/modelEditor/modelViewInput';

import * as vscode from 'vscode';

@extHostNamedCustomer(SqlMainContext.MainThreadModelViewDialog)
export class MainThreadModelViewDialog implements MainThreadModelViewDialogShape {
	private readonly _proxy: ExtHostModelViewDialogShape;
	private readonly _dialogs = new Map<number, Dialog>();
	private readonly _tabs = new Map<number, DialogTab>();
	private readonly _buttons = new Map<number, DialogButton>();
	private _dialogService: CustomDialogService;

	constructor(
		context: IExtHostContext,
		@IInstantiationService instatiationService: IInstantiationService,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService
	) {
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModelViewDialog);
		this._dialogService = new CustomDialogService(instatiationService);
	}

	public dispose(): void {
		throw new Error('Method not implemented.');
	}

	public $openEditor(modelViewId: string, title: string, position?: vscode.ViewColumn): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			let input = new ModelViewInput(title, modelViewId);
			let editorOptions = {
				preserveFocus: true,
				pinned: true
			};

			this._editorService.openEditor(input, editorOptions, position as any).then(() => {
				resolve();
			}, error => {
				reject(error);
			});
		});
	}

	public $open(handle: number): Thenable<void> {
		let dialog = this.getDialog(handle);
		this._dialogService.showDialog(dialog);
		return Promise.resolve();
	}

	public $close(handle: number): Thenable<void> {
		let dialog = this.getDialog(handle);
		this._dialogService.closeDialog(dialog);
		return Promise.resolve();
	}

	public $setDialogDetails(handle: number, details: IModelViewDialogDetails): Thenable<void> {
		let dialog = this._dialogs.get(handle);
		if (!dialog) {
			dialog = new Dialog(details.title);
			let okButton = this.getButton(details.okButton);
			let cancelButton = this.getButton(details.cancelButton);
			dialog.okButton = okButton;
			dialog.cancelButton = cancelButton;
			dialog.onValidityChanged(valid => this._proxy.$onDialogValidityChanged(handle, valid));
			this._dialogs.set(handle, dialog);
		}

		dialog.title = details.title;
		if (details.content && typeof details.content !== 'string') {
			dialog.content = details.content.map(tabHandle => this.getTab(tabHandle));
		} else {
			dialog.content = details.content as string;
		}

		if (details.customButtons) {
			dialog.customButtons = details.customButtons.map(buttonHandle => this.getButton(buttonHandle));
		}

		return Promise.resolve();
	}

	public $setTabDetails(handle: number, details: IModelViewTabDetails): Thenable<void> {
		let tab = this._tabs.get(handle);
		if (!tab) {
			tab = new DialogTab(details.title);
			this._tabs.set(handle, tab);
		}

		tab.title = details.title;
		tab.content = details.content;
		return Promise.resolve();
	}

	public $setButtonDetails(handle: number, details: IModelViewButtonDetails): Thenable<void> {
		let button = this._buttons.get(handle);
		if (!button) {
			button = new DialogButton(details.label, details.enabled);
			button.hidden = details.hidden;
			button.onClick(() => this.onButtonClick(handle));
			this._buttons.set(handle, button);
		} else {
			button.label = details.label;
			button.enabled = details.enabled;
			button.hidden = details.hidden;
		}

		return Promise.resolve();
	}

	private getDialog(handle: number): Dialog {
		let dialog = this._dialogs.get(handle);
		if (!dialog) {
			throw new Error('No dialog matching the given handle');
		}

		return dialog;
	}

	private getTab(handle: number): DialogTab {
		let tab = this._tabs.get(handle);
		if (!tab) {
			throw new Error('No tab matching the given handle');
		}

		return tab;
	}

	private getButton(handle: number): DialogButton {
		let button = this._buttons.get(handle);
		if (!button) {
			throw new Error('No button matching the given handle');
		}

		return button;
	}

	private onButtonClick(handle: number): void {
		this._proxy.$onButtonClick(handle);
	}
}