/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DialogInfoBase, FieldType, FieldInfo, SectionInfo, LabelPosition, FontWeight, FontStyle, AzureAccountFieldInfo } from '../interfaces';
import { Model } from './model';
import { getDateTimeString } from '../utils';
import { azureResource } from '../../../azurecore/src/azureResource/azure-resource';
import * as azurecore from '../../../azurecore/src/azurecore';
import * as loc from '../localizedConstants';
import { EOL } from 'os';

const localize = nls.loadMessageBundle();

export type Validator = () => { valid: boolean, message: string };
export type InputValueTransformer = (inputValue: string) => string;
export type InputComponents = { [s: string]: { component: azdata.InputBoxComponent | azdata.DropDownComponent | azdata.CheckBoxComponent; inputValueTransformer?: InputValueTransformer } };

export function getInputBoxComponent(name: string, inputComponents: InputComponents): azdata.InputBoxComponent {
	return <azdata.InputBoxComponent>inputComponents[name].component;
}

export function getDropdownComponent(name: string, inputComponents: InputComponents): azdata.DropDownComponent {
	return <azdata.DropDownComponent>inputComponents[name].component;
}

export function getCheckboxComponent(name: string, inputComponents: InputComponents): azdata.CheckBoxComponent {
	return <azdata.CheckBoxComponent>inputComponents[name].component;
}

export const DefaultInputComponentWidth = '400px';
export const DefaultLabelComponentWidth = '200px';

export interface DialogContext extends CreateContext {
	dialogInfo: DialogInfoBase;
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

interface AzureAccountFieldContext extends FieldContext {
	fieldInfo: AzureAccountFieldInfo;
}

interface CreateContext {
	container: azdata.window.Dialog | azdata.window.Wizard;
	onNewValidatorCreated: (validator: Validator) => void;
	onNewDisposableCreated: (disposable: vscode.Disposable) => void;
	onNewInputComponentCreated: (name: string, component: azdata.InputBoxComponent | azdata.DropDownComponent | azdata.CheckBoxComponent, inputValueTransformer?: InputValueTransformer) => void;
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

export function createLabel(view: azdata.ModelView, info: { text: string, description?: string, required?: boolean, width?: string, fontStyle?: FontStyle, fontWeight?: FontWeight, links?: azdata.LinkArea[] }): azdata.TextComponent {
	const text = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
		value: info.text,
		description: info.description,
		requiredIndicator: info.required,
		CSSStyles: { 'font-style': info.fontStyle || 'normal', 'font-weight': info.fontWeight || 'normal' },
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
			const row = createFlexContainer(context.view, rowItems);
			components.push(row);
		});
	}

	return createGroupContainer(context.view, components, {
		header: context.sectionInfo.title,
		collapsible: context.sectionInfo.collapsible === undefined ? true : context.sectionInfo.collapsible,
		collapsed: context.sectionInfo.collapsed === undefined ? false : context.sectionInfo.collapsed
	});
}

function processFields(fieldInfoArray: FieldInfo[], components: azdata.Component[], context: SectionContext, spaceBetweenFields?: string): void {
	for (let i = 0; i < fieldInfoArray.length; i++) {
		const fieldInfo = fieldInfoArray[i];
		fieldInfo.labelWidth = fieldInfo.labelWidth || context.sectionInfo.labelWidth;
		fieldInfo.inputWidth = fieldInfo.inputWidth || context.sectionInfo.inputWidth;
		fieldInfo.labelPosition = fieldInfo.labelPosition === undefined ? context.sectionInfo.labelPosition : fieldInfo.labelPosition;
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

export function createFlexContainer(view: azdata.ModelView, items: azdata.Component[], rowLayout: boolean = true): azdata.FlexContainer {
	const flexFlow = rowLayout ? 'row' : 'column';
	const alignItems = rowLayout ? 'center' : undefined;
	const itemsStyle = rowLayout ? { CSSStyles: { 'margin-right': '5px' } } : {};
	return view.modelBuilder.flexContainer().withItems(items, itemsStyle).withLayout({ flexFlow: flexFlow, alignItems: alignItems }).component();
}

export function createGroupContainer(view: azdata.ModelView, items: azdata.Component[], layout: azdata.GroupLayout): azdata.GroupContainer {
	return view.modelBuilder.groupContainer().withItems(items).withLayout(layout).component();
}

function addLabelInputPairToContainer(view: azdata.ModelView, components: azdata.Component[], label: azdata.Component, input: azdata.Component, labelPosition?: LabelPosition) {
	if (labelPosition && labelPosition === LabelPosition.Left) {
		const row = createFlexContainer(view, [label, input]);
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
		case FieldType.Checkbox:
			processCheckboxField(context);
			break;
		case FieldType.AzureAccount:
			processAzureAccountField(context);
			break;
		default:
			throw new Error(localize('UnknownFieldTypeError', "Unknown field type: \"{0}\"", context.fieldInfo.type));
	}
}

function processOptionsTypeField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, fontWeight: context.fieldInfo.labelFontWeight });
	const dropdown = createDropdown(context.view, {
		values: context.fieldInfo.options,
		defaultValue: context.fieldInfo.defaultValue,
		width: context.fieldInfo.inputWidth,
		editable: context.fieldInfo.editable,
		required: context.fieldInfo.required,
		label: context.fieldInfo.label
	});
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, dropdown);
	addLabelInputPairToContainer(context.view, context.components, label, dropdown, context.fieldInfo.labelPosition);
}

