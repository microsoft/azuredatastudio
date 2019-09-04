/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DialogInfo, FieldType, FieldInfo, SectionInfo } from '../interfaces';
import { WizardModel } from './model';

const localize = nls.loadMessageBundle();

export type Validator = () => { valid: boolean, message: string };
export type InputComponents = { [s: string]: azdata.InputBoxComponent | azdata.DropDownComponent; };

export const DefaultInputComponentWidth = '400px';
export const DefaultLabelComponentWidth = '200px';

export interface DialogContext extends CreateContext {
	dialogInfo: DialogInfo;
	container: azdata.window.Dialog;
}

export interface WizardPageContext extends CreateContext {
	sections: SectionInfo[];
	page: azdata.window.WizardPage;
	container: azdata.window.Wizard;
}


export interface SectionContext extends CreateContext {
	sectionInfo: SectionInfo;
	view: azdata.ModelView;
}

interface FieldContext extends CreateContext {
	fieldInfo: FieldInfo;
	components: azdata.Component[];
	view: azdata.ModelView;
}

interface CreateContext {
	container: azdata.window.Dialog | azdata.window.Wizard;
	onNewValidatorCreated: (validator: Validator) => void;
	onNewDisposableCreated: (disposable: vscode.Disposable) => void;
	onNewInputComponentCreated: (name: string, component: azdata.InputBoxComponent | azdata.DropDownComponent) => void;
}

