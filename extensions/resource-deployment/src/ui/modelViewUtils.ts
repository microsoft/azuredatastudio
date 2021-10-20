/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { azureResource } from 'azureResource';
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { InputValueType, IOptionsSourceProvider } from 'resource-deployment';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getDateTimeString, getErrorMessage, isUserCancelledError, throwUnless } from '../common/utils';
import { AzureAccountFieldInfo, AzureLocationsFieldInfo, ComponentCSSStyles, DialogInfoBase, FieldInfo, FieldType, FilePickerFieldInfo, InitialVariableValues, instanceOfDynamicEnablementInfo, instanceOfDynamicOptionsInfo, IOptionsSource, KubeClusterContextFieldInfo, LabelPosition, NoteBookEnvironmentVariablePrefix, OptionsInfo, OptionsType, PageInfoBase, RowInfo, SectionInfo, TextCSSStyles } from '../interfaces';
import * as loc from '../localizedConstants';
import { apiService } from '../services/apiService';
import { valueProviderService } from '../services/valueProviderService';
import { getDefaultKubeConfigPath, getKubeConfigClusterContexts } from '../services/kubeService';
import { optionsSourcesService } from '../services/optionSourcesService';
import { KubeCtlTool, KubeCtlToolName } from '../services/tools/kubeCtlTool';
import { IToolsService } from '../services/toolsService';
import { WizardInfoBase } from './../interfaces';
import { Model } from './model';
import { RadioGroupLoadingComponentBuilder } from './radioGroupLoadingComponentBuilder';
import { createValidation, validateInputBoxComponent, Validation } from './validation/validations';

const localize = nls.loadMessageBundle();

/*
* A quick note on the naming convention for some functions in this module.
* 'Field' suffix is used for functions that create a label+input component pair and the one without this suffix just creates one of these items.
*
*/

export type Validator = () => { valid: boolean, message: string };
export type InputComponent = azdata.TextComponent | azdata.InputBoxComponent | azdata.DropDownComponent | azdata.CheckBoxComponent | RadioGroupLoadingComponentBuilder;
export type InputComponentInfo<T extends InputComponent> = {
	component: T;
	labelComponent?: azdata.TextComponent;
	getValue: () => Promise<InputValueType>;
	setValue: (value: InputValueType) => void;
	getDisplayValue?: () => Promise<string>;
	setOptions?: (options: OptionsInfo) => void;
	onValueChanged: vscode.Event<void>;
	isPassword?: boolean
};

export type InputComponents = {
	[s: string]: InputComponentInfo<InputComponent>
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
	fieldValidations?: Validation[]
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
	toolsService: IToolsService,
	inputComponents: InputComponents;
	initialVariableValues?: InitialVariableValues;
	onNewValidatorCreated: (validator: Validator) => void;
	onNewDisposableCreated: (disposable: vscode.Disposable) => void;
	onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo<InputComponent>) => void;
}

/**
 * An object to define the properties of an InputBox
 */
interface InputBoxInfo {
	/**
	 * the type of inputBox, default value is 'text'
	 */
	type?: azdata.InputBoxInputType;
	defaultValue?: string;
	ariaLabel: string;
	required?: boolean;
	/**
	 * the min value of this field when the type is 'number', value set is ignored if the type is not 'number'
	 */
	min?: number;
	/**
	 * the min value of this field when the type is 'number', value set is ignored if the type is not 'number'
	 */
	max?: number;
	/**
	 * an informational string to display in the inputBox when no value has been set.
	 */
	placeHolder?: string;
	width?: string;
	enabled?: boolean;
	/**
	 * an array of validation objects used to validate the inputBox
	 */
	validations?: Validation[];
}

type AzureComponent = azdata.InputBoxComponent | azdata.DropDownComponent;

/**
 * Creates an inputBox using the properties defined in context.fieldInfo object
 *
 * @param context - the fieldContext object for this field
 * @param inputBoxType - the type of inputBox
 */
function createInputBoxField({ context, inputBoxType = 'text' }: { context: FieldContext; inputBoxType?: azdata.InputBoxInputType; }) {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const defaultValue = context.initialVariableValues?.[context.fieldInfo.variableName || '']?.toString() || context.fieldInfo.defaultValue;
	const input = createInputBoxInputInfo(context.view, {
		type: inputBoxType,
		defaultValue: defaultValue,
		ariaLabel: context.fieldInfo.label,
		required: context.fieldInfo.required,
		min: context.fieldInfo.min,
		max: context.fieldInfo.max,
		placeHolder: context.fieldInfo.placeHolder,
		width: context.fieldInfo.inputWidth,
		enabled: instanceOfDynamicEnablementInfo(context.fieldInfo.enabled) ? false : context.fieldInfo.enabled, // Dynamic enablement is initially set to false
		validations: context.fieldValidations
	});
	input.labelComponent = label;
	addLabelInputPairToContainer(context.view, context.components, label, input.component, context.fieldInfo);
	return input;
}

export function createInputBoxInputInfo(view: azdata.ModelView, inputInfo: InputBoxInfo): InputComponentInfo<azdata.InputBoxComponent> {
	const component = view.modelBuilder.inputBox().withProps({
		value: inputInfo.defaultValue,
		ariaLabel: inputInfo.ariaLabel,
		inputType: inputInfo.type || 'text',
		required: inputInfo.required,
		min: inputInfo.min,
		max: inputInfo.max,
		placeHolder: inputInfo.placeHolder,
		width: inputInfo.width,
		enabled: inputInfo.enabled
	}).withValidation(async (component) => await validateInputBoxComponent(component, inputInfo.validations)).component();
	return {
		component: component,
		getValue: async (): Promise<InputValueType> => component.value,
		setValue: (value: InputValueType) => component.value = value?.toString(),
		onValueChanged: component.onTextChanged
	};
}

