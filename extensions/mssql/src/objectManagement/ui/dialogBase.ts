/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export abstract class DialogBase {
	protected _toDispose: vscode.Disposable[] = [];
	protected _dialogObject: azdata.window.Dialog;

	constructor(dialogTitle: string, dialogName: string, dialogWidth: azdata.window.DialogWidth = 'medium') {
		this._dialogObject = azdata.window.createModelViewDialog(dialogTitle, dialogName, dialogWidth);
		this._toDispose.push(this._dialogObject.cancelButton.onClick(() => this.onCancelButtonClicked()));
		this._toDispose.push(this._dialogObject.okButton.onClick(() => this.onOkButtonClicked()));
	}

	protected abstract initialize(): void;

	public open(): void {
		this.initialize();
		azdata.window.openDialog(this._dialogObject);
	}

	private onCancelButtonClicked(): void {
		this.dispose();
	}

	private async onOkButtonClicked(): Promise<void> {
		try {
			this._dialogObject.loading = true;
			await this.onComplete();
			this.dispose();
		}
		catch (err) {
			this._dialogObject.message = err.message;
		}
	}

	protected async onComplete(): Promise<void> {
	}

	protected dispose(): void {
		this._toDispose.forEach(disposable => disposable.dispose());
	}
}
