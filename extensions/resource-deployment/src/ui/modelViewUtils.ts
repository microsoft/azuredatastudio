/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as fs from 'fs';
import { EOL, homedir as os_homedir } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { azureResource } from '../../../azurecore/src/azureResource/azure-resource';
import { AzureAccountFieldInfo, AzureLocationsFieldInfo, ComponentCSSStyles, DialogInfoBase, FieldInfo, FieldType, FilePickerFieldInfo, KubeClusterContextFieldInfo, LabelPosition, NoteBookEnvironmentVariablePrefix, OptionsInfo, OptionsType, PageInfoBase, RowInfo, SectionInfo, TextCSSStyles } from '../interfaces';
import * as loc from '../localizedConstants';
import { apiService } from '../services/apiService';
import { getDefaultKubeConfigPath, getKubeConfigClusterContexts } from '../services/kubeService';
import { assert, getDateTimeString, getErrorMessage } from '../utils';
import { WizardInfoBase } from './../interfaces';
import { Model } from './model';
import { RadioGroupLoadingComponentBuilder } from './radioGroupLoadingComponentBuilder';

const localize = nls.loadMessageBundle();

export type Validator = () => { valid: boolean, message: string };
export type InputValueTransformer = (inputValue: string) => string;
export type InputComponent = azdata.TextComponent | azdata.InputBoxComponent | azdata.DropDownComponent | azdata.CheckBoxComponent | RadioGroupLoadingComponentBuilder;
export type InputComponentInfo = {
	component: InputComponent;
	inputValueTransformer?: InputValueTransformer;
	isPassword?: boolean
};

export type InputComponents = {
	[s: string]: InputComponentInfo
};

export function getInputBoxComponent(name: string, inputComponents: InputComponents): azdata.InputBoxComponent {
	return <azdata.InputBoxComponent>inputComponents[name].component;
}

export function getDropdownComponent(name: string, inputComponents: InputComponents): azdata.DropDownComponent {
	return <azdata.DropDownComponent>inputComponents[name].component;
}

export function getCheckboxComponent(name: string, inputComponents: InputComponents): azdata.CheckBoxComponent {
	return <azdata.CheckBoxComponent>inputComponents[name].component;
}

export function getTextComponent(name: string, inputComponents: InputComponents): azdata.TextComponent {
	return <azdata.TextComponent>inputComponents[name].component;
}

export const DefaultInputWidth = '400px';
export const DefaultLabelWidth = '200px';
export const DefaultFieldAlignItems = undefined;
export const DefaultFieldWidth = undefined;
export const DefaultFieldHeight = undefined;

export interface DialogContext extends ContextBase {
	dialogInfo: DialogInfoBase;
	container: azdata.window.Dialog;
}

export interface WizardPageContext extends ContextBase {
	wizardInfo: WizardInfoBase;
	pageInfo: PageInfoBase;
	page: azdata.window.WizardPage;
	container: azdata.window.Wizard;
}

export interface SectionContext extends ContextBase {
	sectionInfo: SectionInfo;
	view: azdata.ModelView;
}

export interface FieldContext extends ContextBase {
	fieldInfo: FieldInfo;
	components: azdata.Component[];
	view: azdata.ModelView;
}

export interface FilePickerInputs {
	input: azdata.InputBoxComponent;
	browseButton: azdata.ButtonComponent;
}
interface ReadOnlyFieldInputs {
	label: azdata.TextComponent;
	text?: azdata.TextComponent;
}

interface KubeClusterContextFieldContext extends FieldContext {
	fieldInfo: KubeClusterContextFieldInfo;
}

interface AzureLocationsFieldContext extends FieldContext {
	fieldInfo: AzureLocationsFieldInfo;
}

interface AzureAccountFieldContext extends FieldContext {
	fieldInfo: AzureAccountFieldInfo;
}

interface AzureAccountComponents {
	accountDropdown: azdata.DropDownComponent;
	signInButton: azdata.ButtonComponent;
	refreshAccountsButton: azdata.ButtonComponent;
}

interface ContextBase {
	container: azdata.window.Dialog | azdata.window.Wizard;
	inputComponents: InputComponents;
	onNewValidatorCreated: (validator: Validator) => void;
	onNewDisposableCreated: (disposable: vscode.Disposable) => void;
	onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo) => void;
}

export function createTextInput(view: azdata.ModelView, inputInfo: { defaultValue?: string, ariaLabel: string, required?: boolean, placeHolder?: string, width?: string, enabled?: boolean }): azdata.InputBoxComponent {
	return view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: inputInfo.defaultValue,
		ariaLabel: inputInfo.ariaLabel,
		inputType: 'text',
		required: inputInfo.required,
		placeHolder: inputInfo.placeHolder,
		width: inputInfo.width,
		enabled: inputInfo.enabled
	}).component();
}

export function createLabel(view: azdata.ModelView, info: { text: string, description?: string, required?: boolean, width?: string, links?: azdata.LinkArea[], cssStyles?: TextCSSStyles }): azdata.TextComponent {
	let cssStyles: { [key: string]: string } = {};
	if (info.cssStyles !== undefined) {
		cssStyles = Object.assign(cssStyles, info.cssStyles, { 'font-style': info.cssStyles.fontStyle || 'normal', 'font-weight': info.cssStyles.fontWeight || 'normal' });
		if (info.cssStyles.color !== undefined) {
			cssStyles['color'] = info.cssStyles.color;
		}
	}

	const text = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
		value: info.text,
		description: info.description,
		requiredIndicator: info.required,
		CSSStyles: cssStyles,
		links: info.links
	}).component();
	text.width = info.width;
	return text;
}

export function createNumberInput(view: azdata.ModelView, info: { defaultValue?: string, ariaLabel?: string, min?: number, max?: number, required?: boolean, width?: string, placeHolder?: string }): azdata.InputBoxComponent {
	return view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: info.defaultValue,
		ariaLabel: info.ariaLabel,
		inputType: 'number',
		min: info.min,
		max: info.max,
		required: info.required,
		width: info.width,
		placeHolder: info.placeHolder
	}).component();
}

