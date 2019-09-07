/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export abstract class DialogBase {
	protected _toDispose: vscode.Disposable[] = [];
	protected _dialogObject: azdata.window.Dialog;

	constructor(dialogTitle: string, dialogName: string, isWide: boolean = false) {
		this._dialogObject = azdata.window.createModelViewDialog(dialogTitle, dialogName, isWide);
		this._dialogObject.cancelButton.onClick(() => this.onCancel());
	}

	protected abstract initializeDialog(): void;

	public open(): void {
		this.initializeDialog();
		azdata.window.openDialog(this._dialogObject);
	}

	protected onCancel(): void {
		this.dispose();
	}

	protected dispose(): void {
		this._toDispose.forEach(disposable => disposable.dispose());
	}
}