function processDateTimeTextField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, fontWeight: context.fieldInfo.labelFontWeight });
	const defaultValue = context.fieldInfo.defaultValue + getDateTimeString();
	const input = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		value: defaultValue,
		ariaLabel: context.fieldInfo.label,
		inputType: 'text',
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder
	}).component();
	input.width = context.fieldInfo.inputWidth;
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, input);
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo.labelPosition);
}

function processNumberField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, fontWeight: context.fieldInfo.labelFontWeight });
	const input = createNumberInput(context.view, {
		defaultValue: context.fieldInfo.defaultValue,
		ariaLabel: context.fieldInfo.label,
		min: context.fieldInfo.min,
		max: context.fieldInfo.max,
		required: context.fieldInfo.required,
		width: context.fieldInfo.inputWidth,
		placeHolder: context.fieldInfo.placeHolder
	});
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, input);
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo.labelPosition);
}

function processTextField(context: FieldContext): void {
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, fontWeight: context.fieldInfo.labelFontWeight });
	const input = createTextInput(context.view, {
		defaultValue: context.fieldInfo.defaultValue,
		ariaLabel: context.fieldInfo.label,
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: context.fieldInfo.inputWidth,
		enabled: context.fieldInfo.enabled
	});
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, input);
	addLabelInputPairToContainer(context.view, context.components, label, input, context.fieldInfo.labelPosition);

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
	const passwordLabel = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: context.fieldInfo.required, width: context.fieldInfo.labelWidth, fontWeight: context.fieldInfo.labelFontWeight });
	const passwordInput = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
		ariaLabel: context.fieldInfo.label,
		inputType: 'password',
		required: context.fieldInfo.required,
		placeHolder: context.fieldInfo.placeHolder,
		width: context.fieldInfo.inputWidth
	}).component();
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, passwordInput);
	addLabelInputPairToContainer(context.view, context.components, passwordLabel, passwordInput, context.fieldInfo.labelPosition);

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
		const confirmPasswordLabel = createLabel(context.view, { text: context.fieldInfo.confirmationLabel!, required: true, width: context.fieldInfo.labelWidth, fontWeight: context.fieldInfo.labelFontWeight });
		const confirmPasswordInput = context.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: context.fieldInfo.confirmationLabel,
			inputType: 'password',
			required: true,
			width: context.fieldInfo.inputWidth
		}).component();

		addLabelInputPairToContainer(context.view, context.components, confirmPasswordLabel, confirmPasswordInput, context.fieldInfo.labelPosition);
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
	const label = createLabel(context.view, { text: context.fieldInfo.label, description: context.fieldInfo.description, required: false, width: context.fieldInfo.labelWidth, fontWeight: context.fieldInfo.labelFontWeight });
	const text = createLabel(context.view, { text: context.fieldInfo.defaultValue!, description: '', required: false, width: context.fieldInfo.inputWidth, fontStyle: context.fieldInfo.fontStyle, links: context.fieldInfo.links });
	addLabelInputPairToContainer(context.view, context.components, label, text, context.fieldInfo.labelPosition);
}

function processCheckboxField(context: FieldContext): void {
	const checkbox = createCheckbox(context.view, { initialValue: context.fieldInfo.defaultValue! === 'true', label: context.fieldInfo.label, required: context.fieldInfo.required });
	context.components.push(checkbox);
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, checkbox);
}

/**
 * An Azure Account field consists of 3 separate dropdown fields - Account, Subscription and Resource Group
 * @param context The context to use to create the field
 */