export function createCheckbox(view: azdata.ModelView, info: { initialValue: boolean, label: string, required?: boolean }): azdata.CheckBoxComponent {
	return view.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
		checked: info.initialValue,
		required: info.required,
		label: info.label
	}).component();
}

export function createDropdown(view: azdata.ModelView, info: { defaultValue?: string | azdata.CategoryValue, values?: string[] | azdata.CategoryValue[], width?: string, editable?: boolean, required?: boolean, label: string }): azdata.DropDownComponent {
	return view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
		values: info.values,
		value: info.defaultValue,
		width: info.width,
		editable: info.editable,
		fireOnTextChange: true,
		required: info.required,
		ariaLabel: info.label
	}).component();
}

export function initializeDialog(dialogContext: DialogContext): void {
	const tabs: azdata.window.DialogTab[] = [];
	dialogContext.dialogInfo.tabs.forEach(tabInfo => {
		const tab = azdata.window.createTab(tabInfo.title);
		tab.registerContent(async (view: azdata.ModelView) => {
			const sections = await Promise.all(tabInfo.sections.map(sectionInfo => {
				sectionInfo.inputWidth = sectionInfo.inputWidth || tabInfo.inputWidth || DefaultInputWidth;
				sectionInfo.labelWidth = sectionInfo.labelWidth || tabInfo.labelWidth || DefaultLabelWidth;
				sectionInfo.fieldAlignItems = sectionInfo.fieldAlignItems || tabInfo.fieldAlignItems || DefaultFieldAlignItems;
				sectionInfo.fieldWidth = sectionInfo.fieldWidth || tabInfo.fieldWidth || DefaultFieldWidth;
				sectionInfo.fieldHeight = sectionInfo.fieldHeight || tabInfo.fieldHeight || DefaultFieldHeight;
				sectionInfo.labelPosition = sectionInfo.labelPosition || tabInfo.labelPosition;
				return createSection({
					sectionInfo: sectionInfo,
					view: view,
					onNewDisposableCreated: dialogContext.onNewDisposableCreated,
					onNewInputComponentCreated: dialogContext.onNewInputComponentCreated,
					onNewValidatorCreated: dialogContext.onNewValidatorCreated,
					container: dialogContext.container,
					inputComponents: dialogContext.inputComponents
				});
			}));
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
	context.page.registerContent(async (view: azdata.ModelView) => {
		const sections = await Promise.all(context.pageInfo.sections.map(sectionInfo => {
			sectionInfo.inputWidth = sectionInfo.inputWidth || context.pageInfo.inputWidth || context.wizardInfo.inputWidth || DefaultInputWidth;
			sectionInfo.labelWidth = sectionInfo.labelWidth || context.pageInfo.labelWidth || context.wizardInfo.labelWidth || DefaultLabelWidth;
			sectionInfo.fieldAlignItems = sectionInfo.fieldAlignItems || context.pageInfo.fieldAlignItems || DefaultFieldAlignItems;
			sectionInfo.fieldWidth = sectionInfo.fieldWidth || context.pageInfo.fieldWidth || context.wizardInfo.fieldWidth || DefaultFieldWidth;
			sectionInfo.fieldHeight = sectionInfo.fieldHeight || context.pageInfo.fieldHeight || context.wizardInfo.fieldHeight || DefaultFieldHeight;
			sectionInfo.labelPosition = sectionInfo.labelPosition || context.pageInfo.labelPosition || context.wizardInfo.labelPosition;
			return createSection({
				view: view,
				container: context.container,
				inputComponents: context.inputComponents,
				onNewDisposableCreated: context.onNewDisposableCreated,
				onNewInputComponentCreated: context.onNewInputComponentCreated,
				onNewValidatorCreated: context.onNewValidatorCreated,
				sectionInfo: sectionInfo
			});
		}));
		const formBuilder = view.modelBuilder.formContainer().withFormItems(
			sections.map(section => { return { title: '', component: section }; }),
			{
				horizontal: false,
				componentWidth: '100%'
			}
		);
		const form: azdata.FormContainer = formBuilder.withLayout({ width: '100%' }).component();
		return view.initializeModel(form);
	});
}

export async function createSection(context: SectionContext): Promise<azdata.GroupContainer> {
	const components: azdata.Component[] = [];
	context.sectionInfo.inputWidth = context.sectionInfo.inputWidth || DefaultInputWidth;
	context.sectionInfo.labelWidth = context.sectionInfo.labelWidth || DefaultLabelWidth;
	context.sectionInfo.fieldAlignItems = context.sectionInfo.fieldAlignItems || DefaultFieldAlignItems;
	context.sectionInfo.fieldWidth = context.sectionInfo.fieldWidth || DefaultFieldWidth;
	context.sectionInfo.fieldHeight = context.sectionInfo.fieldHeight || DefaultFieldHeight;
	if (context.sectionInfo.fields) {
		await processFields(context.sectionInfo.fields, components, context);
	} else if (context.sectionInfo.rows) {
		for (const rowInfo of context.sectionInfo.rows) {
			components.push(await processRow(rowInfo, context));
		}
	}

	return createGroupContainer(context.view, components, {
		header: context.sectionInfo.title,
		collapsible: context.sectionInfo.collapsible === undefined ? true : context.sectionInfo.collapsible,
		collapsed: context.sectionInfo.collapsed === undefined ? false : context.sectionInfo.collapsed
	});
}

async function processRow(rowInfo: RowInfo, context: SectionContext): Promise<azdata.Component> {
	const items: azdata.Component[] = [];
	if ('items' in rowInfo.items[0]) { // rowInfo.items is RowInfo[]
		const rowItems = rowInfo.items as RowInfo[];
		items.push(...(await Promise.all(rowItems.map(rowInfo => processRow(rowInfo, context)))));
	} else { // rowInfo.items is FieldInfo[]
		const fieldItems = rowInfo.items as FieldInfo[];
		await processFields(fieldItems, items, context, context.sectionInfo.spaceBetweenFields === undefined ? '50px' : context.sectionInfo.spaceBetweenFields);
	}
	return createFlexContainer(context.view, items, true, context.sectionInfo.fieldWidth, context.sectionInfo.fieldHeight, context.sectionInfo.fieldAlignItems, rowInfo.cssStyles);
}

async function processFields(fieldInfoArray: FieldInfo[], components: azdata.Component[], context: SectionContext, spaceBetweenFields?: string): Promise<void> {
	for (let i = 0; i < fieldInfoArray.length; i++) {
		const fieldInfo = fieldInfoArray[i];
		fieldInfo.labelWidth = fieldInfo.labelWidth || context.sectionInfo.labelWidth;
		fieldInfo.inputWidth = fieldInfo.inputWidth || context.sectionInfo.inputWidth;
		fieldInfo.fieldAlignItems = fieldInfo.fieldAlignItems || context.sectionInfo.fieldAlignItems;
		fieldInfo.fieldWidth = fieldInfo.fieldWidth || context.sectionInfo.fieldWidth;
		fieldInfo.fieldHeight = fieldInfo.fieldHeight || context.sectionInfo.fieldHeight;
		fieldInfo.labelPosition = fieldInfo.labelPosition === undefined ? context.sectionInfo.labelPosition : fieldInfo.labelPosition;
		await processField({
			view: context.view,
			onNewDisposableCreated: context.onNewDisposableCreated,
			onNewInputComponentCreated: context.onNewInputComponentCreated,
			onNewValidatorCreated: context.onNewValidatorCreated,
			fieldInfo: fieldInfo,
			container: context.container,
			inputComponents: context.inputComponents,
			components: components
		});
		if (spaceBetweenFields && i < fieldInfoArray.length - 1) {
			components.push(context.view.modelBuilder.divContainer().withLayout({ width: spaceBetweenFields }).component());
		}
	}
}

export function createFlexContainer(view: azdata.ModelView, items: azdata.Component[], rowLayout: boolean = true, width?: string | number, height?: string | number, alignItems?: azdata.AlignItemsType, cssStyles?: ComponentCSSStyles): azdata.FlexContainer {
	const flexFlow = rowLayout ? 'row' : 'column';
	alignItems = alignItems || (rowLayout ? 'center' : undefined);
	const itemsStyle = rowLayout ? { CSSStyles: { 'margin-right': '5px', } } : {};
	const flexLayout: azdata.FlexLayout = { flexFlow: flexFlow };
	if (height) {
		flexLayout.height = height;
	}
	if (width) {
		flexLayout.width = width;
	}
	if (alignItems) {
		flexLayout.alignItems = alignItems;
	}
	return view.modelBuilder.flexContainer().withItems(items, itemsStyle).withLayout(flexLayout).withProperties<azdata.ComponentProperties>({ CSSStyles: cssStyles || {} }).component();
}

export function createGroupContainer(view: azdata.ModelView, items: azdata.Component[], layout: azdata.GroupLayout): azdata.GroupContainer {
	return view.modelBuilder.groupContainer().withItems(items).withLayout(layout).component();
}

function addLabelInputPairToContainer(view: azdata.ModelView, components: azdata.Component[], label: azdata.Component, input: azdata.Component | undefined, fieldInfo: FieldInfo, additionalComponents?: azdata.Component[]) {
	const inputs: azdata.Component[] = [label];
	if (input !== undefined) {
		inputs.push(input);
	}
	if (additionalComponents && additionalComponents.length > 0) {
		inputs.push(...additionalComponents);
	}
	if (fieldInfo.labelPosition === LabelPosition.Left) {
		const row = createFlexContainer(view, inputs, true, fieldInfo.fieldWidth, fieldInfo.fieldHeight, fieldInfo.fieldAlignItems);
		components.push(row);
	} else {
		components.push(...inputs);
	}
}

async function processField(context: FieldContext): Promise<void> {
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
		case FieldType.Checkbox:
			processCheckboxField(context);
			break;
		case FieldType.AzureAccount:
			processAzureAccountField(context);
			break;
		case FieldType.AzureLocations:
			await processAzureLocationsField(context);
			break;
		case FieldType.FilePicker:
			processFilePickerField(context);
			break;
		case FieldType.KubeClusterContextPicker:
			processKubeConfigClusterPickerField(context);
			break;
		default:
			throw new Error(localize('UnknownFieldTypeError', "Unknown field type: \"{0}\"", context.fieldInfo.type));
	}
}

function processOptionsTypeField(context: FieldContext): void {
	assert(context.fieldInfo.options !== undefined, `FieldInfo.options must be defined for FieldType:${FieldType.Options}`);
	if (Array.isArray(context.fieldInfo.options)) {
		context.fieldInfo.options = <OptionsInfo>{
			values: context.fieldInfo.options,
			defaultValue: context.fieldInfo.defaultValue,
			optionsType: OptionsType.Dropdown
		};
	}
	assert(typeof context.fieldInfo.options === 'object', `FieldInfo.options must be an object if it is not an array`);
	assert('optionsType' in context.fieldInfo.options, `When FieldInfo.options is an object it must have 'optionsType' property`);
	if (context.fieldInfo.options.optionsType === OptionsType.Radio) {
		processRadioOptionsTypeField(context);
	} else {
		assert(context.fieldInfo.options.optionsType === OptionsType.Dropdown, `When optionsType is not ${OptionsType.Radio} then it must be ${OptionsType.Dropdown}`);
		processDropdownOptionsTypeField(context);
	}
}

function processDropdownOptionsTypeField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const options = context.fieldInfo.options as OptionsInfo;
	const dropdown = createDropdown(context.view, {
		values: options.values,
		defaultValue: options.defaultValue,
		width: context.fieldInfo.inputWidth,
		editable: context.fieldInfo.editable,
		required: context.fieldInfo.required,
		label: context.fieldInfo.label
	});
	dropdown.fireOnTextChange = true;
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: dropdown });
	addLabelInputPairToContainer(context.view, context.components, label, dropdown, context.fieldInfo);
}

