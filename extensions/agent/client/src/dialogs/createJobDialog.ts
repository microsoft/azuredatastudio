/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as sqlops from 'sqlops';
import { CreateJobData } from '../data/createJobData';

export class CreateJobDialog {

	// TODO: localize
	// Top level
	//
	private readonly DialogTitle: string = 'New Job';
	private readonly OkButtonText: string = 'Ok';
	private readonly CancelButtonText: string = 'Cancel';
	private readonly GeneralTabText: string = 'General';
	private readonly StepsTabText: string = 'Steps';
	private readonly SchedulesTabText: string = 'Schedules';
	private readonly AlertsTabText: string = 'Alerts';
	private readonly NotificationsTabText: string = 'Notifications';

	// General tab strings
	//
	private readonly NameTextBoxLabel: string = 'Name';
	private readonly OwnerTextBoxLabel: string = 'Owner';
	private readonly CategoryDropdownLabel: string = 'Category';
	private readonly DescriptionTextBoxLabel: string = 'Description';
	private readonly EnabledCheckboxLabel: string = 'Enabled';

	// Steps tab strings
	private readonly JobStepsTopLabelString: string = 'Job step list';
	private readonly StepsTable_StepColumnString: string = 'Step';
	private readonly StepsTable_NameColumnString: string = 'Name';
	private readonly StepsTable_TypeColumnString: string = 'Type';
	private readonly StepsTable_SuccessColumnString: string = 'On Success';
	private readonly StepsTable_FailureColumnString: string = 'On Failure';
	private readonly NewStepButtonString: string = 'New...';
	private readonly InsertStepButtonString: string = 'Insert...';
	private readonly EditStepButtonString: string = 'Edit';
	private readonly DeleteStepButtonString: string = 'Delete';

	// Notifications tab strings
	//
	private readonly NotificationsTabTopLabelString: string = 'Actions to perform when the job completes';
	private readonly EmailCheckBoxString: string = 'Email';
	private readonly PagerCheckBoxString: string = 'Page';
	private readonly EventLogCheckBoxString: string = 'Write to the Windows Application event log';
	private readonly DeleteJobCheckBoxString: string = 'Automatically delete job';

	// UI Components
	//
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private stepsTab: sqlops.window.modelviewdialog.DialogTab;
	private alertsTab: sqlops.window.modelviewdialog.DialogTab;
	private schedulesTab: sqlops.window.modelviewdialog.DialogTab;
	private notificationsTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	//
	private nameTextBox: sqlops.InputBoxComponent;
	private ownerTextBox: sqlops.InputBoxComponent;
	private categoryDropdown: sqlops.DropDownComponent;
	private descriptionTextBox: sqlops.InputBoxComponent;
	private enabledCheckBox: sqlops.CheckBoxComponent;

	// Steps tab controls
	private stepsTable: sqlops.TableComponent;
	private newStepButton: sqlops.ButtonComponent;
	private insertStepButton: sqlops.ButtonComponent;
	private editStepButton: sqlops.ButtonComponent;
	private deleteStepButton: sqlops.ButtonComponent;

	// Notifications tab controls
	//
	private notificationsTabTopLabel: sqlops.TextComponent;
	private emailCheckBox: sqlops.CheckBoxComponent;
	private emailOperatorDropdown: sqlops.DropDownComponent;
	private emailConditionDropdown: sqlops.DropDownComponent;
	private pagerCheckBox: sqlops.CheckBoxComponent;
	private pagerOperatorDropdown: sqlops.DropDownComponent;
	private pagerConditionDropdown: sqlops.DropDownComponent;
	private eventLogCheckBox: sqlops.CheckBoxComponent;
	private eventLogConditionDropdown: sqlops.DropDownComponent;
	private deleteJobCheckBox: sqlops.CheckBoxComponent;
	private deleteJobConditionDropdown: sqlops.DropDownComponent;

	private model: CreateJobData;

	constructor(ownerUri: string) {
		this.model = new CreateJobData(ownerUri);
	}