export function createLabel(view: azdata.ModelView, info: { text: string, description?: string, required?: boolean, width?: string, links?: azdata.LinkArea[], cssStyles?: TextCSSStyles }): azdata.TextComponent {
	let cssStyles: { [key: string]: string } = {};
	if (info.cssStyles !== undefined) {
		cssStyles = Object.assign(cssStyles, info.cssStyles, { 'font-style': info.cssStyles.fontStyle || 'normal', 'font-weight': info.cssStyles.fontWeight || 'normal' });
		if (info.cssStyles.color !== undefined) {
			cssStyles['color'] = info.cssStyles.color;
		}
	}

	const text = view.modelBuilder.text().withProps({
		value: info.text,
		description: info.description,
		requiredIndicator: info.required,
		CSSStyles: cssStyles,
		links: info.links
	}).component();
	text.width = info.width;
	return text;
}

/**
 * Creates an inputBox component of 'number' type.
 *
 * @param view - the ModelView object used to create the inputBox
 * @param info - an object to define the properties of the 'number' inputBox component. If the type property is set then it is overridden with 'number' type.
 */
export function createNumberInputBoxInputInfo(view: azdata.ModelView, info: InputBoxInfo): InputComponentInfo<azdata.InputBoxComponent> {
	info.type = 'number'; // for the type to be 'number'
	return createInputBoxInputInfo(view, info);
}

export function createCheckboxInputInfo(view: azdata.ModelView, info: { initialValue: boolean, label: string, required?: boolean }): InputComponentInfo<azdata.CheckBoxComponent> {
	const checkbox = createCheckbox(view, info);
	return {
		component: checkbox,
		getValue: async () => checkbox.checked ? 'true' : 'false',
		setValue: (value: InputValueType) => checkbox.checked = value?.toString().toLowerCase() === 'true' ? true : false,
		onValueChanged: checkbox.onChanged
	};
}
export function createCheckbox(view: azdata.ModelView, info: { initialValue: boolean, label: string, required?: boolean }): azdata.CheckBoxComponent {
	return view.modelBuilder.checkBox().withProps({
		checked: info.initialValue,
		required: info.required,
		label: info.label
	}).component();
}

export function createDropdownInputInfo(view: azdata.ModelView, info: { defaultValue?: string | azdata.CategoryValue, values?: string[] | azdata.CategoryValue[], width?: string, editable?: boolean, required?: boolean, label: string }): InputComponentInfo<azdata.DropDownComponent> {
	const dropdown = view.modelBuilder.dropDown().withProps({
		values: info.values,
		value: info.defaultValue,
		width: info.width,
		editable: info.editable,
		fireOnTextChange: true,
		required: info.required,
		ariaLabel: info.label
	}).component();

	return {
		component: dropdown,
		getValue: async (): Promise<InputValueType> => typeof dropdown.value === 'string' ? dropdown.value : dropdown.value?.name,
		setValue: (value: InputValueType) => setDropdownValue(dropdown, value?.toString()),
		getDisplayValue: async (): Promise<string> => (typeof dropdown.value === 'string' ? dropdown.value : dropdown.value?.displayName) || '',
		onValueChanged: dropdown.onValueChanged,
	};
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
					inputComponents: dialogContext.inputComponents,
					toolsService: dialogContext.toolsService
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
				toolsService: context.toolsService,
				inputComponents: context.inputComponents,
				initialVariableValues: context.initialVariableValues,
				onNewDisposableCreated: context.onNewDisposableCreated,
				onNewInputComponentCreated: context.onNewInputComponentCreated,
				onNewValidatorCreated: context.onNewValidatorCreated,
				sectionInfo: sectionInfo
			});
		}));
		await hookUpDynamicEnablement(context);
		await hookUpDynamicOptions(context);
		await hookUpValueProviders(context);
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

/**
 * Hooks up the dynamic enablement for fields which use that. This will attach a listener to the target component
 * for when the value changes and update the enabled state of the source component based on the current value
 * of the target component.
 *
 * Note that currently this is only supported for Notebook Wizard Pages and only supports direct equals comparison
 * for the value currently selected.
 *
 * Additionally this only supports hooking up components that are on the same page.
 * @param context The page context
 */
async function hookUpDynamicEnablement(context: WizardPageContext): Promise<void> {
	await Promise.all(context.pageInfo.sections.map(async section => {
		if (!section.fields) {
			return;
		}
		await Promise.all(section.fields.map(async field => {
			if (instanceOfDynamicEnablementInfo(field.enabled)) {
				const fieldKey = field.variableName || field.label;
				const fieldComponent = context.inputComponents[fieldKey];
				const targetComponent = context.inputComponents[field.enabled.target];
				const targetValue = field.enabled.value;
				if (!targetComponent) {
					console.error(`Could not find target component ${field.enabled.target} when hooking up dynamic enablement for ${field.label}`);
					return;
				}
				const updateFields = async () => {
					const targetComponentValue = await targetComponent.getValue();
					const valuesMatch = targetComponentValue === targetValue;
					fieldComponent.component.enabled = valuesMatch;
					const isRequired = fieldComponent.component.enabled === false ? false : field.required;
					if (fieldComponent.labelComponent) {
						fieldComponent.labelComponent.requiredIndicator = isRequired;
					}
					// We also need to update the required flag so that when the component is disabled it won't block the page from proceeding
					if ('required' in fieldComponent.component) {
						fieldComponent.component.required = isRequired;
					}
					// When we disable the field then remove the placeholder if it exists so it's clear this field isn't needed
					// We only do this for dynamic enablement since if a field is disabled through the JSON directly then it can't
					// be modified anyways and so just should not use a placeholder value if they don't want one
					if ('placeHolder' in fieldComponent.component) {
						fieldComponent.component.placeHolder = valuesMatch ? field.placeHolder : '';
					}
				};
				targetComponent.onValueChanged(() => {
					updateFields();
				});
				await updateFields();
			}
		}));
	}));
}

/**
 * Hooks up the dynamic options for fields which use that. This will attach a listener to the target component
 * for when the value changes and update the options of the source component based on the current value
 * of the target component.
 *
 * Note that currently this is only supported for Notebook Wizard Pages and only supports direct equals comparison
 * for the value currently selected.
 *
 * Additionally this only supports hooking up components that are on the same page.
 * @param context The page context
 */