function processDateTimeTextField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const defaultValue = context.fieldInfo.defaultValue + getDateTimeString();
	const input = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: defaultValue,
		ariaLabel: context.fieldInfo.label,
		inputType: 'text',
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder
	}).component();
	input.width = context.fieldInfo.inputWidth;
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: input });
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo);
}

function processNumberField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const input = createNumberInput(context.view, {
		defaultValue: context.fieldInfo.defaultValue,
		ariaLabel: context.fieldInfo.label,
		min: context.fieldInfo.min,
		max: context.fieldInfo.max,
		required: context.fieldInfo.required,
		width: context.fieldInfo.inputWidth,
		placeHolder: context.fieldInfo.placeHolder
	});
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: input });
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo);
}

function processTextField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const input = createTextInput(context.view, {
		defaultValue: context.fieldInfo.defaultValue,
		ariaLabel: context.fieldInfo.label,
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: context.fieldInfo.inputWidth,
		enabled: context.fieldInfo.enabled
	});
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: input });
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo);

	if (context.fieldInfo.textValidationRequired) {
		let validationRegex: RegExp = new RegExp(context.fieldInfo.textValidationRegex!);

		const removeInvalidInputMessage = (): void => {
			if (validationRegex.test(input.value!)) { // input is valid
				removeValidationMessage(context.container, context.fieldInfo.textValidationDescription!);
			}
		};

		context.onNewDisposableCreated(input.onTextChanged(() => {
			removeInvalidInputMessage();
		}));

		const inputValidator: Validator = (): { valid: boolean; message: string; } => {
			const inputIsValid = validationRegex.test(input.value!);
			return { valid: inputIsValid, message: context.fieldInfo.textValidationDescription! };
		};
		context.onNewValidatorCreated(inputValidator);
	}
}

