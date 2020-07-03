/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TestModelView } from './testModelView';
import { TestButton } from './testButton';

export class TestDialog implements azdata.window.Dialog {

	private _onValidityChanged = new vscode.EventEmitter<boolean>();
	private _contentCallback: ((view: azdata.ModelView) => Thenable<void>) | undefined = undefined;
	private _validationCallback: (() => boolean | Thenable<boolean>) | undefined = undefined;
	private _modelView = new TestModelView();
	public async show(): Promise<void> {
		if (this._contentCallback) {
			await this._contentCallback(this._modelView);
		}
	}

	public async close(): Promise<boolean> {
		if (this._validationCallback) {
			return this._validationCallback();
		}
		return true;
	}

	///#########################
	// # Dialog Implementation #
	// #########################

	public title!: string;
	public isWide!: boolean;
	public content!: string | azdata.window.DialogTab[];
	public okButton: azdata.window.Button = new TestButton();
	public cancelButton: azdata.window.Button = new TestButton();
	public customButtons!: azdata.window.Button[];
	public message!: azdata.window.DialogMessage;
	dialogName?: string | undefined;
	registerCloseValidator(validator: () => boolean | Thenable<boolean>): void {
		this._validationCallback = validator;
	}
	registerOperation(_operationInfo: azdata.BackgroundOperationInfo): void {
		throw new Error('Method not implemented.');
	}
	width?: number | 'narrow' | 'medium' | 'wide' | undefined;
	registerContent(handler: (view: azdata.ModelView) => Thenable<void>): void {
		this._contentCallback = handler;
	}
	public modelView!: azdata.ModelView;
	public valid!: boolean;
	public onValidityChanged: vscode.Event<boolean> = this._onValidityChanged.event;
}