	public async showDialog() {
		this.dialog = sqlops.window.modelviewdialog.createDialog(this.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(this.GeneralTabText);
		this.stepsTab = sqlops.window.modelviewdialog.createTab(this.StepsTabText);
		this.alertsTab = sqlops.window.modelviewdialog.createTab(this.AlertsTabText);
		this.schedulesTab = sqlops.window.modelviewdialog.createTab(this.SchedulesTabText);
		this.notificationsTab = sqlops.window.modelviewdialog.createTab(this.NotificationsTabText);
		this.initializeGeneralTab();
		this.initializeStepsTab();
		this.initializeAlertsTab();
		this.initializeSchedulesTab();
		this.initializeNotificationsTab();
		this.dialog.content = [this.generalTab, this.stepsTab, this.schedulesTab, this.alertsTab, this.notificationsTab];
		this.dialog.okButton.onClick(() => this.execute());
		this.dialog.cancelButton.onClick(() => this.cancel());
		this.dialog.okButton.label = this.OkButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;
		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();
			this.ownerTextBox = view.modelBuilder.inputBox().component();
			this.categoryDropdown = view.modelBuilder.dropDown().component();
			this.descriptionTextBox = view.modelBuilder.inputBox().component();
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
				}]).component();
			await view.initializeModel(formModel);
		});
	}

	private initializeStepsTab() {
		this.stepsTab.registerContent(async view => {
			this.stepsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						this.StepsTable_StepColumnString,
						this.StepsTable_NameColumnString,
						this.StepsTable_TypeColumnString,
						this.StepsTable_SuccessColumnString,
						this.StepsTable_FailureColumnString
					],
					data:[],
					height:500
				}).component();

			this.newStepButton = view.modelBuilder.button().withProperties({
				label: this.NewStepButtonString
			}).component();

			this.insertStepButton = view.modelBuilder.button().withProperties({
				label: this.InsertStepButtonString
			}).component();

			this.editStepButton = view.modelBuilder.button().withProperties({
				label: this.EditStepButtonString
			}).component();

			this.newStepButton = view.modelBuilder.button().withProperties({
				label: this.DeleteStepButtonString
			}).component();

			let buttonContainer = this.createRowContainer(view).withItems([this.newStepButton, this.insertStepButton, this.editStepButton, this.deleteStepButton]).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.stepsTable,
					title: this.JobStepsTopLabelString
				}, {
					component: buttonContainer,
					title: ''
				}]).component();
			await view.initializeModel(formModel);
		});
	}

	private initializeAlertsTab() {
	}

	private initializeSchedulesTab() {
	}

	private initializeNotificationsTab() {
		this.notificationsTab.registerContent(async view => {

			this.notificationsTabTopLabel = view.modelBuilder.text().withProperties({ value: this.NotificationsTabTopLabelString }).component();
			this.emailCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.EmailCheckBoxString
			}).component();
			this.pagerCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.PagerCheckBoxString
			}).component();
			this.eventLogCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.EventLogCheckBoxString
			}).component();
			this.deleteJobCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.DeleteJobCheckBoxString
			}).component();
			this.emailOperatorDropdown = view.modelBuilder.dropDown().component();
			this.pagerOperatorDropdown = view.modelBuilder.dropDown().component();
			this.emailConditionDropdown = view.modelBuilder.dropDown().component();
			this.pagerConditionDropdown = view.modelBuilder.dropDown().component();
			this.eventLogConditionDropdown = view.modelBuilder.dropDown().component();
			this.deleteJobConditionDropdown = view.modelBuilder.dropDown().component();

			let emailContainer = this.createRowContainer(view).withItems([this.emailCheckBox, this.emailOperatorDropdown, this.emailConditionDropdown]).component();

			let pagerContainer = this.createRowContainer(view).withItems([this.pagerCheckBox, this.pagerOperatorDropdown, this.pagerConditionDropdown]).component();

			let eventLogContainer = this.createRowContainer(view).withItems([this.eventLogCheckBox, this.eventLogConditionDropdown]).component();

			let deleteJobContainer = this.createRowContainer(view).withItems([this.deleteJobCheckBox, this.deleteJobConditionDropdown]).component();

			let formModel = view.modelBuilder.formContainer().withFormItems([
				{
					component: this.notificationsTabTopLabel,
					title: ''
				}, {
					component: emailContainer,
					title: ''
				}, {
					component: pagerContainer,
					title: ''
				}, {
					component: eventLogContainer,
					title: ''
				}, {
					component: deleteJobContainer,
					title: ''
				}
			]).component();
			await view.initializeModel(formModel);
		});
	}

	private createRowContainer(view: sqlops.ModelView): sqlops.FlexBuilder {
		return view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			alignItems: 'left'
		});
	}

	private async execute() {
		this.model.name = this.nameTextBox.value;
		this.model.enabled = this.enabledCheckBox.checked;
		this.model.description = this.descriptionTextBox.value;
		this.model.categoryId = 1;
		await this.model.save();
	}

	private cancel() {

	}
}