function processPasswordField(context: FieldContext): void {
	const passwordLabel = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const passwordInput = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		ariaLabel: context.fieldInfo.label,
		inputType: 'password',
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: context.fieldInfo.inputWidth
	}).component();
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: passwordInput, isPassword: true });
	addLabelInputPairToContainer(context.view, context.components, passwordLabel, passwordInput, context.fieldInfo);

	if (context.fieldInfo.type === FieldType.SQLPassword) {
		const invalidPasswordMessage = getInvalidSQLPasswordMessage(context.fieldInfo.label);
		context.onNewDisposableCreated(passwordInput.onTextChanged(() => {
			if (context.fieldInfo.type === FieldType.SQLPassword && isValidSQLPassword(passwordInput.value!, context.fieldInfo.userName)) {
				removeValidationMessage(context.container, invalidPasswordMessage);
			}
		}));

		context.onNewValidatorCreated((): { valid: boolean, message: string } => {
			return { valid: isValidSQLPassword(passwordInput.value!, context.fieldInfo.userName), message: invalidPasswordMessage };
		});
	}

	if (context.fieldInfo.confirmationRequired) {
		const passwordNotMatchMessage = getPasswordMismatchMessage(context.fieldInfo.label);
		const confirmPasswordLabel = createLabel(context.view, { text: context.fieldInfo.confirmationLabel!, required: true, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
		const confirmPasswordInput = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: context.fieldInfo.confirmationLabel,
			inputType: 'password',
			required: true,
			width: context.fieldInfo.inputWidth
		}).component();

		addLabelInputPairToContainer(context.view, context.components, confirmPasswordLabel, confirmPasswordInput, context.fieldInfo);
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

function processReadonlyTextField(context: FieldContext, allowEvaluation: boolean = true): ReadOnlyFieldInputs {
	if ((context.fieldInfo.links?.length ?? 0) > 0) {
		return processHyperlinkedTextField(context);
	} else if (context.fieldInfo.isEvaluated && allowEvaluation) {
		return processEvaluatedTextField(context);
	}
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: false, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const text = context.fieldInfo.defaultValue !== undefined
		? createLabel(context.view, { text: context.fieldInfo.defaultValue, description: '', required: false, width: context.fieldInfo.inputWidth })
		: undefined;
	addLabelInputPairToContainer(context.view, context.components, label, text, context.fieldInfo);
	return { label: label, text: text };
}

/**
 * creates a text component that has text that contains hyperlinks. The context.fieldInfo.label contains {0},{1} ...
 * placeholder(s) where contents of link array object are placed with that portion interpolated as a clickable link.
 *
 * @param context - the FieldContext object using which the field gets created
 */
function processHyperlinkedTextField(context: FieldContext): ReadOnlyFieldInputs {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: false, width: context.fieldInfo.labelWidth, links: context.fieldInfo.links, cssStyles: context.fieldInfo.labelCSSStyles });
	context.components.push(label);
	return { label: label };
}

function processEvaluatedTextField(context: FieldContext): ReadOnlyFieldInputs {
	const readOnlyField = processReadonlyTextField(context, false /*allowEvaluation*/);
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, {
		component: readOnlyField.text!,
		inputValueTransformer: () => {
			readOnlyField.text!.value = substituteVariableValues(context.inputComponents, context.fieldInfo.defaultValue);
			return readOnlyField.text?.value!;
		}
	});
	return readOnlyField;
}

/**
 * Returns a string that interpolates all variable names in the {@param inputValue} string de-marked as $(VariableName)
 * substituted with their corresponding values.
 *
 * Only variables in the current model starting with {@see NoteBookEnvironmentVariablePrefix} are replaced.
 *
 * @param inputValue
 * @param inputComponents
 */
function substituteVariableValues(inputComponents: InputComponents, inputValue?: string): string | undefined {
	Object.keys(inputComponents)
		.filter(key => key.startsWith(NoteBookEnvironmentVariablePrefix))
		.forEach(key => {
			const value = getInputComponentValue(inputComponents, key) ?? '<undefined>';
			const re: RegExp = new RegExp(`\\\$\\\(${key}\\\)`, 'gi');
			inputValue = inputValue?.replace(re, value);
		});
	return inputValue;
}

function processCheckboxField(context: FieldContext): void {
	const checkbox = createCheckbox(context.view, { initialValue: context.fieldInfo.defaultValue! === 'true', label: context.fieldInfo.label, required: context.fieldInfo.required });
	context.components.push(checkbox);
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: checkbox });
}

/**
 * A File Picker field consists of a text field and a browse button that allows a user to pick a file system file.
 * @param context The context to use to create the field
 */