async function hookUpDynamicOptions(context: WizardPageContext): Promise<void> {
	await Promise.all(context.pageInfo.sections.map(async section => {
		if (!section.fields) {
			return;
		}
		await Promise.all(section.fields.map(async field => {
			if (instanceOfDynamicOptionsInfo(field.dynamicOptions)) {
				const fieldKey = field.variableName || field.label;
				const fieldComponent = context.inputComponents[fieldKey];
				const targetComponent = context.inputComponents[field.dynamicOptions.target];
				if (!targetComponent) {
					console.error(`Could not find target component ${field.dynamicOptions.target} when hooking up dynamic options for ${field.label}`);
					return;
				}
				const updateOptions = async () => {
					const currentValue = await targetComponent.getValue();
					if (field.dynamicOptions && field.options && fieldComponent && fieldComponent.setOptions) {
						const targetValueFound = field.dynamicOptions.alternates.find(item => item.selection === currentValue);
						if (targetValueFound) {
							fieldComponent.setOptions(<OptionsInfo>{
								values: targetValueFound.alternateValues,
								defaultValue: targetValueFound.defaultValue
							});
						} else {
							fieldComponent.setOptions(<OptionsInfo>{
								values: field.options.values,
								defaultValue: (<OptionsInfo>field.options).defaultValue
							});
						}
					}
				};
				targetComponent.onValueChanged(() => {
					updateOptions();
				});
				await updateOptions();
			}
		}));
	}));
}


async function hookUpValueProviders(context: WizardPageContext): Promise<void> {
	await Promise.all(context.pageInfo.sections.map(async section => {
		if (!section.fields) {
			return;
		}
		await Promise.all(section.fields.map(async field => {
			if (field.valueProvider) {
				const fieldKey = field.variableName || field.label;
				const fieldComponent = context.inputComponents[fieldKey];
				const provider = await valueProviderService.getValueProvider(field.valueProvider.providerId);

				let targetComponentLabelToComponent: { [label: string]: InputComponentInfo<InputComponent>; } = {};
				let targetComponentLabelToValue: { [label: string]: InputValueType; } = {};

				field.valueProvider.triggerFields.forEach(async (triggerField) => {
					const targetComponent = context.inputComponents[triggerField];
					if (!targetComponent) {
						console.error(`Could not find target component ${triggerField} when hooking up value providers for ${field.label}`);
						return;
					}
					targetComponentLabelToComponent[triggerField] = targetComponent;
				});

				// If one triggerfield changes value, update the new field value.
				const updateFields = async () => {
					for (let label in targetComponentLabelToComponent) {
						targetComponentLabelToValue[label] = await targetComponentLabelToComponent[label].getValue();
					}
					let newFieldValue = await provider.getValue(targetComponentLabelToValue ?? {});
					fieldComponent.setValue(newFieldValue);
				};

				// Set the onValueChanged behavior for each component
				for (let label in targetComponentLabelToComponent) {
					targetComponentLabelToComponent[label].onValueChanged(() => {
						updateFields();
					});
				}
				await updateFields();
			}
		}));
	}));
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
			initialVariableValues: context.initialVariableValues,
			components: components,
			toolsService: context.toolsService
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
	return view.modelBuilder.flexContainer().withItems(items, itemsStyle).withLayout(flexLayout).withProps({ CSSStyles: cssStyles || {} }).component();
}

export function createGroupContainer(view: azdata.ModelView, items: azdata.Component[], layout: azdata.GroupLayout): azdata.GroupContainer {
	return view.modelBuilder.groupContainer().withItems(items).withLayout(layout).component();
}

function addLabelInputPairToContainer(view: azdata.ModelView, components: azdata.Component[], label: azdata.Component, input: azdata.Component | undefined, fieldInfo: FieldInfo, additionalComponents?: azdata.Component[]): void {
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
	//populate the fieldValidations objects for each field based on the information from the fieldInfo
	context.fieldValidations = context.fieldInfo.validations?.map((validation => createValidation(
		validation,
		() => context.inputComponents[context.fieldInfo.variableName || context.fieldInfo.label].getValue(),  // callback to fetch the value of this field, and return the default value if the field value is undefined
		(variable: string) => context.inputComponents[variable].getValue(),  // callback to fetch the value of a variable corresponding to any field already defined.
		(targetVariable: string) => (<azdata.InputBoxComponent>context.inputComponents[targetVariable].component).onValidityChanged,
		(disposable: vscode.Disposable) => context.onNewDisposableCreated(disposable)
	)));
	switch (context.fieldInfo.type) {
		case FieldType.Options:
			await processOptionsTypeField(context);
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
		case FieldType.KubeStorageClass:
			await processKubeStorageClassField(context);
			break;
		default:
			throw new Error(loc.unknownFieldTypeError(context.fieldInfo.type));
	}
}

function disableControlButtons(container: azdata.window.Dialog | azdata.window.Wizard): void {
	if ('okButton' in container) {
		container.okButton.enabled = false;
	} else {
		container.generateScriptButton.enabled = false;
		container.doneButton.enabled = false;
		container.nextButton.enabled = false;
		container.backButton.enabled = false;
		container.customButtons.forEach(b => b.enabled = false);
	}
}

