/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { JobData } from '../data/jobData';
import { JobStepDialog } from './jobStepDialog';
import { PickScheduleDialog } from './pickScheduleDialog';
import { AlertDialog } from './alertDialog';
import { AgentDialog } from './agentDialog';

const localize = nls.loadMessageBundle();

export class JobDialog extends AgentDialog<JobData>  {

	// TODO: localize
	// Top level
	private static readonly CreateDialogTitle: string = localize('jobDialog.newJob', 'New Job');
	private static readonly EditDialogTitle: string = localize('jobDialog.editJob', 'Edit Job');
	private readonly GeneralTabText: string = localize('jobDialog.general', 'General');
	private readonly StepsTabText: string = localize('jobDialog.steps', 'Steps');
	private readonly SchedulesTabText: string = localize('jobDialog.schedules', 'Schedules');
	private readonly AlertsTabText: string = localize('jobDialog.alerts', 'Alerts');
	private readonly NotificationsTabText: string = localize('jobDialog.notifications', 'Notifications');
	private readonly BlankJobNameErrorText: string = localize('jobDialog.blankJobNameError', 'The name of the job cannot be blank.');

	// General tab strings
	private readonly NameTextBoxLabel: string = localize('jobDialog.name', 'Name');
	private readonly OwnerTextBoxLabel: string = localize('jobDialog.owner', 'Owner');
	private readonly CategoryDropdownLabel: string = localize('jobDialog.category', 'Category');
	private readonly DescriptionTextBoxLabel: string = localize('jobDialog.description', 'Description');
	private readonly EnabledCheckboxLabel: string = localize('jobDialog.enabled', 'Enabled');

	// Steps tab strings
	private readonly JobStepsTopLabelString: string = localize('jobDialog.jobStepList', 'Job step list');
	private readonly StepsTable_StepColumnString: string = localize('jobDialog.step', 'Step');
	private readonly StepsTable_NameColumnString: string = localize('jobDialog.name', 'Name');
	private readonly StepsTable_TypeColumnString: string = localize('jobDialog.type', 'Type');
	private readonly StepsTable_SuccessColumnString: string = localize('jobDialog.onSuccess', 'On Success');
	private readonly StepsTable_FailureColumnString: string = localize('jobDialog.onFailure', 'On Failure');
	private readonly NewStepButtonString: string = localize('jobDialog.new', 'New...');
	private readonly EditStepButtonString: string = localize('jobDialog.edit', 'Edit');
	private readonly DeleteStepButtonString: string = localize('jobDialog.delete', 'Delete');
	private readonly MoveStepUpButtonString: string = localize('jobDialog.moveUp', 'Move Step Up');
	private readonly MoveStepDownButtonString: string = localize('jobDialog.moveDown', 'Move Step Up');

	// Notifications tab strings
	private readonly NotificationsTabTopLabelString: string = localize('jobDialog.notificationsTabTop', 'Actions to perform when the job completes');
	private readonly EmailCheckBoxString: string = localize('jobDialog.email', 'Email');
	private readonly PagerCheckBoxString: string = localize('jobDialog.page', 'Page');
	private readonly EventLogCheckBoxString: string = localize('jobDialog.eventLogCheckBoxLabel', 'Write to the Windows Application event log');
	private readonly DeleteJobCheckBoxString: string = localize('jobDialog.deleteJobLabel', 'Automatically delete job');

	// Schedules tab strings
	private readonly SchedulesTopLabelString: string = localize('jobDialog.schedulesaLabel', 'Schedules list');
	private readonly PickScheduleButtonString: string = localize('jobDialog.pickSchedule', 'Pick Schedule');
	private readonly ScheduleNameLabelString: string = localize('jobDialog.scheduleNameLabel', 'Schedule Name');

	// Alerts tab strings
	private readonly AlertsTopLabelString: string = localize('jobDialog.alertsList', 'Alerts list');
	private readonly NewAlertButtonString: string = localize('jobDialog.newAlert', 'New Alert');
	private readonly AlertNameLabelString: string = localize('jobDialog.alertNameLabel', 'Alert Name');

	// UI Components
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private stepsTab: sqlops.window.modelviewdialog.DialogTab;
	private alertsTab: sqlops.window.modelviewdialog.DialogTab;
	private schedulesTab: sqlops.window.modelviewdialog.DialogTab;
	private notificationsTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	private nameTextBox: sqlops.InputBoxComponent;
	private ownerTextBox: sqlops.InputBoxComponent;
	private categoryDropdown: sqlops.DropDownComponent;
	private descriptionTextBox: sqlops.InputBoxComponent;
	private enabledCheckBox: sqlops.CheckBoxComponent;

	// Steps tab controls
	private stepsTable: sqlops.TableComponent;
	private newStepButton: sqlops.ButtonComponent;
	private moveStepUpButton: sqlops.ButtonComponent;
	private moveStepDownButton: sqlops.ButtonComponent;
	private editStepButton: sqlops.ButtonComponent;
	private deleteStepButton: sqlops.ButtonComponent;

	// Notifications tab controls
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