function processFilePickerField(context: FieldContext): FilePickerInputs {
	const inputWidth = parseInt(context.fieldInfo.inputWidth!.replace(/px/g, '').trim());
	const buttonWidth = 100;

	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const input = createTextInput(context.view, {
		defaultValue: context.fieldInfo.defaultValue || '',
		ariaLabel: context.fieldInfo.label,
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: `${inputWidth - buttonWidth}px`,
		enabled: context.fieldInfo.enabled
	});
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: input });
	input.enabled = false;
	const browseFileButton = context.view!.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: loc.browse, width: buttonWidth }).component();
	const fieldInfo = context.fieldInfo as FilePickerFieldInfo;
	let filter: { [name: string]: string[] } | undefined = undefined;
	if (fieldInfo.filter) {
		const filterName = fieldInfo.filter.displayName;
		filter = {};
		filter[filterName] = fieldInfo.filter.fileTypes;
	}
	context.onNewDisposableCreated(browseFileButton.onDidClick(async () => {
		let fileUris = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri: vscode.Uri.file(path.dirname(input.value || os_homedir())),
			openLabel: loc.select,
			filters: filter
		});
		if (!fileUris || fileUris.length === 0) {
			return;
		}
		let fileUri = fileUris[0];
		input.value = fileUri.fsPath;
	}));
	const component = createFlexContainer(context.view, [input, browseFileButton], true, context.fieldInfo.inputWidth);
	addLabelInputPairToContainer(context.view, context.components, label, component, context.fieldInfo);
	return { input: input, browseButton: browseFileButton };
}

/**
 *	This function returns a method that reads the cluster context from the {@param file}. This method then returns the cluster contexts
 *  read as an OptionsInfo object asynchronously.
 *
 * @param file - the file from which to fetch the cluster contexts
 */
function getClusterContexts(file: string): (() => Promise<OptionsInfo>) {
	return async () => {
		await throwIfNotExistsOrNotAFile(file);
		try {
			let currentClusterContext = '';
			const clusterContexts: string[] = (await getKubeConfigClusterContexts(file)).map(kubeClusterContext => {
				if (kubeClusterContext.isCurrentContext) {
					currentClusterContext = kubeClusterContext.name;
				}
				return kubeClusterContext.name;
			});
			if (clusterContexts.length === 0) {
				throw Error(loc.clusterContextNotFound);
			}
			return { values: clusterContexts, defaultValue: currentClusterContext };
		}
		catch (e) {
			throw Error(localize('getClusterContexts.errorFetchingClusters', "An error ocurred while loading or parsing the config file:{0}, error is:{1}", file, getErrorMessage(e)));
		}
	};
}

async function throwIfNotExistsOrNotAFile(file: string) {
	try {
		const stats = await fs.promises.stat(file); // this throws if the file does not exist with error.code = ENOENT
		if (!stats.isFile()) {
			throw Error(localize('fileChecker.NotFile', "Path: {0} is not a file, please select a valid kube config file.", file));
		}
	}
	catch (e) {
		if (e.code === 'ENOENT') {
			throw Error(localize('fileChecker.FileNotFound', "File: {0} not found. Please select a kube config file.", file));
		}
		else {
			throw e;
		}
	}
}

/**
 * A Kube Config Cluster picker field consists of a file system file picker and radio button selector for cluster contexts defined in the config filed picked using the file picker.
 * @param context The context to use to create the field
 */
async function processKubeConfigClusterPickerField(context: KubeClusterContextFieldContext): Promise<void> {
	const kubeConfigFilePathVariableName = context.fieldInfo.configFileVariableName || 'AZDATA_NB_VAR_KUBECONFIG_PATH';
	const filePickerContext: FieldContext = {
		container: context.container,
		inputComponents: context.inputComponents,
		components: context.components,
		view: context.view,
		onNewValidatorCreated: context.onNewValidatorCreated,
		onNewDisposableCreated: context.onNewDisposableCreated,
		onNewInputComponentCreated: context.onNewInputComponentCreated,
		fieldInfo: {
			label: loc.kubeConfigFilePath,
			type: FieldType.FilePicker,
			defaultValue: getDefaultKubeConfigPath(),
			inputWidth: context.fieldInfo.inputWidth,
			labelWidth: context.fieldInfo.labelWidth,
			variableName: kubeConfigFilePathVariableName,
			labelPosition: LabelPosition.Left,
			required: true
		}
	};
	const filePicker = processFilePickerField(filePickerContext);
	context.fieldInfo.subFields = context.fieldInfo.subFields || [];
	context.fieldInfo.subFields.push({
		label: filePickerContext.fieldInfo.label,
		variableName: kubeConfigFilePathVariableName
	});

	const radioOptionsGroup = await createRadioOptions(context, getClusterContexts(filePicker.input.value!));
	context.onNewDisposableCreated(filePicker.input.onTextChanged(async () =>
		await radioOptionsGroup.loadOptions(getClusterContexts(filePicker.input.value!))
	));

}

async function processRadioOptionsTypeField(context: FieldContext): Promise<RadioGroupLoadingComponentBuilder> {
	return await createRadioOptions(context);
}


async function createRadioOptions(context: FieldContext, getRadioButtonInfo?: (() => Promise<OptionsInfo>))
	: Promise<RadioGroupLoadingComponentBuilder> {
	if (context.fieldInfo.fieldAlignItems === undefined) {
		context.fieldInfo.fieldAlignItems = 'flex-start'; // by default align the items to the top.
	}
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const radioGroupLoadingComponentBuilder = new RadioGroupLoadingComponentBuilder(context.view, context.onNewDisposableCreated);
	context.fieldInfo.labelPosition = LabelPosition.Left;
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: radioGroupLoadingComponentBuilder });
	addLabelInputPairToContainer(context.view, context.components, label, radioGroupLoadingComponentBuilder.component(), context.fieldInfo);
	const options = context.fieldInfo.options as OptionsInfo;
	await radioGroupLoadingComponentBuilder.loadOptions(
		getRadioButtonInfo || options); // wait for the radioGroup to be fully initialized
	return radioGroupLoadingComponentBuilder;
}

const enum AccountStatus {
	notFound = 0,
	isStale,
	isNotStale,
}

