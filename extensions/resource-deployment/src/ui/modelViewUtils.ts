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

export type Validator = () => { valid: boolean, message: string };
export type InputComponents = { [s: string]: azdata.InputBoxComponent | azdata.DropDownComponent; };

export const DefaultInputComponentWidth = '400px';
export const DefaultLabelComponentWidth = '200px';

export function initializeDialog(dialog: azdata.window.Dialog, dialogInfo: DialogInfo, validators: Validator[], inputComponents: InputComponents, disposables: vscode.Disposable[]): void {
	const tabs: azdata.window.DialogTab[] = [];
	dialogInfo.tabs.forEach(tabInfo => {
		const tab = azdata.window.createTab(tabInfo.title);
		tab.registerContent((view: azdata.ModelView) => {
			const sections = tabInfo.sections.map(sectionInfo => {
				return createSection(dialog, view, sectionInfo, validators, inputComponents, disposables, DefaultLabelComponentWidth, DefaultInputComponentWidth);
			});
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				sections.map(section => {
					return { title: '', component: section };
				}),
				{
					horizontal: false,
					componentWidth: '100%'
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
		tabs.push(tab);
	});
	dialog.content = tabs;
}

export function initializeWizardPage(page: azdata.window.WizardPage, wizard: azdata.window.Wizard, sectionInfoArray: SectionInfo[], validators: Validator[], inputComponents: InputComponents, disposables: vscode.Disposable[]): void {
	page.registerContent((view: azdata.ModelView) => {
		const sections = sectionInfoArray.map(sectionInfo => {
			return createSection(wizard, view, sectionInfo, validators, inputComponents, disposables, DefaultInputComponentWidth, DefaultInputComponentWidth);
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
	});
}

export function createSection(container: azdata.window.Dialog | azdata.window.Wizard, view: azdata.ModelView, sectionInfo: SectionInfo, validators: Validator[], inputComponents: InputComponents, disposables: vscode.Disposable[], defaultLabelWidth: string = DefaultLabelComponentWidth, defaultInputWidth: string = DefaultInputComponentWidth): azdata.GroupContainer {
	const labelWidth = sectionInfo.labelWidth || defaultLabelWidth;
	const inputWidth = sectionInfo.inputWidth || defaultInputWidth;
	const components: azdata.Component[] = [];
	if (sectionInfo.fields) {
		processFields(sectionInfo.fields, components, container, view, validators, inputComponents, disposables, labelWidth, inputWidth, sectionInfo.labelOnLeft);
	} else if (sectionInfo.rows) {
		sectionInfo.rows.forEach(rowInfo => {
			const rowItems: azdata.Component[] = [];
			processFields(rowInfo.fields, rowItems, container, view, validators, inputComponents, disposables, labelWidth, inputWidth, sectionInfo.labelOnLeft);
			const row = createRow(view, rowItems);
			components.push(row);
		});
	}
	return view.modelBuilder.groupContainer().withItems(components).withLayout({ header: sectionInfo.title, collapsible: true, collapsed: false }).component();
}

function processFields(fieldInfoArray: FieldInfo[], components: azdata.Component[], container: azdata.window.Dialog | azdata.window.Wizard, view: azdata.ModelView, validators: Validator[], inputComponents: InputComponents, disposables: vscode.Disposable[], defaultLabelWidth: string, defaultInputWidth: string, labelOnLeft?: boolean): void {
	fieldInfoArray.forEach(fieldInfo => {
		fieldInfo.labelWidth = fieldInfo.labelWidth || defaultLabelWidth;
		fieldInfo.inputWidth = fieldInfo.inputWidth || defaultInputWidth;
		fieldInfo.labelOnLeft = fieldInfo.labelOnLeft === undefined ? labelOnLeft : fieldInfo.labelOnLeft;
		processField(view, components, fieldInfo, inputComponents, validators, disposables, container);
	});
}

function createRow(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
	return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
}

function addLabelInputPairToContainer(view: azdata.ModelView, components: azdata.Component[], label: azdata.Component, input: azdata.Component, labelOnLeft?: boolean) {
	if (labelOnLeft) {
		const row = createRow(view, [label, input]);
		components.push(row);
	} else {
		components.push(label, input);
	}
}


function processField(view: azdata.ModelView, components: azdata.Component[], fieldInfo: FieldInfo, inputComponents: InputComponents, validators: Validator[], disposables: vscode.Disposable[], container: azdata.window.Dialog | azdata.window.Wizard): void {
	switch (fieldInfo.type) {
		case FieldType.Options:
			processOptionsTypeField(view, fieldInfo, components, inputComponents, disposables);
			break;
		case FieldType.DateTimeText:
			processDateTimeTextField(view, fieldInfo, components, inputComponents, disposables);
			break;
		case FieldType.Number:
			processNumberField(view, fieldInfo, components, inputComponents, disposables);
			break;
		case FieldType.SQLPassword:
		case FieldType.Password:
			processPasswordField(view, fieldInfo, components, inputComponents, validators, disposables, container);
			break;
		case FieldType.Text:
			processTextField(view, fieldInfo, components, inputComponents, disposables);
			break;
		default:
			throw new Error(localize('UnknownFieldTypeError', "Unknown field type: \"{0}\"", fieldInfo.type));
	}
}
function createLabelComponent(view: azdata.ModelView, label: string, description?: string, isRequired?: boolean, labelWidth?: string): azdata.TextComponent {
	const text = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: label, description: description, requiredIndicator: isRequired }).component();
	text.width = labelWidth;
	return text;
}

function processOptionsTypeField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], inputComponents: InputComponents, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.description, false, fieldInfo.labelWidth);
	const dropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({ values: fieldInfo.options, value: fieldInfo.defaultValue }).component();
	dropdown.width = fieldInfo.inputWidth;
	inputComponents[fieldInfo.variableName] = dropdown;
	addLabelInputPairToContainer(view, components, label, dropdown, fieldInfo.labelOnLeft);
}

