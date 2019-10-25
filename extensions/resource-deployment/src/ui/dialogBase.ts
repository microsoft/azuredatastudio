/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export abstract class DialogBase {
	protected _toDispose: vscode.Disposable[] = [];
	protected _dialogObject: azdata.window.Dialog;

	constructor(dialogTitle: string, dialogName: string, isWide: boolean = false) {
		this._dialogObject = azdata.window.createModelViewDialog(dialogTitle, dialogName, isWide);
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

	private onOkButtonClicked(): void {
		this.onComplete();
		this.dispose();
	}

	protected onComplete(): void {
	}

	protected dispose(): void {
		this._toDispose.forEach(disposable => disposable.dispose());
	}
}
