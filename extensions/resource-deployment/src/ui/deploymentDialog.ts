/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { DialogBase } from './dialogBase';
import { INotebookService } from '../services/notebookService';
import { DeploymentProvider, DialogFieldInfo, FieldType } from '../interfaces';

const localize = nls.loadMessageBundle();

export class DeploymentDialog extends DialogBase {

	private variables: { [s: string]: string | undefined; } = {};
	private validators: (() => { valid: boolean, message: string })[] = [];

	constructor(context: vscode.ExtensionContext,
		private notebookService: INotebookService,
		private deploymentProvider: DeploymentProvider) {
		super(context, deploymentProvider.dialog.title, deploymentProvider.dialog.name, false);
		this._dialogObject.okButton.label = localize('deploymentDialog.OKButtonText', 'Open Notebook');
		this._dialogObject.okButton.onClick(() => this.onComplete());
	}

	protected initializeDialog() {
		const tabs: azdata.window.DialogTab[] = [];
		this.deploymentProvider.dialog.tabs.forEach(tabInfo => {
			const tab = azdata.window.createTab(tabInfo.title);
			tab.registerContent((view: azdata.ModelView) => {
				const sections: azdata.FormComponentGroup[] = [];
				tabInfo.sections.forEach(sectionInfo => {
					const fields: azdata.FormComponent[] = [];
					sectionInfo.fields.forEach(fieldInfo => {
						this.addField(view, fields, fieldInfo);
					});
					sections.push({ title: sectionInfo.title, components: fields });
				});
				const formBuilder = view.modelBuilder.formContainer().withFormItems(
					sections,
					{
						horizontal: false
					}
				);

				const form = formBuilder.withLayout({ width: '100%' }).component();
				const self = this;
				this._dialogObject.registerCloseValidator(() => {
					const messages: string[] = [];
					self.validators.forEach(validator => {
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

				return view.initializeModel(form);
			});
			tabs.push(tab);
		});
		this._dialogObject.content = tabs;
	}

	private addField(view: azdata.ModelView, fields: azdata.FormComponent[], fieldInfo: DialogFieldInfo): void {
		switch (fieldInfo.type) {
			case FieldType.Options:
				this.addOptionsTypeField(view, fields, fieldInfo);
				break;
			case FieldType.DateTimeText:
			case FieldType.Number:
			case FieldType.SQLPassword:
			case FieldType.Text:
				this.addInputTypeField(view, fields, fieldInfo);
				break;
		}
	}

	private addOptionsTypeField(view: azdata.ModelView, fields: azdata.FormComponent[], fieldInfo: DialogFieldInfo): void {
		const component = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({ values: fieldInfo.options, value: fieldInfo.defaultValue }).component();
		this.variables[fieldInfo.variableName] = fieldInfo.defaultValue;
		this._toDispose.push(component.onValueChanged(() => { this.variables[fieldInfo.variableName] = <string>component.value; }));
		fields.push({ title: fieldInfo.label, component: component });
	}

	private addInputTypeField(view: azdata.ModelView, fields: azdata.FormComponent[], fieldInfo: DialogFieldInfo): void {
		let inputType: azdata.InputBoxInputType = 'text';
		let defaultValue: string | undefined = fieldInfo.defaultValue;

		switch (fieldInfo.type) {
			case FieldType.Number:
				inputType = 'number';
				break;
			case FieldType.SQLPassword:
				inputType = 'password';
				break;
			case FieldType.DateTimeText:
				defaultValue = fieldInfo.defaultValue + new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, '');
				break;
		}
		const component = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: defaultValue, ariaLabel: fieldInfo.label, inputType: inputType, min: fieldInfo.min, max: fieldInfo.max, required: fieldInfo.required, placeHolder: fieldInfo.placeHolder
		}).component();
		this.variables[fieldInfo.variableName] = defaultValue;
		this._toDispose.push(component.onTextChanged(() => { this.variables[fieldInfo.variableName] = component.value; }));
		fields.push({ title: fieldInfo.label, component: component });

		if (fieldInfo.type === FieldType.SQLPassword) {
			const invalidPasswordMessage = localize('invalidPassword', "{0} doesn't meet the password complexity requirement. More information: https://docs.microsoft.com/sql/relational-databases/security/password-policy", fieldInfo.label);
			const passwordMatchMessage = localize('passwordNotMatch', "{0} doesn't match the confirmation password", fieldInfo.label);
			this.validators.push((): { valid: boolean, message: string } => {
				return { valid: this.validateSQLPassword(fieldInfo, component), message: invalidPasswordMessage };
			});
			if (fieldInfo.confirmationRequired) {
				const confirmPasswordComponent = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ ariaLabel: fieldInfo.confirmationLabel, inputType: inputType, required: true }).component();
				fields.push({ title: fieldInfo.confirmationLabel, component: confirmPasswordComponent });

				this.validators.push((): { valid: boolean, message: string } => {
					const passwordMatches = component.value === confirmPasswordComponent.value;
					return { valid: passwordMatches, message: passwordMatchMessage };
				});

				const updatePasswordMessage = () => {
					if (this.validateSQLPassword(fieldInfo, component)) {
						this.removeValidationMessage(invalidPasswordMessage);
					}
					if (component.value === confirmPasswordComponent.value) {
						this.removeValidationMessage(passwordMatchMessage);
					}
				};

				this._toDispose.push(component.onTextChanged(() => {
					updatePasswordMessage();
				}));
				this._toDispose.push(confirmPasswordComponent.onTextChanged(() => {
					updatePasswordMessage();
				}));
			}
		}
	}

	private onComplete(): void {
		Object.keys(this.variables).forEach(key => {
			process.env[key] = this.variables[key];
		});
		this.notebookService.launchNotebook(this.deploymentProvider.notebook);
		this.dispose();
	}

	private validateSQLPassword(field: DialogFieldInfo, component: azdata.InputBoxComponent): boolean {
		const password = component.value!;
		// Validate SQL Server password
		const userName = field.userName ? field.userName! : this.variables[field.userNameVariableName!];
		const containsUserName = userName && password.includes(userName);
		// Instead of using one RegEx, I am seperating it to make it more readable.
		const hasUpperCase = /[A-Z]/.test(password) ? 1 : 0;
		const hasLowerCase = /[a-z]/.test(password) ? 1 : 0;
		const hasNumbers = /\d/.test(password) ? 1 : 0;
		const hasNonalphas = /\W/.test(password) ? 1 : 0;
		return !containsUserName && password.length >= 8 && password.length <= 128 && (hasUpperCase + hasLowerCase + hasNumbers + hasNonalphas >= 3);
	}

	private removeValidationMessage(message: string): void {
		if (this._dialogObject.message && this._dialogObject.message.text.includes(message)) {
			const messageWithLineBreak = message + '\n';
			const searchText = this._dialogObject.message.text.includes(messageWithLineBreak) ? messageWithLineBreak : message;
			this._dialogObject.message = { text: this._dialogObject.message.text.replace(searchText, '') };
		}
	}
}