function processAzureAccountField(context: AzureAccountFieldContext): void {
	const accountValueToAccountMap = new Map<string, azdata.Account>();
	const subscriptionValueToSubscriptionMap = new Map<string, azureResource.AzureResourceSubscription>();
	const accountDropdown = createAzureAccountDropdown(context);
	const subscriptionDropdown = createAzureSubscriptionDropdown(context, subscriptionValueToSubscriptionMap);
	const resourceGroupDropdown = createAzureResourceGroupsDropdown(context, accountDropdown, accountValueToAccountMap, subscriptionDropdown, subscriptionValueToSubscriptionMap);
	const locationDropdown = createAzureLocationDropdown(context);
	accountDropdown.onValueChanged(selectedItem => {
		const selectedAccount = accountValueToAccountMap.get(selectedItem.selected)!;
		handleSelectedAccountChanged(context, selectedAccount, subscriptionDropdown, subscriptionValueToSubscriptionMap, resourceGroupDropdown, locationDropdown);
	});
	azdata.accounts.getAllAccounts().then((accounts: azdata.Account[]) => {
		// Append a blank value for the "default" option if the field isn't required, this will clear all the dropdowns when selected
		const dropdownValues = context.fieldInfo.required ? [] : [''];
		accountDropdown.values = dropdownValues.concat(accounts.map(account => {
			const displayName = `${account.displayInfo.displayName} (${account.displayInfo.userId})`;
			accountValueToAccountMap.set(displayName, account);
			return displayName;
		}));
		const selectedAccount = accountDropdown.value ? accountValueToAccountMap.get(accountDropdown.value.toString()) : undefined;
		handleSelectedAccountChanged(context, selectedAccount, subscriptionDropdown, subscriptionValueToSubscriptionMap, resourceGroupDropdown, locationDropdown);
	}, (err: any) => console.log(`Unexpected error fetching accounts: ${err}`));
}

function createAzureAccountDropdown(context: AzureAccountFieldContext): azdata.DropDownComponent {
	const label = createLabel(context.view, {
		text: loc.account,
		description: context.fieldInfo.description,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		fontWeight: context.fieldInfo.labelFontWeight
	});
	const accountDropdown = createDropdown(context.view, {
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.account
	});
	context.onNewInputComponentCreated(context.fieldInfo.variableName!, accountDropdown);
	addLabelInputPairToContainer(context.view, context.components, label, accountDropdown, context.fieldInfo.labelPosition);
	return accountDropdown;
}

function createAzureSubscriptionDropdown(
	context: AzureAccountFieldContext,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>): azdata.DropDownComponent {
	const label = createLabel(context.view, {
		text: loc.subscription,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		fontWeight: context.fieldInfo.labelFontWeight
	});
	const subscriptionDropdown = createDropdown(context.view, {
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.subscription
	});
	context.onNewInputComponentCreated(context.fieldInfo.subscriptionVariableName!, subscriptionDropdown, (inputValue: string) => {
		return subscriptionValueToSubscriptionMap.get(inputValue)?.id || inputValue;
	});
	addLabelInputPairToContainer(context.view, context.components, label, subscriptionDropdown, context.fieldInfo.labelPosition);
	return subscriptionDropdown;
}

function handleSelectedAccountChanged(
	context: AzureAccountFieldContext,
	selectedAccount: azdata.Account | undefined,
	subscriptionDropdown: azdata.DropDownComponent,
	subscriptionValueToSubscriptionMap: Map<string, azureResource.AzureResourceSubscription>,
	resourceGroupDropdown: azdata.DropDownComponent,
	locationDropdown: azdata.DropDownComponent
): void {
	subscriptionValueToSubscriptionMap.clear();
	subscriptionDropdown.values = [];
	handleSelectedSubscriptionChanged(context, selectedAccount, undefined, resourceGroupDropdown);
	if (selectedAccount) {
		if (locationDropdown.values && locationDropdown.values.length === 0) {
			locationDropdown.values = context.fieldInfo.locations;
		}
	} else {
		locationDropdown.values = [];
		return;
	}
	vscode.commands.executeCommand<azurecore.GetSubscriptionsResult>('azure.accounts.getSubscriptions', selectedAccount, true /*ignoreErrors*/).then(response => {
		if (!response) {
			return;
		}
		if (response.errors.length > 0) {
			context.container.message = {
				text: response.errors.join(EOL) || '',
				description: '',
				level: azdata.window.MessageLevel.Warning
			};
		}
		subscriptionDropdown.values = response.subscriptions.map(subscription => {
			const displayName = `${subscription.name} (${subscription.id})`;
			subscriptionValueToSubscriptionMap.set(displayName, subscription);
			return displayName;
		}).sort((a: string, b: string) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()));
		const selectedSubscription = subscriptionDropdown.values.length > 0 ? subscriptionValueToSubscriptionMap.get(subscriptionDropdown.values[0]) : undefined;
		handleSelectedSubscriptionChanged(context, selectedAccount, selectedSubscription, resourceGroupDropdown);
	}, err => { vscode.window.showErrorMessage(localize('azure.accounts.unexpectedSubscriptionsError', "Unexpected error fetching subscriptions for account {0} ({1}): {2}", selectedAccount?.displayInfo.displayName, selectedAccount?.key.accountId, err.message)); });
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
		fontWeight: context.fieldInfo.labelFontWeight
	});
	const resourceGroupDropdown = createDropdown(context.view, {
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.resourceGroup
	});
	context.onNewInputComponentCreated(context.fieldInfo.resourceGroupVariableName!, resourceGroupDropdown);
	addLabelInputPairToContainer(context.view, context.components, label, resourceGroupDropdown, context.fieldInfo.labelPosition);
	subscriptionDropdown.onValueChanged(selectedItem => {
		const selectedAccount = !accountDropdown || !accountDropdown.value ? undefined : accountValueToAccountMap.get(accountDropdown.value.toString());
		const selectedSubscription = subscriptionValueToSubscriptionMap.get(selectedItem.selected);
		handleSelectedSubscriptionChanged(context, selectedAccount, selectedSubscription, resourceGroupDropdown);
	});
	return resourceGroupDropdown;
}

