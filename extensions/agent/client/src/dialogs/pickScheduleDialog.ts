/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as sqlops from 'sqlops';
import { PickScheduleData } from '../data/pickScheduleData';

export class PickScheduleDialog {

	// TODO: localize
	// Top level
	//
	private readonly DialogTitle: string = 'Job Schedules';
	private readonly OkButtonText: string = 'OK';
	private readonly CancelButtonText: string = 'Cancel';
	private readonly GeneralTabText: string = 'Schedules';

	// General tab strings
	//
	private readonly NameTextBoxLabel: string = 'Name';
	private readonly OwnerTextBoxLabel: string = 'Owner';
	private readonly CategoryDropdownLabel: string = 'Category';
	private readonly DescriptionTextBoxLabel: string = 'Description';
	private readonly EnabledCheckboxLabel: string = 'Enabled';

	// UI Components
	//
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	//
	private nameTextBox: sqlops.InputBoxComponent;
	private ownerTextBox: sqlops.InputBoxComponent;
	private categoryDropdown: sqlops.DropDownComponent;
	private descriptionTextBox: sqlops.InputBoxComponent;
	private enabledCheckBox: sqlops.CheckBoxComponent;

	private model: PickScheduleData;

	constructor(ownerUri: string) {
		this.model = new PickScheduleData(ownerUri);
	}

	public async showDialog() {
		await this.model.initialize();
		this.dialog = sqlops.window.modelviewdialog.createDialog(this.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(this.GeneralTabText);
		this.initializeGeneralTab();
		this.dialog.content = [this.generalTab];
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = this.OkButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();
			this.ownerTextBox = view.modelBuilder.inputBox().component();
			this.categoryDropdown = view.modelBuilder.dropDown().component();
			this.descriptionTextBox = view.modelBuilder.inputBox().withProperties({
				multiline: true,
				height: 200
			}).component();
			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: this.EnabledCheckboxLabel
				}).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: this.NameTextBoxLabel
				}, {
					component: this.ownerTextBox,
					title: this.OwnerTextBoxLabel
				}, {
					component: this.categoryDropdown,
					title: this.CategoryDropdownLabel
				}, {
					component: this.descriptionTextBox,
					title: this.DescriptionTextBoxLabel
				}, {
					component: this.enabledCheckBox,
					title: ''
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			// this.ownerTextBox.value = this.model.defaultOwner;
			// this.categoryDropdown.values = this.model.jobCategories;
			// this.categoryDropdown.value = this.model.jobCategories[0];
			// this.enabledCheckBox.checked = this.model.enabled;
			this.descriptionTextBox.value = '';
		});
	}

	private createRowContainer(view: sqlops.ModelView): sqlops.FlexBuilder {
		return view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			alignItems: 'left',
			justifyContent: 'space-between'
		});
	}

	private async execute() {
		this.updateModel();
		await this.model.save();
	}

	private async cancel() {

	}

	private getActualConditionValue(checkbox: sqlops.CheckBoxComponent, dropdown: sqlops.DropDownComponent): sqlops.JobCompletionActionCondition {
		return checkbox.checked ? Number(this.getDropdownValue(dropdown)) : sqlops.JobCompletionActionCondition.Never;
	}

	private getDropdownValue(dropdown: sqlops.DropDownComponent): string {
		return (typeof dropdown.value === 'string') ? dropdown.value : dropdown.value.name;
	}

	private setConditionDropdownSelectedValue(dropdown: sqlops.DropDownComponent, selectedValue: number) {
		let idx: number = 0;
		for (idx = 0; idx < dropdown.values.length; idx++) {
			if (Number((<sqlops.CategoryValue>dropdown.values[idx]).name) === selectedValue) {
				dropdown.value = dropdown.values[idx];
				break;
			}
		}
	}

	private updateModel() {
		// this.model.name = this.nameTextBox.value;
		// this.model.owner = this.ownerTextBox.value;
		// this.model.enabled = this.enabledCheckBox.checked;
		// this.model.description = this.descriptionTextBox.value;
		// this.model.category = this.getDropdownValue(this.categoryDropdown);
		// this.model.emailLevel = this.getActualConditionValue(this.emailCheckBox, this.emailConditionDropdown);
		// this.model.operatorToEmail = this.getDropdownValue(this.emailOperatorDropdown);
		// this.model.operatorToPage = this.getDropdownValue(this.pagerOperatorDropdown);
		// this.model.pageLevel = this.getActualConditionValue(this.pagerCheckBox, this.pagerConditionDropdown);
		// this.model.eventLogLevel = this.getActualConditionValue(this.eventLogCheckBox, this.eventLogConditionDropdown);
		// this.model.deleteLevel = this.getActualConditionValue(this.deleteJobCheckBox, this.deleteJobConditionDropdown);
	}
}