async function processOptionsTypeField(context: FieldContext): Promise<void> {
	throwUnless(context.fieldInfo.options !== undefined, loc.optionsNotDefined(context.fieldInfo.type));
	if (Array.isArray(context.fieldInfo.options)) {
		context.fieldInfo.options = <OptionsInfo>{
			values: context.fieldInfo.options,
			defaultValue: context.fieldInfo.defaultValue,
			optionsType: OptionsType.Dropdown
		};
	}
	throwUnless(typeof context.fieldInfo.options === 'object', loc.optionsNotObjectOrArray);
	throwUnless('optionsType' in context.fieldInfo.options, loc.optionsTypeNotFound);
	if (context.fieldInfo.options.source?.providerId) {
		try {
			context.fieldInfo.options.source.provider = await optionsSourcesService.getOptionsSource(context.fieldInfo.options.source.providerId);
		}
		catch (e) {
			disableControlButtons(context.container);
			context.container.message = {
				text: getErrorMessage(e),
				description: '',
				level: azdata.window.MessageLevel.Error
			};
			throw e;
		}
		context.fieldInfo.subFields = context.fieldInfo.subFields || [];
	}
	let optionsComponent: RadioGroupLoadingComponentBuilder | azdata.DropDownComponent;
	const options = context.fieldInfo.options;
	const optionsSource = options.source;
	if (context.fieldInfo.options.optionsType === OptionsType.Radio) {
		let getRadioOptions: (() => Promise<OptionsInfo>) | undefined = undefined;
		// If the options are provided for us then set up the callback to load those options async'ly
		if (optionsSource?.provider) {
			getRadioOptions = async () => {
				try {
					return { defaultValue: options.defaultValue, values: await optionsSource.provider!.getOptions() };
				} catch (err) {
					context.container.message = {
						text: getErrorMessage(err),
						description: '',
						level: azdata.window.MessageLevel.Error
					};
					return { defaultValue: '', values: [] };
				}
			};
		}
		optionsComponent = await processRadioOptionsTypeField(context, getRadioOptions);
	} else {
		throwUnless(context.fieldInfo.options.optionsType === OptionsType.Dropdown, loc.optionsTypeRadioOrDropdown);
		if (optionsSource?.provider) {
			try {
				context.fieldInfo.options.values = await optionsSource.provider.getOptions();
			} catch (err) {
				context.container.message = {
					text: getErrorMessage(err),
					description: '',
					level: azdata.window.MessageLevel.Error
				};
			}
		}
		optionsComponent = processDropdownOptionsTypeField(context);
	}

	if (optionsSource?.provider) {
		const optionsSourceProvider = optionsSource.provider;
		await Promise.all(Object.keys(optionsSource?.variableNames ?? {}).map(async key => {
			await configureOptionsSourceSubfields(context, optionsSource, key, optionsComponent, optionsSourceProvider);
		}));
	}
}

async function configureOptionsSourceSubfields(context: FieldContext, optionsSource: IOptionsSource, variableKey: string, optionsComponent: RadioGroupLoadingComponentBuilder | azdata.DropDownComponent, optionsSourceProvider: IOptionsSourceProvider): Promise<void> {
	context.fieldInfo.subFields!.push({
		label: context.fieldInfo.label,
		variableName: optionsSource.variableNames![variableKey]
	});
	context.onNewInputComponentCreated(optionsSource.variableNames![variableKey], {
		component: optionsComponent,
		isPassword: await optionsSourceProvider.getIsPassword!(variableKey),
		getValue: async (): Promise<InputValueType> => {
			const value = (typeof optionsComponent.value === 'string' ? optionsComponent.value : optionsComponent.value?.name) || '';
			try {
				return await optionsSourceProvider.getVariableValue!(variableKey, value);
			} catch (e) {
				if (!isUserCancelledError(e)) {
					// User cancelled is a normal scenario so we shouldn't disable anything in that case
					// so that the user can retry if they want to
					disableControlButtons(context.container);
					context.container.message = {
						text: getErrorMessage(e),
						description: '',
						level: azdata.window.MessageLevel.Error
					};
				}
				throw e;
			}
		},
		setValue: (_value: InputValueType) => { throw new Error('Setting value of radio group isn\'t currently supported'); },
		onValueChanged: optionsComponent.onValueChanged
	});
}

function processDropdownOptionsTypeField(context: FieldContext): azdata.DropDownComponent {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const options = context.fieldInfo.options as OptionsInfo;
	// If we have an initial value then set it now - otherwise just default to the original default value.
	// Note we don't currently check that the value actually exists in the list - if it doesn't then it'll
	// just default to the first one anyways
	const initialValue = context.fieldInfo.variableName && context.initialVariableValues?.[context.fieldInfo.variableName]?.toString();
	const defaultValue = initialValue || options.defaultValue;
	const dropdown = createDropdownInputInfo(context.view, {
		values: options.values,
		defaultValue: defaultValue,
		width: context.fieldInfo.inputWidth,
		editable: context.fieldInfo.editable,
		required: context.fieldInfo.required,
		label: context.fieldInfo.label
	});
	dropdown.labelComponent = label;
	dropdown.component.fireOnTextChange = true;
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, dropdown);
	addLabelInputPairToContainer(context.view, context.components, label, dropdown.component, context.fieldInfo);
	return dropdown.component;
}

function processDateTimeTextField(context: FieldContext): void {
	context.fieldInfo.defaultValue = context.fieldInfo.defaultValue + getDateTimeString();
	const input = createInputBoxField({ context });
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, input);
}

function processNumberField(context: FieldContext): void {
	const input = createInputBoxField({ context, inputBoxType: 'number' });
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, {
		component: input.component,
		getValue: async (): Promise<InputValueType> => {
			const value = await input.getValue();
			return typeof value === 'string' && value.length > 0 ? parseFloat(value) : value;
		},
		setValue: (value: InputValueType) => input.component.value = value?.toString(),
		onValueChanged: input.onValueChanged
	});
}

function processTextField(context: FieldContext): InputComponentInfo<azdata.InputBoxComponent> {
	const isPasswordField = context.fieldInfo.type === FieldType.Password || context.fieldInfo.type === FieldType.SQLPassword;
	const inputBoxType = isPasswordField ? 'password' : 'text';
	const input = createInputBoxField({ context, inputBoxType });
	input.isPassword = isPasswordField;
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, input);
	return input;
}

