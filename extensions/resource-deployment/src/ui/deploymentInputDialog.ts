/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DialogInfo, instanceOfNotebookBasedDialogInfo, NotebookBasedDialogInfo, FieldType, NotebookPathInfo } from '../interfaces';
import { INotebookService } from '../services/notebookService';
import { IPlatformService } from '../services/platformService';
import { DialogBase } from './dialogBase';
import { Model } from './model';
import { initializeDialog, InputComponent, InputComponentInfo, InputComponents, setModelValues, Validator } from './modelViewUtils';
import { IToolsService } from '../services/toolsService';

const localize = nls.loadMessageBundle();

const NotebookTypeVariableName: string = 'SYS_NotebookType';

export class DeploymentInputDialog extends DialogBase {

	private inputComponents: InputComponents = {};

	constructor(private notebookService: INotebookService,
		private platformService: IPlatformService,
		private toolsService: IToolsService,
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

		if (this.dialogInfo.tabs.length > 0
			&& instanceOfNotebookBasedDialogInfo(this.dialogInfo)
			&& Array.isArray(this.dialogInfo.notebook)) {
			// Add the notebook type field to the dialog
			this.dialogInfo.tabs[0].sections.push(
				{
					fields: [
						{
							type: FieldType.Options,
							label: localize('notebookType', 'Notebook type'),
							options: this.dialogInfo.notebook.map(nb => nb.type),
							variableName: NotebookTypeVariableName
						}
					]
				}
			);
		}

		initializeDialog({
			dialogInfo: this.dialogInfo,
			container: this._dialogObject,
			inputComponents: this.inputComponents,
			onNewDisposableCreated: (disposable: vscode.Disposable): void => {
				this._toDispose.push(disposable);
			},
			onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo<InputComponent>): void => {
				this.inputComponents[name] = inputComponentInfo;
			},
			onNewValidatorCreated: (validator: Validator): void => {
				validators.push(validator);
			},
			toolsService: this.toolsService
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

	protected override async onComplete(): Promise<void> {
		const model: Model = new Model();
		await setModelValues(this.inputComponents, model);
		if (instanceOfNotebookBasedDialogInfo(this.dialogInfo)) {
			model.setEnvironmentVariables();
			if (this.dialogInfo.runNotebook) {
				this.executeNotebook(this.dialogInfo);
			} else {
				const notebook = Array.isArray(this.dialogInfo.notebook) ?
					this.dialogInfo.notebook.find(nb => nb.type === model.getStringValue(NotebookTypeVariableName))?.path :
					this.dialogInfo.notebook;
				this.notebookService.openNotebook(notebook!).catch(error => {
					vscode.window.showErrorMessage(error);
				});
			}
		} else {
			await vscode.commands.executeCommand(this.dialogInfo.command, model);
		}
	}

	private executeNotebook(notebookDialogInfo: NotebookBasedDialogInfo): void {
		this.notebookService.backgroundExecuteNotebook(notebookDialogInfo.taskName, notebookDialogInfo.notebook as string | NotebookPathInfo, 'deploy', this.platformService);
	}
}
