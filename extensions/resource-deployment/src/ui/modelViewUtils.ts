/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DialogInfo, FieldType, FieldInfo, SectionInfo } from '../interfaces';

const localize = nls.loadMessageBundle();

export type validator = () => { valid: boolean, message: string };
export type Model = { [s: string]: string | undefined; };
export type Components = { [s: string]: azdata.Component; };

export function initializeDialog(dialog: azdata.window.Dialog, dialogInfo: DialogInfo, validators: validator[], model: Model, disposables: vscode.Disposable[]): void {
	const tabs: azdata.window.DialogTab[] = [];
	dialogInfo.tabs.forEach(tabInfo => {
		const tab = azdata.window.createTab(tabInfo.title);
		tab.registerContent((view: azdata.ModelView) => {
			return processSections(dialog, view, tabInfo.sections, validators, model, disposables, '400px', '400px');
		});
		tabs.push(tab);
	});
	dialog.content = tabs;
}

function processSections(container: azdata.window.Dialog | azdata.window.Wizard, view: azdata.ModelView, sectionInfoArray: SectionInfo[], validators: validator[], model: Model, disposables: vscode.Disposable[], defaultLabelWidth: string, defaultInputWidth: string): Thenable<void> {
	const sections: azdata.Component[] = [];
	sectionInfoArray.forEach(sectionInfo => {
		const components: azdata.Component[] = [];
		if (sectionInfo.fields) {
			sectionInfo.fields.forEach(fieldInfo => {
				fieldInfo.labelWidth = fieldInfo.labelWidth ? fieldInfo.labelWidth : defaultLabelWidth;
				fieldInfo.inputWidth = fieldInfo.inputWidth ? fieldInfo.inputWidth : defaultInputWidth;
				processField(view, components, fieldInfo, model, validators, disposables, container);
			});
		} else if (sectionInfo.rows) {

		}
		const section = view.modelBuilder.groupContainer().withItems(components).withLayout({ header: sectionInfo.title, collapsible: true, collapsed: false }).component();
		sections.push(section);
	});
	const formBuilder = view.modelBuilder.formContainer().withFormItems(
		sections.map(section => { return { title: '', component: section }; }),
		{
			horizontal: false,
			componentWidth: '100%'
		}
	);
	const form = formBuilder.withLayout({ width: '100%' }).component();
	return view.initializeModel(form);
}


function processField(view: azdata.ModelView, components: azdata.Component[], fieldInfo: FieldInfo, model: Model, validators: validator[], disposables: vscode.Disposable[], container: azdata.window.Dialog | azdata.window.Wizard): void {
	model[fieldInfo.variableName] = fieldInfo.defaultValue;
	switch (fieldInfo.type) {
		case FieldType.Options:
			processOptionsTypeField(view, fieldInfo, components, model, disposables);
			break;
		case FieldType.DateTimeText:
			processDateTimeTextField(view, fieldInfo, components, model, disposables);
			break;
		case FieldType.Number:
			processNumberField(view, fieldInfo, components, model, disposables);
			break;
		case FieldType.SQLPassword:
		case FieldType.Password:
			processPasswordField(view, fieldInfo, components, model, validators, disposables, container);
			break;
		case FieldType.Text:
			processTextField(view, fieldInfo, components, model, disposables);
			break;
		default:
			throw new Error(localize('UnknownFieldTypeError', "Unknown field type: \"{0}\"", fieldInfo.type));
	}
}
function createLabelComponent(view: azdata.ModelView, label: string, labelWidth?: string): azdata.TextComponent {
	const textComponent = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: label }).component();
	if (labelWidth) {
		textComponent.width = labelWidth;
	}
	return textComponent;

}

function processOptionsTypeField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], model: Model, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.labelWidth);
	const dropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({ values: fieldInfo.options, value: fieldInfo.defaultValue }).component();
	disposables.push(dropdown.onValueChanged(() => { model[fieldInfo.variableName] = <string>dropdown.value; }));
	components.push(label, dropdown);
}

function processDateTimeTextField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], model: Model, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.labelWidth);
	const defaultValue = fieldInfo.defaultValue + new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, '');
	const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: defaultValue, ariaLabel: fieldInfo.label, inputType: 'text', required: fieldInfo.required, placeHolder: fieldInfo.placeHolder
	}).component();
	model[fieldInfo.variableName] = defaultValue;
	disposables.push(input.onTextChanged(() => { model[fieldInfo.variableName] = input.value; }));
	components.push(label, input);
}