function processPasswordField(context: FieldContext): void {
	const passwordInput = processTextField(context);

	if (context.fieldInfo.type === FieldType.SQLPassword) {
		const invalidPasswordMessage = getInvalidSQLPasswordMessage(context.fieldInfo.label);
		context.onNewDisposableCreated(passwordInput.component.onTextChanged(() => {
			if (context.fieldInfo.type === FieldType.SQLPassword && isValidSQLPassword(passwordInput.component.value!, context.fieldInfo.userName)) {
				removeValidationMessage(context.container, invalidPasswordMessage);
			}
		}));

		context.onNewValidatorCreated((): { valid: boolean, message: string } => {
			return { valid: isValidSQLPassword(passwordInput.component.value!, context.fieldInfo.userName), message: invalidPasswordMessage };
		});
	}

	if (context.fieldInfo.confirmationRequired) {
		const passwordNotMatchMessage = getPasswordMismatchMessage(context.fieldInfo.label);
		const confirmPasswordLabel = createLabel(context.view, { text: context.fieldInfo.confirmationLabel!, required: true, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
		const confirmPasswordInput = context.view.modelBuilder.inputBox().withProps({
			ariaLabel: context.fieldInfo.confirmationLabel,
			inputType: 'password',
			required: true,
			width: context.fieldInfo.inputWidth
		}).component();

		addLabelInputPairToContainer(context.view, context.components, confirmPasswordLabel, confirmPasswordInput, context.fieldInfo);
		context.onNewValidatorCreated((): { valid: boolean, message: string } => {
			const passwordMatches = passwordInput.component.value === confirmPasswordInput.value;
			return { valid: passwordMatches, message: passwordNotMatchMessage };
		});

		const updatePasswordMismatchMessage = () => {
			if (passwordInput.component.value === confirmPasswordInput.value) {
				removeValidationMessage(context.container, passwordNotMatchMessage);
			}
		};

		context.onNewDisposableCreated(passwordInput.component.onTextChanged(() => {
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
	if (text) {
		// If we created the text component then add it to our list of inputs so other fields can utilize it
		const onChangedEmitter = new vscode.EventEmitter<void>(); // Stub event since we don't currently support updating this when the dependent fields change
		context.onNewDisposableCreated(onChangedEmitter);
		context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, {
			component: text,
			getValue: async (): Promise<InputValueType> => typeof text.value === 'string' ? text.value : text.value?.join(EOL),
			setValue: (value: InputValueType) => text.value = value?.toString(),
			onValueChanged: onChangedEmitter.event,
		});
	}

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
	const onChangedEmitter = new vscode.EventEmitter<void>(); // Stub event since we don't currently support updating this when the dependent fields change
	context.onNewDisposableCreated(onChangedEmitter);
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, {
		component: readOnlyField.text!,
		getValue: async (): Promise<InputValueType> => {
			readOnlyField.text!.value = await substituteVariableValues(context.inputComponents, context.fieldInfo.defaultValue);
			return readOnlyField.text!.value;
		},
		setValue: (value: InputValueType) => readOnlyField.text!.value = value?.toString(),
		onValueChanged: onChangedEmitter.event,
	});
	return readOnlyField;
}

/**
 * Returns a string that interpolates all variable names in the {@param inputValue} string de-marked as $(VariableName)
 * substituted with their corresponding values. Will use the display value of the target input values if possible.
 *
 * Only variables in the current model starting with {@see NoteBookEnvironmentVariablePrefix} are replaced.
 *
 * @param inputValue
 * @param inputComponents
 */
async function substituteVariableValues(inputComponents: InputComponents, inputValue?: string): Promise<string | undefined> {
	await Promise.all(Object.keys(inputComponents)
		.filter(key => key.startsWith(NoteBookEnvironmentVariablePrefix))
		.map(async key => {
			const value = (await (inputComponents[key].getDisplayValue ? inputComponents[key].getDisplayValue!() : inputComponents[key].getValue())) ?? '<undefined>';
			const re: RegExp = new RegExp(`\\\$\\\(${key}\\\)`, 'gi');
			inputValue = inputValue?.replace(re, value.toString());
		})
	);
	return inputValue;
}
/**
 * Renders a label on the left and a checkbox with an empty string label on the right, for use under page sections.
 * @param context The context to use to create the field
 */
function processCheckboxField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const checkbox = createCheckboxInputInfo(context.view, { initialValue: context.fieldInfo.defaultValue! === 'true', label: '', required: context.fieldInfo.required });
	checkbox.labelComponent = label;
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, checkbox);
	addLabelInputPairToContainer(context.view, context.components, label, checkbox.component, context.fieldInfo);
}

/**
 * A File Picker field consists of a text field and a browse button that allows a user to pick a file system file.
 * @param context The context to use to create the field
 */
function processFilePickerField(context: FieldContext): FilePickerInputs {
	const inputWidth = parseInt(context.fieldInfo.inputWidth!.replace(/px/g, '').trim());
	const buttonWidth = 100;

	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const input = createInputBoxInputInfo(context.view, {
		defaultValue: context.fieldInfo.defaultValue || '',
		ariaLabel: context.fieldInfo.label,
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: `${inputWidth - buttonWidth}px`,
		enabled: typeof context.fieldInfo.enabled === 'boolean' ? context.fieldInfo.enabled : false,
		validations: context.fieldValidations
	});
	input.labelComponent = label;
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, input);
	input.component.enabled = false;
	const browseFileButton = context.view!.modelBuilder.button().withProps({
		label: loc.browse,
		width: buttonWidth,
		secondary: true
	}).component();
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
			defaultUri: input.component.value ? vscode.Uri.file(path.dirname(input.component.value)) : undefined,
			openLabel: loc.select,
			filters: filter
		});
		if (!fileUris || fileUris.length === 0) {
			return;
		}
		let fileUri = fileUris[0];
		input.component.value = fileUri.fsPath;
	}));
	const component = createFlexContainer(context.view, [input.component, browseFileButton], true, context.fieldInfo.inputWidth);
	addLabelInputPairToContainer(context.view, context.components, label, component, context.fieldInfo);
	return { input: input.component, browseButton: browseFileButton };
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
		},
		toolsService: context.toolsService
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

async function processRadioOptionsTypeField(context: FieldContext, getRadioButtonInfo?: () => Promise<OptionsInfo>): Promise<RadioGroupLoadingComponentBuilder> {
	return await createRadioOptions(context, getRadioButtonInfo);
}