	// Schedule tab controls
	private schedulesTable: sqlops.TableComponent;
	private pickScheduleButton: sqlops.ButtonComponent;

	// Alert tab controls
	private alertsTable: sqlops.TableComponent;
	private newAlertButton: sqlops.ButtonComponent;

	constructor(ownerUri: string, jobInfo: sqlops.AgentJobInfo = undefined) {
		super(
			ownerUri,
			new JobData(ownerUri, jobInfo),
			jobInfo ? JobDialog.EditDialogTitle : JobDialog.CreateDialogTitle);
	}

	protected async initializeDialog() {
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

		this.dialog.registerCloseValidator(() => {
			this.updateModel();
			let validationResult = this.model.validate();
			if (!validationResult.valid) {
				// TODO: Show Error Messages
				console.error(validationResult.errorMessages.join(','));
			}

			return validationResult.valid;
		});
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();
			this.nameTextBox.required = true;
			this.nameTextBox.onTextChanged(() => {
				if (this.nameTextBox.value && this.nameTextBox.value.length > 0) {
					this.dialog.message = null;
				}
			});
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

			this.nameTextBox.value = this.model.name;
			this.ownerTextBox.value = this.model.defaultOwner;
			this.categoryDropdown.values = this.model.jobCategories;

			let idx: number = undefined;
			if (this.model.category && this.model.category !== '') {
				idx = this.model.jobCategories.indexOf(this.model.category);
			}
			this.categoryDropdown.value = this.model.jobCategories[idx > 0 ? idx : 0];

			this.enabledCheckBox.checked = this.model.enabled;
			this.descriptionTextBox.value = this.model.description;
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
					data: [],
					height: 300
				}).component();

			this.moveStepUpButton = view.modelBuilder.button()
				.withProperties({
					label: this.MoveStepUpButtonString,
					width: 80
				}).component();

			this.moveStepDownButton = view.modelBuilder.button()
				.withProperties({
					label: this.MoveStepDownButtonString,
					width: 80
				}).component();

			this.newStepButton = view.modelBuilder.button().withProperties({
				label: this.NewStepButtonString,
				width: 80
			}).component();

			this.newStepButton.onDidClick((e)=>{
				if (this.nameTextBox.value && this.nameTextBox.value.length > 0) {
					let stepDialog = new JobStepDialog(this.model.ownerUri, this.nameTextBox.value, '' , 1, this.model);
					stepDialog.openNewStepDialog();
				} else {
					this.dialog.message = { text: this.BlankJobNameErrorText };
				}
			});

			this.editStepButton = view.modelBuilder.button().withProperties({
				label: this.EditStepButtonString,
				width: 80
			}).component();

			this.deleteStepButton = view.modelBuilder.button().withProperties({
				label: this.DeleteStepButtonString,
				width: 80
			}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.stepsTable,
					title: this.JobStepsTopLabelString,
					actions: [this.moveStepUpButton, this.moveStepDownButton, this.newStepButton, this.editStepButton, this.deleteStepButton]
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
		});
	}

	private initializeAlertsTab() {
		this.alertsTab.registerContent(async view => {
			this.alertsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						this.AlertNameLabelString
					],
					data: [],
					height: 300,
					width: 400
				}).component();

			this.newAlertButton = view.modelBuilder.button().withProperties({
				label: this.NewAlertButtonString,
				width: 80
			}).component();

			this.newAlertButton.onDidClick((e)=>{
				let alertDialog = new AlertDialog(this.model.ownerUri, null, []);
				alertDialog.onSuccess((dialogModel) => {
				});
				alertDialog.openDialog();
			});

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.alertsTable,
					title: this.AlertsTopLabelString,
					actions: [this.newAlertButton]
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeSchedulesTab() {
		this.schedulesTab.registerContent(async view => {
			this.schedulesTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						this.ScheduleNameLabelString
					],
					data: [],
					height: 300,
					width: 420
				}).component();

			this.pickScheduleButton = view.modelBuilder.button().withProperties({
				label: this.PickScheduleButtonString,
				width: 80
			}).component();

			this.pickScheduleButton.onDidClick((e)=>{
				let pickScheduleDialog = new PickScheduleDialog(this.model.ownerUri);
				pickScheduleDialog.onSuccess((dialogModel) => {
					let selectedSchedule = dialogModel.selectedSchedule;
					if (selectedSchedule) {
						this.model.addJobSchedule(selectedSchedule);
						this.populateScheduleTable();
					}
				});
				pickScheduleDialog.showDialog();
			});

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.schedulesTable,
					title: this.SchedulesTopLabelString,
					actions: [this.pickScheduleButton]
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			this.populateScheduleTable();
		});
	}

	private populateScheduleTable() {
		if (this.model.jobSchedules) {
			let data: any[][] = [];
			for (let i = 0; i < this.model.jobSchedules.length; ++i) {
				let schedule = this.model.jobSchedules[i];
				data[i] = [ schedule.name ];
			}
			this.schedulesTable.data = data;
		}
	}

	private initializeNotificationsTab() {
		this.notificationsTab.registerContent(async view => {

			this.notificationsTabTopLabel = view.modelBuilder.text().withProperties({ value: this.NotificationsTabTopLabelString }).component();
			this.emailCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.EmailCheckBoxString,
				width: 80
			}).component();

			this.pagerCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.PagerCheckBoxString,
				width: 80
			}).component();
			this.eventLogCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.EventLogCheckBoxString,
				width: 250
			}).component();
			this.deleteJobCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.DeleteJobCheckBoxString,
				width: 250
			}).component();

			this.emailCheckBox.onChanged(() => {
				this.emailConditionDropdown.enabled = this.emailCheckBox.checked;
				this.emailOperatorDropdown.enabled = this.emailCheckBox.checked;
			});

			this.pagerCheckBox.onChanged(() => {
				this.pagerConditionDropdown.enabled = this.pagerCheckBox.checked;
				this.pagerOperatorDropdown.enabled = this.pagerCheckBox.checked;
			});
			this.eventLogCheckBox.onChanged(() => {
				this.eventLogConditionDropdown.enabled = this.eventLogCheckBox.checked;
			});

			this.deleteJobCheckBox.onChanged(() => {
				this.deleteJobConditionDropdown.enabled = this.deleteJobCheckBox.checked;
			});

			this.emailOperatorDropdown = view.modelBuilder.dropDown().withProperties({ width: 150 }).component();
			this.pagerOperatorDropdown = view.modelBuilder.dropDown().withProperties({ width: 150 }).component();
			this.emailConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: 150 }).component();
			this.pagerConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: 150 }).component();
			this.eventLogConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: 150 }).component();
			this.deleteJobConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: 150 }).component();

			let emailContainer = this.createRowContainer(view).withItems([this.emailCheckBox, this.emailOperatorDropdown, this.emailConditionDropdown]).component();

			let pagerContainer = this.createRowContainer(view).withItems([this.pagerCheckBox, this.pagerOperatorDropdown, this.pagerConditionDropdown]).component();

			let eventLogContainer = this.createRowContainer(view).withItems([this.eventLogCheckBox, this.eventLogConditionDropdown]).component();

			let deleteJobContainer = this.createRowContainer(view).withItems([this.deleteJobCheckBox, this.deleteJobConditionDropdown]).component();

			let formModel = view.modelBuilder.formContainer().withFormItems([
				{
					components:
					[{
						component: emailContainer,
						title: ''
					},
					{
						component: pagerContainer,
						title: ''
					},
					{
						component: eventLogContainer,
						title: ''
					},
					{
						component: deleteJobContainer,
						title: ''
					}], title: this.NotificationsTabTopLabelString}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
			this.emailConditionDropdown.values = this.model.JobCompletionActionConditions;
			this.pagerConditionDropdown.values = this.model.JobCompletionActionConditions;
			this.eventLogConditionDropdown.values = this.model.JobCompletionActionConditions;
			this.deleteJobConditionDropdown.values = this.model.JobCompletionActionConditions;
			this.setConditionDropdownSelectedValue(this.emailConditionDropdown, this.model.emailLevel);
			this.setConditionDropdownSelectedValue(this.pagerConditionDropdown, this.model.pageLevel);
			this.setConditionDropdownSelectedValue(this.eventLogConditionDropdown, this.model.eventLogLevel);
			this.setConditionDropdownSelectedValue(this.deleteJobConditionDropdown, this.model.deleteLevel);
			this.emailOperatorDropdown.values = this.model.operators;
			this.pagerOperatorDropdown.values = this.model.operators;
			this.emailCheckBox.checked = false;
			this.pagerCheckBox.checked = false;
			this.eventLogCheckBox.checked = false;
			this.deleteJobCheckBox.checked = false;
			this.emailOperatorDropdown.enabled = false;
			this.pagerOperatorDropdown.enabled = false;
			this.emailConditionDropdown.enabled = false;
			this.pagerConditionDropdown.enabled = false;
			this.eventLogConditionDropdown.enabled = false;
			this.deleteJobConditionDropdown.enabled = false;
		});
	}

	private createRowContainer(view: sqlops.ModelView): sqlops.FlexBuilder {
		return view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			alignItems: 'left',
			justifyContent: 'space-between'
		});
	}

	protected updateModel() {
		this.model.name = this.nameTextBox.value;
		this.model.owner = this.ownerTextBox.value;
		this.model.enabled = this.enabledCheckBox.checked;
		this.model.description = this.descriptionTextBox.value;
		this.model.category = this.getDropdownValue(this.categoryDropdown);
		this.model.emailLevel = this.getActualConditionValue(this.emailCheckBox, this.emailConditionDropdown);
		this.model.operatorToEmail = this.getDropdownValue(this.emailOperatorDropdown);
		this.model.operatorToPage = this.getDropdownValue(this.pagerOperatorDropdown);
		this.model.pageLevel = this.getActualConditionValue(this.pagerCheckBox, this.pagerConditionDropdown);
		this.model.eventLogLevel = this.getActualConditionValue(this.eventLogCheckBox, this.eventLogConditionDropdown);
		this.model.deleteLevel = this.getActualConditionValue(this.deleteJobCheckBox, this.deleteJobConditionDropdown);
	}
}