async function getAccountStatus(account: azdata.Account): Promise<AccountStatus> {
	const refreshedAccount = (await azdata.accounts.getAllAccounts()).find(ac => ac.key.accountId === account.key.accountId);
	return (refreshedAccount === undefined)
		? AccountStatus.notFound
		: refreshedAccount.isStale ? AccountStatus.isStale : AccountStatus.isNotStale;
}

/**
 * An Azure Account field consists of 3 separate dropdown fields - Account, Subscription and Resource Group
 * @param context The context to use to create the field
 */
async function processAzureAccountField(context: AzureAccountFieldContext): Promise<void> {
	context.fieldInfo.subFields = [];
	const accountValueToAccountMap = new Map<string, azdata.Account>();
	const subscriptionValueToSubscriptionMap = new Map<string, azureResource.AzureResourceSubscription>();
	const accountComponents = createAzureAccountDropdown(context);
	const accountDropdown = accountComponents.accountDropdown;
	const subscriptionDropdown = createAzureSubscriptionDropdown(context, subscriptionValueToSubscriptionMap);
	const resourceGroupDropdown = createAzureResourceGroupsDropdown(context, accountDropdown, accountValueToAccountMap, subscriptionDropdown, subscriptionValueToSubscriptionMap);
	if (context.fieldInfo.allowNewResourceGroup) {
		const newRGCheckbox = createCheckbox(context.view, { initialValue: false, label: loc.createNewResourceGroup });
		context.onNewInputComponentCreated(context.fieldInfo.newResourceGroupFlagVariableName!, { component: newRGCheckbox });
		const newRGNameInput = createTextInput(context.view, { ariaLabel: loc.NewResourceGroupAriaLabel });
		context.onNewInputComponentCreated(context.fieldInfo.newResourceGroupNameVariableName!, { component: newRGNameInput });
		context.components.push(newRGCheckbox);
		context.components.push(newRGNameInput);
		const setRGStatus = (newRG: boolean) => {
			resourceGroupDropdown.required = !newRG;
			resourceGroupDropdown.enabled = !newRG;
			newRGNameInput.required = newRG;
			newRGNameInput.enabled = newRG;
			if (!newRG) {
				newRGNameInput.value = '';
			}
		};
		context.onNewDisposableCreated(newRGCheckbox.onChanged(() => {
			setRGStatus(newRGCheckbox.checked!);
		}));
		setRGStatus(false);
	}
	const locationDropdown = context.fieldInfo.locations && await processAzureLocationsField(context);
	accountDropdown.onValueChanged(async selectedItem => {
		const selectedAccount = accountValueToAccountMap.get(selectedItem.selected)!;
		await handleSelectedAccountChanged(context, selectedAccount, subscriptionDropdown, subscriptionValueToSubscriptionMap, resourceGroupDropdown, locationDropdown);
	});

	const populateAzureAccounts = async () => {
		accountValueToAccountMap.clear();
		try {
			const accounts = await azdata.accounts.getAllAccounts();
			// Append a blank value for the "default" option if the field isn't required, context will clear all the dropdowns when selected
			const dropdownValues = context.fieldInfo.required ? [] : [''];
			accountDropdown.values = dropdownValues.concat(accounts.map(account => {
				const displayName = getAccountDisplayString(account);
				accountValueToAccountMap.set(displayName, account);
				return displayName;
			}));
			const selectedAccount = accountDropdown.value ? accountValueToAccountMap.get(accountDropdown.value.toString()) : undefined;
			await handleSelectedAccountChanged(context, selectedAccount, subscriptionDropdown, subscriptionValueToSubscriptionMap, resourceGroupDropdown, locationDropdown);
		} catch (error) {
			vscode.window.showErrorMessage(localize('azure.accounts.unexpectedAccountsError', 'Unexpected error fetching accounts: {0}', getErrorMessage(error)));
		}
	};

	context.onNewDisposableCreated(accountComponents.refreshAccountsButton.onDidClick(async () => {
		await populateAzureAccounts();
	}));
	context.onNewDisposableCreated(accountComponents.signInButton.onDidClick(async () => {
		await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
		await populateAzureAccounts();
	}));

	// populate the values in a different batch as the initialization to avoid the issue that the account list is empty even though the values are correctly.
	setTimeout(async () => {
		await populateAzureAccounts();
	}, 0);
}

function getAccountDisplayString(account: azdata.Account) {
	return `${account.displayInfo.displayName} (${account.displayInfo.userId})`;
}

function createAzureAccountDropdown(context: AzureAccountFieldContext): AzureAccountComponents {
	const label = createLabel(context.view, {
		text: loc.account,
		description: context.fieldInfo.description,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});
	const accountDropdown = createDropdown(context.view, {
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.account
	});
	accountDropdown.fireOnTextChange = true;
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, { component: accountDropdown });
	const signInButton = context.view!.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: loc.signIn, width: '100px' }).component();
	const refreshButton = context.view!.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: loc.refresh, width: '100px' }).component();
	addLabelInputPairToContainer(context.view, context.components, label, accountDropdown, context.fieldInfo);

	const buttons = createFlexContainer(context.view!, [signInButton, refreshButton], true, undefined, undefined, undefined, { 'margin-right': '10px' });
	context.components.push(buttons);
	return {
		accountDropdown: accountDropdown,
		signInButton: signInButton,
		refreshAccountsButton: refreshButton
	};

}

function createAzureSubscriptionDropdown(
	context: AzureAccountFieldContext,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>): azdata.DropDownComponent {
	const label = createLabel(context.view, {
		text: loc.subscription,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});
	const subscriptionDropdown = createDropdown(context.view, {
		defaultValue: (context.fieldInfo.required) ? undefined : '',
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.subscription
	});
	subscriptionDropdown.fireOnTextChange = true;
	context.fieldInfo.subFields!.push({
		label: label.value!,
		variableName: context.fieldInfo.subscriptionVariableName
	});
	context.onNewInputComponentCreated(context.fieldInfo.subscriptionVariableName!, {
		component: subscriptionDropdown,
		inputValueTransformer: (inputValue: string) => {
			return subscriptionValueToSubscriptionMap.get(inputValue)?.id || inputValue;
		}
	});
	if (context.fieldInfo.displaySubscriptionVariableName) {
		context.fieldInfo.subFields!.push({
			label: label.value!,
			variableName: context.fieldInfo.displaySubscriptionVariableName
		});
		context.onNewInputComponentCreated(context.fieldInfo.displaySubscriptionVariableName, { component: subscriptionDropdown });
	}
	addLabelInputPairToContainer(context.view, context.components, label, subscriptionDropdown, context.fieldInfo);
	return subscriptionDropdown;
}

