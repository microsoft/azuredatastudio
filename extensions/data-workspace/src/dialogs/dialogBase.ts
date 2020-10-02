/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { okButtonText } from '../common/constants';

export abstract class DialogBase {
	protected _toDispose: vscode.Disposable[] = [];
	protected _dialogObject: azdata.window.Dialog;

	constructor(dialogTitle: string, dialogName: string) {
		this._dialogObject = azdata.window.createModelViewDialog(dialogTitle, dialogName, 'narrow');
		this._dialogObject.okButton.label = okButtonText;
		this._toDispose.push(this._dialogObject.cancelButton.onClick(() => this.onCancelButtonClicked()));
		this._toDispose.push(this._dialogObject.okButton.onClick(() => this.onOkButtonClicked()));
	}

	protected abstract initialize(view: azdata.ModelView): Promise<void>;

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
}
