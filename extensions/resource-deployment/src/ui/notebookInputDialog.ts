/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DialogBase } from './dialogBase';
import { INotebookService } from '../services/notebookService';
import { DialogFieldInfo, FieldType, DialogInfo } from '../interfaces';

const localize = nls.loadMessageBundle();

export class NotebookInputDialog extends DialogBase {

	private variables: { [s: string]: string | undefined; } = {};
	private validators: (() => { valid: boolean, message: string })[] = [];

	constructor(private notebookService: INotebookService,
		private dialogInfo: DialogInfo) {
		super(dialogInfo.title, dialogInfo.name, false);
		this._dialogObject.okButton.label = localize('deploymentDialog.OKButtonText', 'Open Notebook');
		this._dialogObject.okButton.onClick(() => this.onComplete());
	}

	protected initializeDialog() {
		const tabs: azdata.window.DialogTab[] = [];
		this.dialogInfo.tabs.forEach(tabInfo => {
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
		this.variables[fieldInfo.variableName] = fieldInfo.defaultValue;
		let component: { component: azdata.Component, title: string }[] | azdata.Component | undefined = undefined;
		switch (fieldInfo.type) {
			case FieldType.Options:
				component = this.createOptionsTypeField(view, fieldInfo);
				break;
			case FieldType.DateTimeText:
				component = this.createDateTimeTextField(view, fieldInfo);
				break;
			case FieldType.Number:
				component = this.createNumberField(view, fieldInfo);
				break;
			case FieldType.SQLPassword:
			case FieldType.Password:
				component = this.createPasswordField(view, fieldInfo);
				break;
			case FieldType.Text:
				component = this.createTextField(view, fieldInfo);
				break;
			default:
				throw new Error(localize('deploymentDialog.UnknownFieldTypeError', "Unknown field type: \"{0}\"", fieldInfo.type));
		}

		if (component) {
			if (Array.isArray(component)) {
				fields.push(...component);
			} else {
				fields.push({ title: fieldInfo.label, component: component });
			}
		} else {
			throw new Error(localize('deploymentDialog.addFieldError', "Failed to add field: \"{0}\"", fieldInfo.label));
		}
	}

	private createOptionsTypeField(view: azdata.ModelView, fieldInfo: DialogFieldInfo): azdata.DropDownComponent {
		const dropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({ values: fieldInfo.options, value: fieldInfo.defaultValue }).component();
		this._toDispose.push(dropdown.onValueChanged(() => { this.variables[fieldInfo.variableName] = <string>dropdown.value; }));
		return dropdown;
	}

	private createDateTimeTextField(view: azdata.ModelView, fieldInfo: DialogFieldInfo): azdata.InputBoxComponent {
		const defaultValue = fieldInfo.defaultValue + new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, '');
		const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: defaultValue, ariaLabel: fieldInfo.label, inputType: 'text', required: fieldInfo.required, placeHolder: fieldInfo.placeHolder
		}).component();
		this.variables[fieldInfo.variableName] = defaultValue;
		this._toDispose.push(input.onTextChanged(() => { this.variables[fieldInfo.variableName] = input.value; }));
		return input;

	}

	private createNumberField(view: azdata.ModelView, fieldInfo: DialogFieldInfo): azdata.InputBoxComponent {
		const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: fieldInfo.defaultValue, ariaLabel: fieldInfo.label, inputType: 'number', min: fieldInfo.min, max: fieldInfo.max, required: fieldInfo.required
		}).component();
		this._toDispose.push(input.onTextChanged(() => { this.variables[fieldInfo.variableName] = input.value; }));
		return input;
	}

	private createTextField(view: azdata.ModelView, fieldInfo: DialogFieldInfo): azdata.InputBoxComponent {
		const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: fieldInfo.defaultValue, ariaLabel: fieldInfo.label, inputType: 'text', min: fieldInfo.min, max: fieldInfo.max, required: fieldInfo.required, placeHolder: fieldInfo.placeHolder
		}).component();
		this._toDispose.push(input.onTextChanged(() => { this.variables[fieldInfo.variableName] = input.value; }));
		return input;
	}

	private createPasswordField(view: azdata.ModelView, fieldInfo: DialogFieldInfo): { title: string, component: azdata.Component }[] {
		const components: { title: string, component: azdata.Component }[] = [];
		const passwordInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: fieldInfo.label, inputType: 'password', required: fieldInfo.required, placeHolder: fieldInfo.placeHolder
		}).component();
		this._toDispose.push(passwordInput.onTextChanged(() => { this.variables[fieldInfo.variableName] = passwordInput.value; }));
		components.push({ title: fieldInfo.label, component: passwordInput });

		if (fieldInfo.type === FieldType.SQLPassword) {
			const invalidPasswordMessage = localize('invalidSQLPassword', "{0} doesn't meet the password complexity requirement. For more information: https://docs.microsoft.com/sql/relational-databases/security/password-policy", fieldInfo.label);
			this._toDispose.push(passwordInput.onTextChanged(() => {
				if (fieldInfo.type === FieldType.SQLPassword && this.isValidSQLPassword(fieldInfo, passwordInput)) {
					this.removeValidationMessage(invalidPasswordMessage);
				}
			}));

			this.validators.push((): { valid: boolean, message: string } => {
				return { valid: this.isValidSQLPassword(fieldInfo, passwordInput), message: invalidPasswordMessage };
			});
		}

		if (fieldInfo.confirmationRequired) {
			const passwordNotMatchMessage = localize('passwordNotMatch', "{0} doesn't match the confirmation password", fieldInfo.label);

			const confirmPasswordInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ ariaLabel: fieldInfo.confirmationLabel, inputType: 'password', required: true }).component();
			components.push({ title: fieldInfo.confirmationLabel, component: confirmPasswordInput });

			this.validators.push((): { valid: boolean, message: string } => {
				const passwordMatches = passwordInput.value === confirmPasswordInput.value;
				return { valid: passwordMatches, message: passwordNotMatchMessage };
			});

			const updatePasswordMismatchMessage = () => {
				if (passwordInput.value === confirmPasswordInput.value) {
					this.removeValidationMessage(passwordNotMatchMessage);
				}
			};

			this._toDispose.push(passwordInput.onTextChanged(() => {
				updatePasswordMismatchMessage();
			}));
			this._toDispose.push(confirmPasswordInput.onTextChanged(() => {
				updatePasswordMismatchMessage();
			}));
		}
		return components;
	}

	private onComplete(): void {
		Object.keys(this.variables).forEach(key => {
			process.env[key] = this.variables[key];
		});
		this.notebookService.launchNotebook(this.dialogInfo.notebook);
		this.dispose();
	}

	private isValidSQLPassword(field: DialogFieldInfo, component: azdata.InputBoxComponent): boolean {
		const password = component.value!;
		// Validate SQL Server password
		const containsUserName = password && field.userName && password.toUpperCase().includes(field.userName.toUpperCase());
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