export function initializeDialog(dialogContext: DialogContext): void {
	const tabs: azdata.window.DialogTab[] = [];
	dialogContext.dialogInfo.tabs.forEach(tabInfo => {
		const tab = azdata.window.createTab(tabInfo.title);
		tab.registerContent((view: azdata.ModelView) => {
			const sections = tabInfo.sections.map(sectionInfo => {
				sectionInfo.inputWidth = sectionInfo.inputWidth || tabInfo.inputWidth || DefaultInputComponentWidth;
				sectionInfo.labelWidth = sectionInfo.labelWidth || tabInfo.labelWidth || DefaultLabelComponentWidth;
				return createSection({
					sectionInfo: sectionInfo,
					view: view,
					onNewDisposableCreated: dialogContext.onNewDisposableCreated,
					onNewInputComponentCreated: dialogContext.onNewInputComponentCreated,
					onNewValidatorCreated: dialogContext.onNewValidatorCreated,
					container: dialogContext.container
				});
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
	dialogContext.container.content = tabs;
}

export function initializeWizardPage(context: WizardPageContext): void {
	context.page.registerContent((view: azdata.ModelView) => {
		const sections = context.sections.map(sectionInfo => {
			sectionInfo.inputWidth = sectionInfo.inputWidth || DefaultInputComponentWidth;
			sectionInfo.labelWidth = sectionInfo.labelWidth || DefaultLabelComponentWidth;
			return createSection({
				view: view,
				container: context.container,
				onNewDisposableCreated: context.onNewDisposableCreated,
				onNewInputComponentCreated: context.onNewInputComponentCreated,
				onNewValidatorCreated: context.onNewValidatorCreated,
				sectionInfo: sectionInfo
			});
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

export function createSection(context: SectionContext): azdata.GroupContainer {
	const components: azdata.Component[] = [];
	context.sectionInfo.inputWidth = context.sectionInfo.inputWidth || DefaultInputComponentWidth;
	context.sectionInfo.labelWidth = context.sectionInfo.labelWidth || DefaultLabelComponentWidth;
	if (context.sectionInfo.fields) {
		processFields(context.sectionInfo.fields, components, context);
	} else if (context.sectionInfo.rows) {
		context.sectionInfo.rows.forEach(rowInfo => {
			const rowItems: azdata.Component[] = [];
			processFields(rowInfo.fields, rowItems, context, context.sectionInfo.spaceBetweenFields || '50px');
			const row = createRow(context.view, rowItems);
			components.push(row);
		});
	}
	return context.view.modelBuilder.groupContainer().withItems(components).withLayout({
		header: context.sectionInfo.title,
		collapsible: context.sectionInfo.collapsible === undefined ? true : context.sectionInfo.collapsible,
		collapsed: context.sectionInfo.collapsed === undefined ? false : context.sectionInfo.collapsed
	}).component();
}

function processFields(fieldInfoArray: FieldInfo[], components: azdata.Component[], context: SectionContext, spaceBetweenFields?: string): void {
	for (let i = 0; i < fieldInfoArray.length; i++) {
		const fieldInfo = fieldInfoArray[i];
		fieldInfo.labelWidth = fieldInfo.labelWidth || context.sectionInfo.labelWidth;
		fieldInfo.inputWidth = fieldInfo.inputWidth || context.sectionInfo.inputWidth;
		fieldInfo.labelOnLeft = fieldInfo.labelOnLeft === undefined ? context.sectionInfo.labelOnLeft : fieldInfo.labelOnLeft;
		processField({
			view: context.view,
			onNewDisposableCreated: context.onNewDisposableCreated,
			onNewInputComponentCreated: context.onNewInputComponentCreated,
			onNewValidatorCreated: context.onNewValidatorCreated,
			fieldInfo: fieldInfo,
			container: context.container,
			components: components
		});
		if (spaceBetweenFields && i < fieldInfoArray.length - 1) {
			components.push(context.view.modelBuilder.divContainer().withLayout({ width: spaceBetweenFields }).component());
		}
	}
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


function processField(context: FieldContext): void {
	switch (context.fieldInfo.type) {
		case FieldType.Options:
			processOptionsTypeField(context);
			break;
		case FieldType.DateTimeText:
			processDateTimeTextField(context);
			break;
		case FieldType.Number:
			processNumberField(context);
			break;
		case FieldType.SQLPassword:
		case FieldType.Password:
			processPasswordField(context);
			break;
		case FieldType.Text:
			processTextField(context);
			break;
		case FieldType.ReadonlyText:
			processReadonlyTextField(context);
			break;
		default:
			throw new Error(localize('UnknownFieldTypeError', "Unknown field type: \"{0}\"", context.fieldInfo.type));
	}
}

function createLabelComponent(view: azdata.ModelView, label: string, description?: string, isRequired?: boolean, labelWidth?: string): azdata.TextComponent {
	const text = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
		value: label,
		description: description,
		requiredIndicator: isRequired
	}).component();
	text.width = labelWidth;
	return text;
}

function processOptionsTypeField(context: FieldContext): void {
	const label = createLabelComponent(context.view, context.fieldInfo.label, context.fieldInfo.description, false, context.fieldInfo.labelWidth);
	const dropdown = context.view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
		values: context.fieldInfo.options,
		value: context.fieldInfo.defaultValue
	}).component();
	dropdown.width = context.fieldInfo.inputWidth;
	context.onNewInputComponentCreated(context.fieldInfo.variableName, dropdown);
	addLabelInputPairToContainer(context.view, context.components, label, dropdown, context.fieldInfo.labelOnLeft);
}

function processDateTimeTextField(context: FieldContext): void {
	const label = createLabelComponent(context.view, context.fieldInfo.label, context.fieldInfo.description, context.fieldInfo.required, context.fieldInfo.labelWidth);
	const defaultValue = context.fieldInfo.defaultValue + new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, ''); // Take the date time information and only leaving the numbers
	const input = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: defaultValue,
		ariaLabel: context.fieldInfo.label,
		inputType: 'text',
		required: !context.fieldInfo.useCustomValidator && context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder
	}).component();
	input.width = context.fieldInfo.inputWidth;
	context.onNewInputComponentCreated(context.fieldInfo.variableName, input);
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo.labelOnLeft);
}

function processNumberField(context: FieldContext): void {
	const label = createLabelComponent(context.view, context.fieldInfo.label, context.fieldInfo.description, context.fieldInfo.required, context.fieldInfo.labelWidth);
	const input = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: context.fieldInfo.defaultValue,
		ariaLabel: context.fieldInfo.label,
		inputType: 'number',
		min: context.fieldInfo.min,
		max: context.fieldInfo.max,
		required: !context.fieldInfo.useCustomValidator && context.fieldInfo.required,
		width: context.fieldInfo.inputWidth,
		placeHolder: context.fieldInfo.placeHolder
	}).component();
	context.onNewInputComponentCreated(context.fieldInfo.variableName, input);
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo.labelOnLeft);
}

function processTextField(context: FieldContext): void {
	const label = createLabelComponent(context.view, context.fieldInfo.label, context.fieldInfo.description, context.fieldInfo.required, context.fieldInfo.labelWidth);
	const input = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: context.fieldInfo.defaultValue,
		ariaLabel: context.fieldInfo.label,
		inputType: 'text',
		min: context.fieldInfo.min,
		max: context.fieldInfo.max,
		required: !context.fieldInfo.useCustomValidator && context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: context.fieldInfo.inputWidth
	}).component();
	context.onNewInputComponentCreated(context.fieldInfo.variableName, input);
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo.labelOnLeft);
}

