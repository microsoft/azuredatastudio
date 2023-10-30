/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DefaultMaxTableRowCount, DefaultTableListItemEnabledStateGetter, DialogBase } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { ObjectTypeInfo } from './findObjectDialog';

export enum ObjectSelectionMethod {
	SpecificObjects,
	AllObjectsOfTypes,
	AllObjectsOfSchema
}

export interface ObjectSelectionMethodDialogOptions {
	objectTypes: ObjectTypeInfo[];
	schemas: string[];
}

export interface ObjectSelectionMethodDialogResult {
	method: ObjectSelectionMethod;
	schema: string | undefined;
	objectTypes: ObjectTypeInfo[];
}

export class ObjectSelectionMethodDialog extends DialogBase<ObjectSelectionMethodDialogResult> {
	private specificObjectsRadioButton: azdata.RadioButtonComponent;
	private allObjectsOfTypesRadioButton: azdata.RadioButtonComponent;
	private allObjectsOfSchemaRadioButton: azdata.RadioButtonComponent;
	private objectTypesTable: azdata.TableComponent;
	private schemaRow: azdata.FlexContainer;
	private result: ObjectSelectionMethodDialogResult;

	constructor(private readonly options: ObjectSelectionMethodDialogOptions) {
		super(localizedConstants.ObjectSelectionMethodDialogTitle, 'ObjectSelectionMethodDialog');
		this.result = {
			method: ObjectSelectionMethod.SpecificObjects,
			schema: undefined,
			objectTypes: []
		};

		// Relabel Cancel button to Back, since clicking cancel on an inner dialog makes it seem like it would close the whole dialog overall
		this.dialogObject.cancelButton.label = localizedConstants.BackButtonLabel;
	}

	protected override async initialize(): Promise<void> {
		const radioGroupName = 'objectSelectionMethodRadioGroup';
		this.specificObjectsRadioButton = this.createRadioButton(localizedConstants.ObjectSelectionMethodDialog_SpecificObjects, radioGroupName, true, async (checked) => { await this.handleTypeChange(checked); });
		this.allObjectsOfTypesRadioButton = this.createRadioButton(localizedConstants.ObjectSelectionMethodDialog_AllObjectsOfTypes, radioGroupName, false, async (checked) => { await this.handleTypeChange(checked); });
		this.allObjectsOfSchemaRadioButton = this.createRadioButton(localizedConstants.ObjectSelectionMethodDialog_AllObjectsOfSchema, radioGroupName, false, async (checked) => { await this.handleTypeChange(checked); });

		const typeGroup = this.createGroup(localizedConstants.ObjectSelectionMethodDialog_TypeLabel, [this.specificObjectsRadioButton, this.allObjectsOfTypesRadioButton, this.allObjectsOfSchemaRadioButton], false);
		this.objectTypesTable = this.createTableList<ObjectTypeInfo>(localizedConstants.ObjectTypeText,
			[localizedConstants.ObjectTypesText],
			this.options.objectTypes,
			this.result.objectTypes,
			DefaultMaxTableRowCount,
			DefaultTableListItemEnabledStateGetter, (item) => {
				return [item.displayName];
			}, (item1, item2) => {
				return item1.name === item2.name;
			});

		const schemaDropdown = this.createDropdown(localizedConstants.ObjectSelectionMethodDialog_SelectSchemaDropdownLabel, async (newValue) => {
			this.result.schema = newValue;
		}, this.options.schemas, this.options.schemas[0]);
		this.schemaRow = this.createLabelInputContainer(localizedConstants.ObjectSelectionMethodDialog_SelectSchemaDropdownLabel, schemaDropdown);
		await this.setComponentsVisibility(false, false);
		this.formContainer.addItems([typeGroup, this.schemaRow, this.objectTypesTable], this.getSectionItemLayout());
	}

	private async handleTypeChange(checked: boolean): Promise<void> {
		let method: ObjectSelectionMethod = ObjectSelectionMethod.SpecificObjects;
		let showSchema = false;
		let showObjectTypes = false;
		await this.setComponentsVisibility(showObjectTypes, showSchema);
		if (this.allObjectsOfTypesRadioButton.checked) {
			method = ObjectSelectionMethod.AllObjectsOfTypes;
			showSchema = false;
			showObjectTypes = true;
		} else if (this.allObjectsOfSchemaRadioButton.checked) {
			method = ObjectSelectionMethod.AllObjectsOfSchema;
			showSchema = true;
			showObjectTypes = false;
		}
		this.result.method = method;
		await this.setComponentsVisibility(showObjectTypes, showSchema);
	}

	private async setComponentsVisibility(showObjectTypes: boolean, showSchema: boolean): Promise<void> {
		await this.schemaRow.updateCssStyles({ display: showSchema ? 'flex' : 'none' });
		await this.objectTypesTable.updateCssStyles({ display: showObjectTypes ? 'block' : 'none' });
	}

	protected override get dialogResult(): ObjectSelectionMethodDialogResult | undefined {
		return this.result;
	}

	protected override async onFormFieldChange(): Promise<void> {
		this.dialogObject.okButton.enabled = this.result.method !== ObjectSelectionMethod.AllObjectsOfTypes || this.result.objectTypes.length > 0;
	}
}
