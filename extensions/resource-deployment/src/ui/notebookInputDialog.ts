/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DialogBase } from './dialogBase';
import { INotebookService } from '../services/notebookService';
import { DialogInfo } from '../interfaces';
import { Validator, initializeDialog, InputComponents } from './modelViewUtils';

const localize = nls.loadMessageBundle();

export class NotebookInputDialog extends DialogBase {

	private inputComponents: InputComponents = {};

	constructor(private notebookService: INotebookService,
		private dialogInfo: DialogInfo) {
		super(dialogInfo.title, dialogInfo.name, false);
		this._dialogObject.okButton.label = localize('deploymentDialog.OKButtonText', 'Open Notebook');
		this._dialogObject.okButton.onClick(() => this.onComplete());
	}

	protected initialize() {
		const self = this;
		const validators: Validator[] = [];
		initializeDialog(this._dialogObject, this.dialogInfo, validators, this.inputComponents, this._toDispose);
		this._dialogObject.registerCloseValidator(() => {
			const messages: string[] = [];
			validators.forEach(validator => {
				const result = validator();
				if (!result.valid) {
					messages.push(result.message);
				}
			});
			if (messages.length > 0) {
				self._dialogObject.message = { level: azdata.window.MessageLevel.Error, text: messages.join('\n') };
			} else {
				self._dialogObject.message = { text: '' };
			}
			return messages.length === 0;
		});
	}

	private onComplete(): void {
		Object.keys(this.inputComponents).forEach(key => {
			process.env[key] = <string>this.inputComponents[key].value;
		});
		this.notebookService.launchNotebook(this.dialogInfo.notebook);
		this.dispose();
	}
}