function processPasswordField(context: FieldContext): void {
	const passwordLabel = createLabelComponent(context.view, context.fieldInfo.label, context.fieldInfo.description, context.fieldInfo.required, context.fieldInfo.labelWidth);
	const passwordInput = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		ariaLabel: context.fieldInfo.label,
		inputType: 'password',
		required: !context.fieldInfo.useCustomValidator && context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: context.fieldInfo.inputWidth
	}).component();
	context.onNewInputComponentCreated(context.fieldInfo.variableName, passwordInput);
	addLabelInputPairToContainer(context.view, context.components, passwordLabel, passwordInput, context.fieldInfo.labelOnLeft);

	if (context.fieldInfo.type === FieldType.SQLPassword) {
		const invalidPasswordMessage = getInvalidSQLPasswordMessage(context.fieldInfo.label);
		context.onNewDisposableCreated(passwordInput.onTextChanged(() => {
			if (context.fieldInfo.type === FieldType.SQLPassword && isValidSQLPassword(context.fieldInfo, passwordInput.value!)) {
				removeValidationMessage(context.container, invalidPasswordMessage);
			}
		}));

		context.onNewValidatorCreated((): { valid: boolean, message: string } => {
			return { valid: isValidSQLPassword(context.fieldInfo, passwordInput.value!), message: invalidPasswordMessage };
		});
	}

	if (context.fieldInfo.confirmationRequired) {
		const passwordNotMatchMessage = getPasswordMismatchMessage(context.fieldInfo.label);
		const confirmPasswordLabel = createLabelComponent(context.view, context.fieldInfo.confirmationLabel!, '', true, context.fieldInfo.labelWidth);
		const confirmPasswordInput = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: context.fieldInfo.confirmationLabel,
			inputType: 'password',
			required: !context.fieldInfo.useCustomValidator,
			width: context.fieldInfo.inputWidth
		}).component();

		addLabelInputPairToContainer(context.view, context.components, confirmPasswordLabel, confirmPasswordInput, context.fieldInfo.labelOnLeft);
		context.onNewValidatorCreated((): { valid: boolean, message: string } => {
			const passwordMatches = passwordInput.value === confirmPasswordInput.value;
			return { valid: passwordMatches, message: passwordNotMatchMessage };
		});

		const updatePasswordMismatchMessage = () => {
			if (passwordInput.value === confirmPasswordInput.value) {
				removeValidationMessage(context.container, passwordNotMatchMessage);
			}
		};

		context.onNewDisposableCreated(passwordInput.onTextChanged(() => {
			updatePasswordMismatchMessage();
		}));
		context.onNewDisposableCreated(confirmPasswordInput.onTextChanged(() => {
			updatePasswordMismatchMessage();
		}));
	}
}

function processReadonlyTextField(context: FieldContext): void {
	const label = createLabelComponent(context.view, context.fieldInfo.label, context.fieldInfo.description, false, context.fieldInfo.labelWidth);
	const text = createLabelComponent(context.view, context.fieldInfo.defaultValue!, '', false, context.fieldInfo.inputWidth);
	addLabelInputPairToContainer(context.view, context.components, label, text, context.fieldInfo.labelOnLeft);
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

export function setModelValues(inputComponents: InputComponents, model: WizardModel): void {
	Object.keys(inputComponents).forEach(key => {
		let value;
		const inputValue = inputComponents[key].value;
		if (typeof inputValue === 'string' || typeof inputValue === 'undefined') {
			value = inputValue;
		} else {
			value = inputValue.name;
		}
		model[key] = value;
	});
}

