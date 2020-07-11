/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DialogInfo, instanceOfNotebookBasedDialogInfo, NotebookBasedDialogInfo } from '../interfaces';
import { INotebookService } from '../services/notebookService';
import { IPlatformService } from '../services/platformService';
import { DialogBase } from './dialogBase';
import { Model } from './model';
import { initializeDialog, InputComponentInfo, InputComponents, setModelValues, Validator } from './modelViewUtils';

const localize = nls.loadMessageBundle();

export class DeploymentInputDialog extends DialogBase {

	private inputComponents: InputComponents = {};

	constructor(private notebookService: INotebookService,
		private platformService: IPlatformService,
		private dialogInfo: DialogInfo) {
		super(dialogInfo.title, dialogInfo.name, false);
		let okButtonText: string;
		if (dialogInfo.actionText) {
			okButtonText = dialogInfo.actionText;
		} else if (instanceOfNotebookBasedDialogInfo(dialogInfo) && !dialogInfo.runNotebook) {
			okButtonText = localize('deploymentDialog.OpenNotebook', "Open Notebook");
		} else {
			okButtonText = localize('deploymentDialog.OkButtonText', "OK");
		}

		this._dialogObject.okButton.label = okButtonText;
	}

	protected initialize() {
		const self = this;
		const validators: Validator[] = [];
		initializeDialog({
			dialogInfo: this.dialogInfo,
			container: this._dialogObject,
			inputComponents: this.inputComponents,
			onNewDisposableCreated: (disposable: vscode.Disposable): void => {
				this._toDispose.push(disposable);
			},
			onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo): void => {
				this.inputComponents[name] = inputComponentInfo;
			},
			onNewValidatorCreated: (validator: Validator): void => {
				validators.push(validator);
			}
		});
		this._dialogObject.registerCloseValidator(() => {
			const messages: string[] = [];
			validators.forEach(validator => {
				const result = validator();
				if (!result.valid) {
					messages.push(result.message);
				}
			});
			if (messages.length > 0) {
				self._dialogObject.message = { level: azdata.window.MessageLevel.Error, text: messages.join(EOL) };
			} else {
				self._dialogObject.message = { text: '' };
			}
			return messages.length === 0;
		});
	}

	protected onComplete(): void {
		const model: Model = new Model();
		setModelValues(this.inputComponents, model);
		if (instanceOfNotebookBasedDialogInfo(this.dialogInfo)) {
			model.setEnvironmentVariables();
			if (this.dialogInfo.runNotebook) {
				this.executeNotebook(this.dialogInfo);
			} else {
				this.notebookService.launchNotebook(this.dialogInfo.notebook).then(() => { }, (error) => {
					vscode.window.showErrorMessage(error);
				});
			}
		} else {
			vscode.commands.executeCommand(this.dialogInfo.command, model);
		}
	}

	private executeNotebook(notebookDialogInfo: NotebookBasedDialogInfo): void {
		this.notebookService.backgroundExecuteNotebook(notebookDialogInfo.taskName, notebookDialogInfo.notebook, 'deploy', this.platformService);
	}
}
