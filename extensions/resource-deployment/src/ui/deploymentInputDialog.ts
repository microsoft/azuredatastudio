/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DialogBase } from './dialogBase';
import { INotebookService } from '../services/notebookService';
import { DialogInfo, instanceOfNotebookBasedDialogInfo, NotebookBasedDialogInfo } from '../interfaces';
import { Validator, initializeDialog, InputComponents, setModelValues } from './modelViewUtils';
import { Model } from './model';
import { EOL } from 'os';
import { getDateTimeString, getErrorMessage } from '../utils';

const localize = nls.loadMessageBundle();

export class DeploymentInputDialog extends DialogBase {

	private inputComponents: InputComponents = {};

	constructor(private notebookService: INotebookService,
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
			onNewDisposableCreated: (disposable: vscode.Disposable): void => {
				this._toDispose.push(disposable);
			},
			onNewInputComponentCreated: (name: string, component: azdata.DropDownComponent | azdata.InputBoxComponent | azdata.CheckBoxComponent): void => {
				this.inputComponents[name] = component;
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
		azdata.tasks.startBackgroundOperation({
			displayName: notebookDialogInfo.taskName!,
			description: notebookDialogInfo.taskName!,
			isCancelable: false,
			operation: async op => {
				op.updateStatus(azdata.TaskStatus.InProgress);
				const notebook = await this.notebookService.getNotebook(notebookDialogInfo.notebook);
				const result = await this.notebookService.executeNotebook(notebook);
				if (result.succeeded) {
					op.updateStatus(azdata.TaskStatus.Succeeded);
				} else {
					op.updateStatus(azdata.TaskStatus.Failed, result.errorMessage);
					if (result.outputNotebook) {
						const viewErrorDetail = localize('resourceDeployment.ViewErrorDetail', "View error detail");
						const selectedOption = await vscode.window.showErrorMessage(localize('resourceDeployment.DeployFailed', "The task \"{0}\" has failed.", notebookDialogInfo.taskName), viewErrorDetail);
						if (selectedOption === viewErrorDetail) {
							try {
								this.notebookService.launchNotebookWithContent(`deploy-${getDateTimeString()}`, result.outputNotebook);
							} catch (error) {
								vscode.window.showErrorMessage(localize('resourceDeployment.FailedToOpenNotebook', "An error occured launching the output notebook. {1}{2}.", EOL, getErrorMessage(error)));
							}
						}
					} else {
						vscode.window.showErrorMessage(localize('resourceDeployment.TaskFailedWithNoOutputNotebook', "The task failed and no output Notebook was generated."));
					}
				}
			}
		});
	}
}