async function handleSelectedAccountChanged(
	context: AzureAccountFieldContext,
	selectedAccount: azdata.Account | undefined,
	subscriptionDropdown: azdata.DropDownComponent,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>,
	resourceGroupDropdown: azdata.DropDownComponent,
	locationDropdown?: azdata.DropDownComponent
): Promise<void> {
	subscriptionValueToSubscriptionMap.clear();
	subscriptionDropdown.values = [];
	await handleSelectedSubscriptionChanged(context, selectedAccount, undefined, resourceGroupDropdown);
	if (!selectedAccount) {
		subscriptionDropdown.values = [''];
		if (locationDropdown) {
			locationDropdown.values = [''];
		}
		return;
	}

	if (locationDropdown) {
		if (locationDropdown.values && locationDropdown.values.length === 0) {
			locationDropdown.values = context.fieldInfo.locations;
		}
	}

	try {
		const response = await (await apiService.getAzurecoreApi()).getSubscriptions(selectedAccount, true);
		if (!response) {
			return;
		}
		if (response.errors.length > 0) {
			const accountStatus = await getAccountStatus(selectedAccount);

			// If accountStatus is not found or stale then user needs to sign in again
			// else individual errors received from the response are bubbled up.
			if (accountStatus === AccountStatus.isStale || accountStatus === AccountStatus.notFound) {
				const errMsg = await getAzureAccessError({ selectedAccount, accountStatus });
				context.container.message = {
					text: errMsg,
					description: '',
					level: azdata.window.MessageLevel.Error
				};
			} else {
				// If we got back some subscriptions then don't display the errors to the user - it's normal for users
				// to not necessarily have access to all subscriptions on an account so displaying the errors
				// in that case is usually just distracting and causes confusion
				const errMsg = response.errors.join(EOL);
				if (response.subscriptions.length === 0) {
					context.container.message = {
						text: errMsg,
						description: '',
						level: azdata.window.MessageLevel.Error
					};
				} else {
					console.log(errMsg);
				}
			}
		}
		subscriptionDropdown.values = response.subscriptions.map(subscription => {
			const displayName = getSubscriptionDisplayString(subscription);
			subscriptionValueToSubscriptionMap.set(displayName, subscription);
			return displayName;
		}).sort((a: string, b: string) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()));
		const selectedSubscription = subscriptionDropdown.values.length > 0 ? subscriptionValueToSubscriptionMap.get(subscriptionDropdown.values[0]) : undefined;
		await handleSelectedSubscriptionChanged(context, selectedAccount, selectedSubscription, resourceGroupDropdown);
	} catch (error) {
		await vscode.window.showErrorMessage(await getAzureAccessError({ selectedAccount, defaultErrorMessage: localize('azure.accounts.unexpectedSubscriptionsError', "Unexpected error fetching subscriptions for account {0}: {1}", getAccountDisplayString(selectedAccount), getErrorMessage(error)), error }));
	}
}

function getSubscriptionDisplayString(subscription: azureResource.AzureResourceSubscription) {
	return `${subscription.name} (${subscription.id})`;
}

type AccountAccessParams = {
	selectedAccount: azdata.Account;
	defaultErrorMessage?: string;
	error?: any;
	accountStatus?: AccountStatus;
};

async function getAzureAccessError({ selectedAccount, defaultErrorMessage = '', error = undefined, accountStatus = undefined }: AccountAccessParams): Promise<string> {
	if (accountStatus === undefined) {
		accountStatus = await getAccountStatus(selectedAccount);
	}
	switch (accountStatus) {
		case AccountStatus.notFound:
			return localize('azure.accounts.accountNotFoundError', "The selected account '{0}' is no longer available. Click sign in to add it again or select a different account.", getAccountDisplayString(selectedAccount))
				+ (error !== undefined ? localize('azure.accessError', "\n Error Details: {0}.", getErrorMessage(error)) : '');
		case AccountStatus.isStale:
			return localize('azure.accounts.accountStaleError', "The access token for selected account '{0}' is no longer valid. Please click the sign in button and refresh the account or select a different account.", getAccountDisplayString(selectedAccount))
				+ (error !== undefined ? localize('azure.accessError', "\n Error Details: {0}.", getErrorMessage(error)) : '');
		case AccountStatus.isNotStale:
			return defaultErrorMessage;
	}
}

function createAzureResourceGroupsDropdown(
	context: AzureAccountFieldContext,
	accountDropdown: azdata.DropDownComponent,
	accountValueToAccountMap: Map<string, azdata.Account>,
	subscriptionDropdown: azdata.DropDownComponent,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>): azdata.DropDownComponent {
	const label = createLabel(context.view, {
		text: loc.resourceGroup,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});
	const resourceGroupDropdown = createDropdown(context.view, {
		defaultValue: (context.fieldInfo.required) ? undefined : '',
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.resourceGroup
	});
	resourceGroupDropdown.fireOnTextChange = true;
	context.fieldInfo.subFields!.push({
		label: label.value!,
		variableName: context.fieldInfo.resourceGroupVariableName
	});
	const rgValueChangedEmitter = new vscode.EventEmitter<void>();
	resourceGroupDropdown.onValueChanged(() => rgValueChangedEmitter.fire());
	context.onNewInputComponentCreated(context.fieldInfo.resourceGroupVariableName!, { component: resourceGroupDropdown });
	addLabelInputPairToContainer(context.view, context.components, label, resourceGroupDropdown, context.fieldInfo);
	subscriptionDropdown.onValueChanged(async selectedItem => {
		const selectedAccount = !accountDropdown || !accountDropdown.value ? undefined : accountValueToAccountMap.get(accountDropdown.value.toString());
		const selectedSubscription = subscriptionValueToSubscriptionMap.get(selectedItem.selected);
		await handleSelectedSubscriptionChanged(context, selectedAccount, selectedSubscription, resourceGroupDropdown);
		rgValueChangedEmitter.fire();
	});
	return resourceGroupDropdown;
}

