/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { OkButtonText } from '../common/constants';

export abstract class DialogBase {
	protected _toDispose: vscode.Disposable[] = [];
	protected _dialogObject: azdata.window.Dialog;

	constructor(dialogTitle: string, dialogName: string, dialogWidth: azdata.window.DialogWidth = 600) {
		this._dialogObject = azdata.window.createModelViewDialog(dialogTitle, dialogName, dialogWidth);
		this._dialogObject.okButton.label = OkButtonText;
		this.register(this._dialogObject.cancelButton.onClick(() => this.onCancelButtonClicked()));
		this.register(this._dialogObject.okButton.onClick(() => this.onOkButtonClicked()));
		this._dialogObject.registerCloseValidator(async () => {
			return this.validate();
		});
	}

	protected abstract initialize(view: azdata.ModelView): Promise<void>;

	protected async validate(): Promise<boolean> {
		return Promise.resolve(true);
	}

	public open(): void {
		const tab = azdata.window.createTab('');
		tab.registerContent((view: azdata.ModelView) => {
			return this.initialize(view);
		});
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
	}

	private onCancelButtonClicked(): void {
		this.dispose();
	}

	private async onOkButtonClicked(): Promise<void> {
		await this.onComplete();
		this.dispose();
	}

	protected async onComplete(): Promise<void> {
	}

	protected dispose(): void {
		this._toDispose.forEach(disposable => disposable.dispose());
	}

	protected register(disposable: vscode.Disposable): void {
		this._toDispose.push(disposable);
	}

	protected showErrorMessage(message: string): void {
		this._dialogObject.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}
}