async function createRadioOptions(context: FieldContext, getRadioButtonInfo?: (() => Promise<OptionsInfo>))
	: Promise<RadioGroupLoadingComponentBuilder> {
	if (context.fieldInfo.fieldAlignItems === undefined) {
		context.fieldInfo.fieldAlignItems = 'flex-start'; // by default align the items to the top.
	}
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, cssStyles: context.fieldInfo.labelCSSStyles });
	const radioGroupLoadingComponentBuilder = new RadioGroupLoadingComponentBuilder(context.view, context.onNewDisposableCreated, context.fieldInfo);

	context.fieldInfo.labelPosition = LabelPosition.Left;
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, {
		component: radioGroupLoadingComponentBuilder,
		labelComponent: label,
		getValue: async (): Promise<InputValueType> => radioGroupLoadingComponentBuilder.value,
		setValue: (_value: InputValueType) => { throw new Error('Setting value of radio group isn\'t currently supported'); },
		setOptions: (optionsInfo: OptionsInfo) => { radioGroupLoadingComponentBuilder.loadOptions(optionsInfo); },
		getDisplayValue: async (): Promise<string> => radioGroupLoadingComponentBuilder.displayValue,
		onValueChanged: radioGroupLoadingComponentBuilder.onValueChanged,
	});
	const options = context.fieldInfo.options as OptionsInfo;
	let loadingText = options?.source?.loadingText;
	let loadingCompletedText = options?.source?.loadingCompletedText;
	if (loadingText || loadingCompletedText) {
		radioGroupLoadingComponentBuilder.withProps({
			showText: true,
			loadingText: loadingText,
			loadingCompletedText: loadingCompletedText
		});
	}
	addLabelInputPairToContainer(context.view, context.components, label, radioGroupLoadingComponentBuilder.component(), context.fieldInfo);
	// Start loading the options but continue on so that we can continue setting up the rest of the components - the group
	// will show a loading spinner while the options are loaded
	radioGroupLoadingComponentBuilder.loadOptions(
		getRadioButtonInfo || options).catch(e => console.log('Error loading options for radio group ', e));
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
	let accountComponents: AzureAccountComponents | undefined;
	let accountDropdown: azdata.DropDownComponent | undefined;

	// Check if we have an initial subscription value - if we do then the user isn't going to be allowed to change any of the
	// Azure values so we can skip adding the account picker
	const hasInitialSubscriptionValue = !!context.initialVariableValues?.[context.fieldInfo.subscriptionVariableName || '']?.toString();
	if (!hasInitialSubscriptionValue) {
		accountComponents = createAzureAccountDropdown(context);
		accountDropdown = accountComponents.accountDropdown;
	}

	const subscriptionComponent = createAzureSubscriptionComponent(context, subscriptionValueToSubscriptionMap);
	const resourceGroupComponent = createAzureResourceGroupsComponent(context, accountDropdown, accountValueToAccountMap, subscriptionComponent, subscriptionValueToSubscriptionMap);
	if (context.fieldInfo.allowNewResourceGroup) {
		const newRGCheckbox = createCheckboxInputInfo(context.view, { initialValue: false, label: loc.createNewResourceGroup });
		context.onNewInputComponentCreated(context.fieldInfo.newResourceGroupFlagVariableName!, newRGCheckbox);
		const newRGNameInput = createInputBoxInputInfo(context.view, { ariaLabel: loc.NewResourceGroupAriaLabel });
		context.onNewInputComponentCreated(context.fieldInfo.newResourceGroupNameVariableName!, newRGNameInput);
		context.components.push(newRGCheckbox.component);
		context.components.push(newRGNameInput.component);
		const setRGStatus = (newRG: boolean) => {
			resourceGroupComponent.required = !newRG;
			resourceGroupComponent.enabled = !newRG;
			newRGNameInput.component.required = newRG;
			newRGNameInput.component.enabled = newRG;
			if (!newRG) {
				newRGNameInput.component.value = '';
			}
		};
		context.onNewDisposableCreated(newRGCheckbox.onValueChanged(() => {
			setRGStatus(newRGCheckbox.component.checked!);
		}));
		setRGStatus(false);
	}

	const locationComponent = context.fieldInfo.locations && await processAzureLocationsField(context);
	if (!hasInitialSubscriptionValue) {
		accountDropdown!.onValueChanged(async selectedItem => {
			const selectedAccount = accountValueToAccountMap.get(selectedItem.selected)!;
			await handleSelectedAccountChanged(context, selectedAccount, subscriptionComponent, subscriptionValueToSubscriptionMap, resourceGroupComponent, locationComponent);
		});

		const populateAzureAccounts = async () => {
			accountValueToAccountMap.clear();
			try {
				const accounts = await azdata.accounts.getAllAccounts();
				// Append a blank value for the "default" option if the field isn't required, context will clear all the dropdowns when selected
				const dropdownValues = context.fieldInfo.required ? [] : [''];
				accountDropdown!.values = dropdownValues.concat(accounts.map(account => {
					const displayName = getAccountDisplayString(account);
					accountValueToAccountMap.set(displayName, account);
					return displayName;
				}));
				const selectedAccount = accountDropdown!.value ? accountValueToAccountMap.get(accountDropdown!.value.toString()) : undefined;
				await handleSelectedAccountChanged(context, selectedAccount, subscriptionComponent, subscriptionValueToSubscriptionMap, resourceGroupComponent, locationComponent);
			} catch (error) {
				vscode.window.showErrorMessage(localize('azure.accounts.unexpectedAccountsError', 'Unexpected error fetching accounts: {0}', getErrorMessage(error)));
			}
		};

		context.onNewDisposableCreated(accountComponents!.refreshAccountsButton.onDidClick(async () => {
			await populateAzureAccounts();
		}));
		context.onNewDisposableCreated(accountComponents!.signInButton.onDidClick(async () => {
			await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
			await populateAzureAccounts();
		}));

		// populate the values in a different batch as the initialization to avoid the issue that the account list is empty even though the values are correctly.
		setTimeout(async () => {
			await populateAzureAccounts();
		}, 0);
	}
}