async function handleSelectedSubscriptionChanged(context: AzureAccountFieldContext, selectedAccount: azdata.Account | undefined, selectedSubscription: azureResource.AzureResourceSubscription | undefined, resourceGroupDropdown: azdata.DropDownComponent): Promise<void> {
	resourceGroupDropdown.values = [''];
	if (!selectedAccount || !selectedSubscription) {
		// Don't need to execute command if we don't have both an account and subscription selected
		return;
	}
	try {
		const response = await (await apiService.getAzurecoreApi()).getResourceGroups(selectedAccount, selectedSubscription, true);
		if (!response) {
			return;
		}
		if (response.errors.length > 0) {
			const accountStatus = await getAccountStatus(selectedAccount);

			// If accountStatus is not found or stale then user needs to sign in again
			// else individual errors received from the response are bubbled up.
			if (accountStatus === AccountStatus.isStale || accountStatus === AccountStatus.notFound) {
				const errMsg = await getAzureAccessError({ selectedAccount, accountStatus });
				context.container.message = {
					text: errMsg,
					description: '',
					level: azdata.window.MessageLevel.Error
				};
			} else {
				// If we got back some Resource Groups then don't display the errors to the user - it's normal for users
				// to not necessarily have access to all Resource Groups on a subscription so displaying the errors
				// in that case is usually just distracting and causes confusion
				const errMsg = response.errors.join(EOL);
				if (response.resourceGroups.length === 0) {
					context.container.message = {
						text: errMsg,
						description: '',
						level: azdata.window.MessageLevel.Error
					};
				} else {
					console.log(errMsg);
				}
			}
		}
		resourceGroupDropdown.values = (response.resourceGroups.length !== 0)
			? response.resourceGroups.map(resourceGroup => resourceGroup.name).sort((a: string, b: string) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()))
			: [''];
	} catch (error) {
		await vscode.window.showErrorMessage(await getAzureAccessError({ selectedAccount, defaultErrorMessage: localize('azure.accounts.unexpectedResourceGroupsError', "Unexpected error fetching resource groups for subscription {0}: {1}", getSubscriptionDisplayString(selectedSubscription), getErrorMessage(error)), error }));
	}
}

/**
 * An Azure Locations field consists of a dropdown field for azure locations
 * @param context The context to use to create the field
 */
async function processAzureLocationsField(context: AzureLocationsFieldContext): Promise<azdata.DropDownComponent> {
	const label = createLabel(context.view, {
		text: context.fieldInfo.label || loc.location,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});
	const azurecoreApi = await apiService.getAzurecoreApi();
	const locationValues = context.fieldInfo.locations?.map(l => { return { name: l, displayName: azurecoreApi.getRegionDisplayName(l) }; });
	const locationDropdown = createDropdown(context.view, {
		defaultValue: locationValues?.find(l => l.name === context.fieldInfo.defaultValue),
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.location,
		values: locationValues
	});
	locationDropdown.fireOnTextChange = true;
	context.fieldInfo.subFields = context.fieldInfo.subFields || [];
	if (context.fieldInfo.locationVariableName) {
		context.fieldInfo.subFields!.push({
			label: label.value!,
			variableName: context.fieldInfo.locationVariableName
		});
		context.onNewInputComponentCreated(context.fieldInfo.locationVariableName, { component: locationDropdown });
	}
	if (context.fieldInfo.displayLocationVariableName) {
		context.fieldInfo.subFields!.push({
			label: label.value!,
			variableName: context.fieldInfo.displayLocationVariableName
		});
		context.onNewInputComponentCreated(context.fieldInfo.displayLocationVariableName, { component: locationDropdown, inputValueTransformer: (value => azurecoreApi.getRegionDisplayName(value)) });
	}
	addLabelInputPairToContainer(context.view, context.components, label, locationDropdown, context.fieldInfo);
	return locationDropdown;
}

export function isValidSQLPassword(password: string, userName: string = 'sa'): boolean {
	// Validate SQL Server password
	const containsUserName = password && userName !== undefined && password.toUpperCase().includes(userName.toUpperCase());
	// Instead of using one RegEx, I am separating it to make it more readable.
	const hasUpperCase = /[A-Z]/.test(password) ? 1 : 0;
	const hasLowerCase = /[a-z]/.test(password) ? 1 : 0;
	const hasNumbers = /\d/.test(password) ? 1 : 0;
	const hasNonAlphas = /\W/.test(password) ? 1 : 0;
	return !containsUserName && password.length >= 8 && password.length <= 128 && (hasUpperCase + hasLowerCase + hasNumbers + hasNonAlphas >= 3);
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

export function setModelValues(inputComponents: InputComponents, model: Model): void {
	Object.keys(inputComponents).forEach(key => {
		const value = getInputComponentValue(inputComponents, key);
		model.setPropertyValue(key, value);
	});
}

function getInputComponentValue(inputComponents: InputComponents, key: string): string | undefined {
	const input = inputComponents[key].component;
	if (input === undefined) {
		return undefined;
	}
	let value;
	if (input instanceof RadioGroupLoadingComponentBuilder) {
		value = input.value;
	} else if ('checked' in input) { // CheckBoxComponent
		value = input.checked ? 'true' : 'false';
	} else if ('value' in input) { // InputBoxComponent or DropDownComponent
		const inputValue = input.value;
		if (typeof inputValue === 'string' || typeof inputValue === 'undefined') {
			value = inputValue;
		} else {
			value = inputValue.name;
		}
	} else {
		throw new Error(`Unknown input type with ID ${input.id}`);
	}
	const inputValueTransformer = inputComponents[key].inputValueTransformer;
	if (inputValueTransformer) {
		value = inputValueTransformer(value || '');
	}
	return value;
}

export function isInputBoxEmpty(input: azdata.InputBoxComponent): boolean {
	return input.value === undefined || input.value === '';
}