function processNumberField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], model: Model, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.labelWidth);
	const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: fieldInfo.defaultValue, ariaLabel: fieldInfo.label, inputType: 'number', min: fieldInfo.min, max: fieldInfo.max, required: fieldInfo.required
	}).component();
	disposables.push(input.onTextChanged(() => { model[fieldInfo.variableName] = input.value; }));
	components.push(label, input);
}

function processTextField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], model: Model, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.labelWidth);
	const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: fieldInfo.defaultValue, ariaLabel: fieldInfo.label, inputType: 'text', min: fieldInfo.min, max: fieldInfo.max, required: fieldInfo.required, placeHolder: fieldInfo.placeHolder
	}).component();
	disposables.push(input.onTextChanged(() => { model[fieldInfo.variableName] = input.value; }));
	components.push(label, input);
}

function processPasswordField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], model: Model, validators: validator[], disposables: vscode.Disposable[], container: azdata.window.Dialog | azdata.window.Wizard): void {
	const passwordLabel = createLabelComponent(view, fieldInfo.label, fieldInfo.labelWidth);
	const passwordInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		ariaLabel: fieldInfo.label, inputType: 'password', required: fieldInfo.required, placeHolder: fieldInfo.placeHolder
	}).component();
	disposables.push(passwordInput.onTextChanged(() => { model[fieldInfo.variableName] = passwordInput.value; }));
	components.push(passwordLabel, passwordInput);

	if (fieldInfo.type === FieldType.SQLPassword) {
		const invalidPasswordMessage = localize('invalidSQLPassword', "{0} doesn't meet the password complexity requirement. For more information: https://docs.microsoft.com/sql/relational-databases/security/password-policy", fieldInfo.label);
		disposables.push(passwordInput.onTextChanged(() => {
			if (fieldInfo.type === FieldType.SQLPassword && isValidSQLPassword(fieldInfo, passwordInput.value!)) {
				removeValidationMessage(container, invalidPasswordMessage);
			}
		}));

		validators.push((): { valid: boolean, message: string } => {
			return { valid: isValidSQLPassword(fieldInfo, passwordInput.value!), message: invalidPasswordMessage };
		});
	}

	if (fieldInfo.confirmationRequired) {
		const passwordNotMatchMessage = localize('passwordNotMatch', "{0} doesn't match the confirmation password", fieldInfo.label);
		const confirmPasswordLabel = createLabelComponent(view, fieldInfo.confirmationLabel, fieldInfo.labelWidth);
		const confirmPasswordInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ ariaLabel: fieldInfo.confirmationLabel, inputType: 'password', required: true }).component();
		components.push(confirmPasswordLabel, confirmPasswordInput);
		validators.push((): { valid: boolean, message: string } => {
			const passwordMatches = passwordInput.value === confirmPasswordInput.value;
			return { valid: passwordMatches, message: passwordNotMatchMessage };
		});

		const updatePasswordMismatchMessage = () => {
			if (passwordInput.value === confirmPasswordInput.value) {
				removeValidationMessage(container, passwordNotMatchMessage);
			}
		};

		disposables.push(passwordInput.onTextChanged(() => {
			updatePasswordMismatchMessage();
		}));
		disposables.push(confirmPasswordInput.onTextChanged(() => {
			updatePasswordMismatchMessage();
		}));
	}
}

function isValidSQLPassword(field: FieldInfo, password: string): boolean {
	// Validate SQL Server password
	const containsUserName = password && field.userName && password.toUpperCase().includes(field.userName.toUpperCase());
	// Instead of using one RegEx, I am seperating it to make it more readable.
	const hasUpperCase = /[A-Z]/.test(password) ? 1 : 0;
	const hasLowerCase = /[a-z]/.test(password) ? 1 : 0;
	const hasNumbers = /\d/.test(password) ? 1 : 0;
	const hasNonalphas = /\W/.test(password) ? 1 : 0;
	return !containsUserName && password.length >= 8 && password.length <= 128 && (hasUpperCase + hasLowerCase + hasNumbers + hasNonalphas >= 3);
}

function removeValidationMessage(container: azdata.window.Dialog | azdata.window.Wizard, message: string): void {
	if (container.message && container.message.text.includes(message)) {
		const messageWithLineBreak = message + '\n';
		const searchText = container.message.text.includes(messageWithLineBreak) ? messageWithLineBreak : message;
		container.message = { text: container.message.text.replace(searchText, '') };
	}
}