async function processKubeStorageClassField(context: FieldContext): Promise<void> {
	const label = createLabel(context.view, {
		text: context.fieldInfo.label,
		description: context.fieldInfo.description,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});

	// Try to query for the available storage classes - but if this fails the dropdown is editable
	// so users can still enter their own
	let storageClasses: string[] = [];
	let defaultStorageClass = '';
	try {
		const kubeCtlTool = context.toolsService.getToolByName(KubeCtlToolName) as KubeCtlTool;
		const response = await kubeCtlTool.getStorageClasses();
		storageClasses = response.storageClasses;
		defaultStorageClass = response.defaultStorageClass;
	} catch (err) {
		vscode.window.showErrorMessage(localize('resourceDeployment.errorFetchingStorageClasses', "Unexpected error fetching available kubectl storage classes : {0}", err.message ?? err));
	}

	const storageClassDropdown = createDropdownInputInfo(context.view, {
		width: context.fieldInfo.inputWidth,
		editable: true,
		required: context.fieldInfo.required,
		label: context.fieldInfo.label,
		values: storageClasses,
		defaultValue: defaultStorageClass
	});
	storageClassDropdown.labelComponent = label;
	storageClassDropdown.component.fireOnTextChange = true;
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, storageClassDropdown);
	addLabelInputPairToContainer(context.view, context.components, label, storageClassDropdown.component, context.fieldInfo);
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
	const accountDropdown = createDropdownInputInfo(context.view, {
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.account
	});
	accountDropdown.component.fireOnTextChange = true;
	accountDropdown.labelComponent = label;
	context.onNewInputComponentCreated(context.fieldInfo.variableName || context.fieldInfo.label, accountDropdown);
	const signInButton = context.view!.modelBuilder.button().withProps({ label: loc.signIn, width: '100px', secondary: true }).component();
	const refreshButton = context.view!.modelBuilder.button().withProps({ label: loc.refresh, width: '100px', secondary: true }).component();
	addLabelInputPairToContainer(context.view, context.components, label, accountDropdown.component, context.fieldInfo);

	const buttons = createFlexContainer(context.view!, [signInButton, refreshButton], true, undefined, undefined, undefined, { 'margin-right': '10px' });
	context.components.push(buttons);
	return {
		accountDropdown: accountDropdown.component,
		signInButton: signInButton,
		refreshAccountsButton: refreshButton
	};

}

function createAzureSubscriptionComponent(
	context: AzureAccountFieldContext,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>): AzureComponent {
	const label = createLabel(context.view, {
		text: loc.subscription,
		description: loc.subscriptionDescription,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});

	const defaultValue = context.initialVariableValues?.[context.fieldInfo.subscriptionVariableName || '']?.toString() ?? (context.fieldInfo.required ? undefined : '');
	let subscriptionInputInfo: InputComponentInfo<AzureComponent>;
	let setValueFunc: (value: InputValueType) => void;
	// If we have an default value then we don't allow users to modify it - so use a disabled text input box instead
	if (defaultValue) {
		subscriptionInputInfo = createInputBoxInputInfo(context.view, {
			type: 'text',
			defaultValue: defaultValue,
			ariaLabel: loc.subscription,
			required: context.fieldInfo.required,
			width: context.fieldInfo.inputWidth,
			enabled: false
		});
		setValueFunc = (value) => { };
	} else {
		subscriptionInputInfo = createDropdownInputInfo(context.view, {
			defaultValue: defaultValue,
			width: context.fieldInfo.inputWidth,
			editable: false,
			required: context.fieldInfo.required,
			label: loc.subscription
		});
		setValueFunc = value => setDropdownValue(<azdata.DropDownComponent>subscriptionInputInfo.component, value?.toString());
		(<InputComponentInfo<azdata.DropDownComponent>>subscriptionInputInfo).component.fireOnTextChange = true;
	}
	subscriptionInputInfo.labelComponent = label;
	context.fieldInfo.subFields!.push({
		label: label.value! as string,
		variableName: context.fieldInfo.subscriptionVariableName
	});
	context.onNewInputComponentCreated(context.fieldInfo.subscriptionVariableName || context.fieldInfo.label, {
		component: subscriptionInputInfo.component,
		getValue: async (): Promise<InputValueType> => {
			const inputValue = (await subscriptionInputInfo.getValue())?.toString() || '';
			return subscriptionValueToSubscriptionMap.get(inputValue)?.id || inputValue;
		},
		setValue: (value: InputValueType) => setValueFunc,
		getDisplayValue: subscriptionInputInfo.getDisplayValue,
		onValueChanged: subscriptionInputInfo.onValueChanged
	});
	addLabelInputPairToContainer(context.view, context.components, label, subscriptionInputInfo.component, context.fieldInfo);
	return subscriptionInputInfo.component;
}