function processDateTimeTextField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], inputComponents: InputComponents, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.description, fieldInfo.required, fieldInfo.labelWidth);
	const defaultValue = fieldInfo.defaultValue + new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, '');
	const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: defaultValue, ariaLabel: fieldInfo.label, inputType: 'text', required: !fieldInfo.useCustomValidator && fieldInfo.required, placeHolder: fieldInfo.placeHolder
	}).component();
	input.width = fieldInfo.inputWidth;
	inputComponents[fieldInfo.variableName] = input;
	addLabelInputPairToContainer(view, components, label, input, fieldInfo.labelOnLeft);
}

function processNumberField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], inputComponents: InputComponents, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.description, fieldInfo.required, fieldInfo.labelWidth);
	const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: fieldInfo.defaultValue, ariaLabel: fieldInfo.label, inputType: 'number', min: fieldInfo.min, max: fieldInfo.max, required: !fieldInfo.useCustomValidator && fieldInfo.required
	}).component();
	input.width = fieldInfo.inputWidth;
	inputComponents[fieldInfo.variableName] = input;
	addLabelInputPairToContainer(view, components, label, input, fieldInfo.labelOnLeft);
}

function processTextField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], inputComponents: InputComponents, disposables: vscode.Disposable[]): void {
	const label = createLabelComponent(view, fieldInfo.label, fieldInfo.description, fieldInfo.required, fieldInfo.labelWidth);
	const input = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: fieldInfo.defaultValue, ariaLabel: fieldInfo.label, inputType: 'text', min: fieldInfo.min, max: fieldInfo.max, required: !fieldInfo.useCustomValidator && fieldInfo.required, placeHolder: fieldInfo.placeHolder
	}).component();
	input.width = fieldInfo.inputWidth;
	inputComponents[fieldInfo.variableName] = input;
	addLabelInputPairToContainer(view, components, label, input, fieldInfo.labelOnLeft);
}

function processPasswordField(view: azdata.ModelView, fieldInfo: FieldInfo, components: azdata.Component[], inputComponents: InputComponents, validators: Validator[], disposables: vscode.Disposable[], container: azdata.window.Dialog | azdata.window.Wizard): void {
	const passwordLabel = createLabelComponent(view, fieldInfo.label, fieldInfo.description, fieldInfo.required, fieldInfo.labelWidth);
	const passwordInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		ariaLabel: fieldInfo.label, inputType: 'password', required: !fieldInfo.useCustomValidator && fieldInfo.required, placeHolder: fieldInfo.placeHolder
	}).component();
	passwordInput.width = fieldInfo.inputWidth;
	inputComponents[fieldInfo.variableName] = passwordInput;
	addLabelInputPairToContainer(view, components, passwordLabel, passwordInput, fieldInfo.labelOnLeft);

	if (fieldInfo.type === FieldType.SQLPassword) {
		const invalidPasswordMessage = getInvalidSQLPasswordMessage(fieldInfo.label);
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
		const passwordNotMatchMessage = getPasswordMismatchMessage(fieldInfo.label);
		const confirmPasswordLabel = createLabelComponent(view, fieldInfo.confirmationLabel!, '', true, fieldInfo.labelWidth);
		const confirmPasswordInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ ariaLabel: fieldInfo.confirmationLabel, inputType: 'password', required: !fieldInfo.useCustomValidator }).component();
		confirmPasswordInput.width = fieldInfo.inputWidth;

		addLabelInputPairToContainer(view, components, confirmPasswordLabel, confirmPasswordInput, fieldInfo.labelOnLeft);
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

export function isValidSQLPassword(field: FieldInfo, password: string): boolean {
	// Validate SQL Server password
	const containsUserName = password && field.userName && password.toUpperCase().includes(field.userName.toUpperCase());
	// Instead of using one RegEx, I am seperating it to make it more readable.
	const hasUpperCase = /[A-Z]/.test(password) ? 1 : 0;
	const hasLowerCase = /[a-z]/.test(password) ? 1 : 0;
	const hasNumbers = /\d/.test(password) ? 1 : 0;
	const hasNonalphas = /\W/.test(password) ? 1 : 0;
	return !containsUserName && password.length >= 8 && password.length <= 128 && (hasUpperCase + hasLowerCase + hasNumbers + hasNonalphas >= 3);
}

export function removeValidationMessage(container: azdata.window.Dialog | azdata.window.Wizard, message: string): void {
	if (container.message && container.message.text.includes(message)) {
		const messageWithLineBreak = message + '\n';
		const searchText = container.message.text.includes(messageWithLineBreak) ? messageWithLineBreak : message;
		container.message = { text: container.message.text.replace(searchText, '') };
	}
}

export function getInvalidSQLPasswordMessage(fieldName: string): string {
	return localize('invalidSQLPassword', "{0} doesn't meet the password complexity requirement. For more information: https://docs.microsoft.com/sql/relational-databases/security/password-policy", fieldName);
}

export function getPasswordMismatchMessage(fieldName: string): string {
	return localize('passwordNotMatch', "{0} doesn't match the confirmation password", fieldName);
}

