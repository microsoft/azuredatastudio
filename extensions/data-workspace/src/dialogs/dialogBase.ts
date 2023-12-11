/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import { getAzdataApi } from '../common/utils';

export interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export abstract class DialogBase {
	protected _toDispose: vscode.Disposable[] = [];
	public dialogObject: azdataType.window.Dialog;
	protected initDialogComplete: Deferred<void> | undefined;
	protected initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	constructor(dialogTitle: string, dialogName: string, okButtonText: string, dialogWidth: azdataType.window.DialogWidth = 600) {
		this.dialogObject = getAzdataApi()!.window.createModelViewDialog(dialogTitle, dialogName, dialogWidth);
		this.dialogObject.okButton.label = okButtonText;
		this.register(this.dialogObject.cancelButton.onClick(() => this.onCancelButtonClicked()));
		this.register(this.dialogObject.okButton.onClick(() => this.onOkButtonClicked()));
		this.dialogObject.registerCloseValidator(async () => {
			return this.validate();
		});
	}

	protected abstract initialize(view: azdataType.ModelView): Promise<void>;

	abstract validate(): Promise<boolean>;

	public async open(): Promise<void> {
		const tab = getAzdataApi()!.window.createTab('');
		tab.registerContent(async (view: azdataType.ModelView) => {
			return this.initialize(view);
		});
		this.dialogObject.content = [tab];
		getAzdataApi()!.window.openDialog(this.dialogObject);
		await this.initDialogPromise;
	}

	protected onCancelButtonClicked(): void {
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
		this.dialogObject.message = {
			text: message,
			level: getAzdataApi()!.window.MessageLevel.Error
		};
	}

	public getErrorMessage(): azdataType.window.DialogMessage | undefined {
		return this.dialogObject.message;
	}

	protected createHorizontalContainer(view: azdataType.ModelView, items: azdataType.Component[]): azdataType.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
	}
}