async function handleSelectedAccountChanged(
	context: AzureAccountFieldContext,
	selectedAccount: azdata.Account | undefined,
	subscriptionComponent: AzureComponent,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>,
	resourceGroupComponent: AzureComponent,
	locationComponent?: AzureComponent
): Promise<void> {
	// If the component isn't a dropdown then just return - we don't need to do anything for the static InputBox
	if (!('values' in subscriptionComponent)) {
		return;
	}

	subscriptionValueToSubscriptionMap.clear();
	subscriptionComponent.values = [];
	await handleSelectedSubscriptionChanged(context, selectedAccount, undefined, resourceGroupComponent);
	if (!selectedAccount) {
		subscriptionComponent.values = [''];
		if (locationComponent && 'values' in locationComponent) {
			locationComponent.values = [''];
		}
		return;
	}

	if (locationComponent && 'values' in locationComponent) {
		if (locationComponent.values && locationComponent.values.length === 0) {
			locationComponent.values = context.fieldInfo.locations;
		}
	}

	try {
		const response = await apiService.azurecoreApi.getSubscriptions(selectedAccount, true, false);
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
		subscriptionComponent.values = response.subscriptions.map(subscription => {
			const displayName = getSubscriptionDisplayString(subscription);
			subscriptionValueToSubscriptionMap.set(displayName, subscription);
			return displayName;
		}).sort((a: string, b: string) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()));
		const selectedSubscription = subscriptionComponent.values.length > 0 ? subscriptionValueToSubscriptionMap.get(subscriptionComponent.values[0]) : undefined;
		await handleSelectedSubscriptionChanged(context, selectedAccount, selectedSubscription, resourceGroupComponent);
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

function createAzureResourceGroupsComponent(
	context: AzureAccountFieldContext,
	accountDropdown: azdata.DropDownComponent | undefined,
	accountValueToAccountMap: Map<string, azdata.Account>,
	subscriptionComponent: AzureComponent,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>): AzureComponent {
	const label = createLabel(context.view, {
		text: loc.resourceGroup,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});
	const defaultValue = context.initialVariableValues?.[context.fieldInfo.resourceGroupVariableName || '']?.toString() ?? (context.fieldInfo.required ? undefined : '');
	let resourceGroupInputInfo: InputComponentInfo<AzureComponent>;
	// If we have an default value then we don't allow users to modify it - so use a disabled text input box instead
	if (defaultValue) {
		resourceGroupInputInfo = createInputBoxInputInfo(context.view, {
			type: 'text',
			defaultValue: defaultValue,
			ariaLabel: loc.resourceGroup,
			required: context.fieldInfo.required,
			width: context.fieldInfo.inputWidth,
			enabled: false
		});
	} else {
		resourceGroupInputInfo = createDropdownInputInfo(context.view, {
			defaultValue: (context.fieldInfo.required) ? undefined : '',
			width: context.fieldInfo.inputWidth,
			editable: false,
			required: context.fieldInfo.required,
			label: loc.resourceGroup
		});
		(<InputComponentInfo<azdata.DropDownComponent>>resourceGroupInputInfo).component.fireOnTextChange = true;
	}
	resourceGroupInputInfo.labelComponent = label;
	context.fieldInfo.subFields!.push({
		label: label.value! as string,
		variableName: context.fieldInfo.resourceGroupVariableName
	});
	const rgValueChangedEmitter = new vscode.EventEmitter<void>();
	resourceGroupInputInfo.onValueChanged(() => rgValueChangedEmitter.fire());
	context.onNewInputComponentCreated(context.fieldInfo.resourceGroupVariableName || context.fieldInfo.label, resourceGroupInputInfo);
	addLabelInputPairToContainer(context.view, context.components, label, resourceGroupInputInfo.component, context.fieldInfo);
	if ('onValueChanged' in subscriptionComponent) {
		subscriptionComponent.onValueChanged(async selectedItem => {
			const selectedAccount = !accountDropdown || !accountDropdown.value ? undefined : accountValueToAccountMap.get(accountDropdown.value.toString());
			const selectedSubscription = subscriptionValueToSubscriptionMap.get(selectedItem.selected);
			await handleSelectedSubscriptionChanged(context, selectedAccount, selectedSubscription, resourceGroupInputInfo.component);
			rgValueChangedEmitter.fire();
		});
	}

	return resourceGroupInputInfo.component;
}

async function handleSelectedSubscriptionChanged(context: AzureAccountFieldContext, selectedAccount: azdata.Account | undefined, selectedSubscription: azureResource.AzureResourceSubscription | undefined, resourceGroupComponent: AzureComponent): Promise<void> {
	if (!('values' in resourceGroupComponent)) {
		return;
	}

	resourceGroupComponent.values = [''];
	if (!selectedAccount || !selectedSubscription) {
		// Don't need to execute command if we don't have both an account and subscription selected
		return;
	}
	try {
		const response = await apiService.azurecoreApi.getResourceGroups(selectedAccount, selectedSubscription, true);
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
		resourceGroupComponent.values = (response.resourceGroups.length !== 0)
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
async function processAzureLocationsField(context: AzureLocationsFieldContext): Promise<AzureComponent> {
	const label = createLabel(context.view, {
		text: context.fieldInfo.label || loc.location,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		cssStyles: context.fieldInfo.labelCSSStyles
	});
	const defaultValue = context.initialVariableValues?.[context.fieldInfo.locationVariableName || '']?.toString() ?? (context.fieldInfo.required ? undefined : '');
	let locationInputInfo: InputComponentInfo<AzureComponent>;
	// If we have an default value then we don't allow users to modify it - so use a disabled text input box instead
	if (defaultValue) {
		locationInputInfo = createInputBoxInputInfo(context.view, {
			type: 'text',
			defaultValue: defaultValue,
			ariaLabel: loc.location,
			required: context.fieldInfo.required,
			width: context.fieldInfo.inputWidth,
			enabled: false
		});
	} else {
		const locationValues = context.fieldInfo.locations?.map(l => { return { name: l, displayName: apiService.azurecoreApi.getRegionDisplayName(l) }; });
		locationInputInfo = createDropdownInputInfo(context.view, {
			defaultValue: locationValues?.find(l => l.name === context.fieldInfo.defaultValue),
			width: context.fieldInfo.inputWidth,
			editable: false,
			required: context.fieldInfo.required,
			label: loc.location,
			values: locationValues
		});
		(<InputComponentInfo<azdata.DropDownComponent>>locationInputInfo).component.fireOnTextChange = true;
	}

	locationInputInfo.labelComponent = label;
	context.fieldInfo.subFields = context.fieldInfo.subFields || [];
	if (context.fieldInfo.locationVariableName) {
		context.fieldInfo.subFields!.push({
			label: label.value! as string,
			variableName: context.fieldInfo.locationVariableName
		});
		context.onNewInputComponentCreated(context.fieldInfo.locationVariableName, locationInputInfo);
	}
	addLabelInputPairToContainer(context.view, context.components, label, locationInputInfo.component, context.fieldInfo);
	return locationInputInfo.component;
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

export async function setModelValues(inputComponents: InputComponents, model: Model): Promise<void> {
	await Promise.all(Object.keys(inputComponents).map(async key => {
		const value = await inputComponents[key].getValue();
		model.setPropertyValue(key, value);
	}));
}

export function isInputBoxEmpty(input: azdata.InputBoxComponent): boolean {
	return input.value === undefined || input.value === '';
}

/**
 * Sets the dropdown value to the corresponding value from the list of current values, converting
 * into a CategoryValue if necessary (using the name field).
 * @param dropdown The dropdown component to set the value for
 * @param value The value to set - either the direct string value or the name of the CategoryValue to use
 */
function setDropdownValue(dropdown: azdata.DropDownComponent, value: string = ''): void {
	const values = dropdown.values ?? [];
	if (typeof values[0] === 'object') {
		dropdown.value = (<azdata.CategoryValue[]>values).find(v => v.name === value);
	} else {
		dropdown.value = value;
	}
}