function handleSelectedSubscriptionChanged(context: AzureAccountFieldContext, selectedAccount: azdata.Account | undefined, selectedSubscription: azureResource.AzureResourceSubscription | undefined, resourceGroupDropdown: azdata.DropDownComponent): void {
	resourceGroupDropdown.values = [];
	if (!selectedAccount || !selectedSubscription) {
		// Don't need to execute command if we don't have both an account and subscription selected
		return;
	}
	vscode.commands.executeCommand<azurecore.GetResourceGroupsResult>('azure.accounts.getResourceGroups', selectedAccount, selectedSubscription, true /*ignoreErrors*/).then(response => {
		if (!response) {
			return;
		}
		if (response.errors.length > 0) {
			context.container.message = {
				text: response.errors.join(EOL) || '',
				description: '',
				level: azdata.window.MessageLevel.Warning
			};
		}
		resourceGroupDropdown.values = response.resourceGroups.map(resourceGroup => resourceGroup.name).sort((a: string, b: string) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()));
	}, err => { vscode.window.showErrorMessage(localize('azure.accounts.unexpectedResourceGroupsError', "Unexpected error fetching resource groups for subscription {0} ({1}): {2}", selectedSubscription?.name, selectedSubscription?.id, err.message)); });
}

/**
 * Map of known Azure location friendly names to their internal names
 */
const knownAzureLocationNameMappings = new Map<string, string>([
	['East US', 'eastus'],
	['East US 2', 'eastus2'],
	['Central US', 'centralus']
]);

function createAzureLocationDropdown(context: AzureAccountFieldContext): azdata.DropDownComponent {
	const label = createLabel(context.view, {
		text: loc.location,
		required: context.fieldInfo.required,
		width: context.fieldInfo.labelWidth,
		fontWeight: context.fieldInfo.labelFontWeight
	});
	const locationDropdown = createDropdown(context.view, {
		width: context.fieldInfo.inputWidth,
		editable: false,
		required: context.fieldInfo.required,
		label: loc.location,
		values: context.fieldInfo.locations
	});
	context.onNewInputComponentCreated(context.fieldInfo.locationVariableName!, locationDropdown, (inputValue: string) => {
		return knownAzureLocationNameMappings.get(inputValue) || inputValue;
	});
	addLabelInputPairToContainer(context.view, context.components, label, locationDropdown, context.fieldInfo.labelPosition);
	return locationDropdown;
}

export function isValidSQLPassword(password: string, userName: string = 'sa'): boolean {
	// Validate SQL Server password
	const containsUserName = password && userName !== undefined && password.toUpperCase().includes(userName.toUpperCase());
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

export function setModelValues(inputComponents: InputComponents, model: Model): void {
	Object.keys(inputComponents).forEach(key => {
		let value;
		const input = inputComponents[key].component;
		if ('checked' in input) { // CheckBoxComponent
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
		model.setPropertyValue(key, value);
	});
}

export function isInputBoxEmpty(input: azdata.InputBoxComponent): boolean {
	return input.value === undefined || input.value === '';
}

export const MissingRequiredInformationErrorMessage = localize('deployCluster.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");
