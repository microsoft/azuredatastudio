/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { JobData } from '../data/jobData';
import { JobStepDialog } from './jobStepDialog';
import { PickScheduleDialog } from './pickScheduleDialog';
import { AlertDialog } from './alertDialog';
import { AgentDialog } from './agentDialog';
import { AgentUtils } from '../agentUtils';
import { JobStepData } from '../data/jobStepData';

const localize = nls.loadMessageBundle();

export class JobDialog extends AgentDialog<JobData>  {

	// TODO: localize
	// Top level
	private static readonly CreateDialogTitle: string = localize('jobDialog.newJob', "New Job");
	private static readonly EditDialogTitle: string = localize('jobDialog.editJob', "Edit Job");
	private readonly GeneralTabText: string = localize('jobDialog.general', "General");
	private readonly StepsTabText: string = localize('jobDialog.steps', "Steps");
	private readonly SchedulesTabText: string = localize('jobDialog.schedules', "Schedules");
	private readonly AlertsTabText: string = localize('jobDialog.alerts', "Alerts");
	private readonly NotificationsTabText: string = localize('jobDialog.notifications', "Notifications");
	private readonly BlankJobNameErrorText: string = localize('jobDialog.blankJobNameError', "The name of the job cannot be blank.");

	// General tab strings
	private readonly NameTextBoxLabel: string = localize('jobDialog.name', "Name");
	private readonly OwnerTextBoxLabel: string = localize('jobDialog.owner', "Owner");
	private readonly CategoryDropdownLabel: string = localize('jobDialog.category', "Category");
	private readonly DescriptionTextBoxLabel: string = localize('jobDialog.description', "Description");
	private readonly EnabledCheckboxLabel: string = localize('jobDialog.enabled', "Enabled");

	// Steps tab strings
	private readonly JobStepsTopLabelString: string = localize('jobDialog.jobStepList', "Job step list");
	private readonly StepsTable_StepColumnString: string = localize('jobDialog.step', "Step");
	private readonly StepsTable_NameColumnString: string = localize('jobDialog.name', "Name");
	private readonly StepsTable_TypeColumnString: string = localize('jobDialog.type', "Type");
	private readonly StepsTable_SuccessColumnString: string = localize('jobDialog.onSuccess', "On Success");
	private readonly StepsTable_FailureColumnString: string = localize('jobDialog.onFailure', "On Failure");
	private readonly NewStepButtonString: string = localize('jobDialog.new', "New Step");
	private readonly EditStepButtonString: string = localize('jobDialog.edit', "Edit Step");
	private readonly DeleteStepButtonString: string = localize('jobDialog.delete', "Delete Step");
	private readonly MoveStepUpButtonString: string = localize('jobDialog.moveUp', "Move Step Up");
	private readonly MoveStepDownButtonString: string = localize('jobDialog.moveDown', "Move Step Down");
	private readonly StartStepDropdownString: string = localize('jobDialog.startStepAt', "Start step");

	// Notifications tab strings
	private readonly NotificationsTabTopLabelString: string = localize('jobDialog.notificationsTabTop', "Actions to perform when the job completes");
	private readonly EmailCheckBoxString: string = localize('jobDialog.email', "Email");
	private readonly PagerCheckBoxString: string = localize('jobDialog.page', "Page");
	private readonly EventLogCheckBoxString: string = localize('jobDialog.eventLogCheckBoxLabel', "Write to the Windows Application event log");
	private readonly DeleteJobCheckBoxString: string = localize('jobDialog.deleteJobLabel', "Automatically delete job");

	// Schedules tab strings
	private readonly SchedulesTopLabelString: string = localize('jobDialog.schedulesaLabel', "Schedules list");
	private readonly PickScheduleButtonString: string = localize('jobDialog.pickSchedule', "Pick Schedule");

	// Alerts tab strings
	private readonly AlertsTopLabelString: string = localize('jobDialog.alertsList', "Alerts list");
	private readonly NewAlertButtonString: string = localize('jobDialog.newAlert', "New Alert");
	private readonly AlertNameLabelString: string = localize('jobDialog.alertNameLabel', "Alert Name");
	private readonly AlertEnabledLabelString: string = localize('jobDialog.alertEnabledLabel', "Enabled");
	private readonly AlertTypeLabelString: string = localize('jobDialog.alertTypeLabel', "Type");

	// Event Name strings
	private readonly NewJobDialogEvent: string = 'NewJobDialogOpened';
	private readonly EditJobDialogEvent: string = 'EditJobDialogOpened';

	// UI Components
	private generalTab: azdata.window.DialogTab;
	private stepsTab: azdata.window.DialogTab;
	private alertsTab: azdata.window.DialogTab;
	private schedulesTab: azdata.window.DialogTab;
	private notificationsTab: azdata.window.DialogTab;

	// General tab controls
	private nameTextBox: azdata.InputBoxComponent;
	private ownerTextBox: azdata.InputBoxComponent;
	private categoryDropdown: azdata.DropDownComponent;
	private descriptionTextBox: azdata.InputBoxComponent;
	private enabledCheckBox: azdata.CheckBoxComponent;

	// Steps tab controls
	private stepsTable: azdata.TableComponent;
	private newStepButton: azdata.ButtonComponent;
	private moveStepUpButton: azdata.ButtonComponent;
	private moveStepDownButton: azdata.ButtonComponent;
	private editStepButton: azdata.ButtonComponent;
	private deleteStepButton: azdata.ButtonComponent;

	// Schedule tab controls
	private removeScheduleButton: azdata.ButtonComponent;

	// Notifications tab controls
	private emailCheckBox: azdata.CheckBoxComponent;
	private emailOperatorDropdown: azdata.DropDownComponent;
	private emailConditionDropdown: azdata.DropDownComponent;
	private pagerCheckBox: azdata.CheckBoxComponent;
	private pagerOperatorDropdown: azdata.DropDownComponent;
	private pagerConditionDropdown: azdata.DropDownComponent;
	private eventLogCheckBox: azdata.CheckBoxComponent;
	private eventLogConditionDropdown: azdata.DropDownComponent;
	private deleteJobCheckBox: azdata.CheckBoxComponent;
	private deleteJobConditionDropdown: azdata.DropDownComponent;
	private startStepDropdown: azdata.DropDownComponent;

	// Schedule tab controls
	private schedulesTable: azdata.TableComponent;
	private pickScheduleButton: azdata.ButtonComponent;

	// Alert tab controls
	private alertsTable: azdata.TableComponent;
	private newAlertButton: azdata.ButtonComponent;
	private isEdit: boolean = false;

	// Job objects
	private steps: azdata.AgentJobStepInfo[];
	private schedules: azdata.AgentJobScheduleInfo[];
	private alerts: azdata.AgentAlertInfo[] = [];
	private startStepDropdownValues: azdata.CategoryValue[] = [];

	constructor(ownerUri: string, jobInfo: azdata.AgentJobInfo = undefined) {
		super(
			ownerUri,
			new JobData(ownerUri, jobInfo),
			jobInfo ? JobDialog.EditDialogTitle : JobDialog.CreateDialogTitle);
		this.steps = this.model.jobSteps ? this.model.jobSteps : [];
		this.schedules = this.model.jobSchedules ? this.model.jobSchedules : [];
		this.alerts = this.model.alerts ? this.model.alerts : [];
		this.isEdit = jobInfo ? true : false;
		this.dialogName = this.isEdit ? this.EditJobDialogEvent : this.NewJobDialogEvent;
	}

	protected async initializeDialog() {
		this.generalTab = azdata.window.createTab(this.GeneralTabText);
		this.stepsTab = azdata.window.createTab(this.StepsTabText);
		this.alertsTab = azdata.window.createTab(this.AlertsTabText);
		this.schedulesTab = azdata.window.createTab(this.SchedulesTabText);
		this.notificationsTab = azdata.window.createTab(this.NotificationsTabText);
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
					// Change the job name immediately since steps
					// depends on the job name
					this.model.name = this.nameTextBox.value;
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
			this.ownerTextBox.value = this.model.owner;
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
			let data = this.steps ? this.convertStepsToData(this.steps) : [];
			this.stepsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						this.StepsTable_StepColumnString,
						this.StepsTable_NameColumnString,
						this.StepsTable_TypeColumnString,
						this.StepsTable_SuccessColumnString,
						this.StepsTable_FailureColumnString
					],
					data: data,
					height: 500
				}).component();

			this.startStepDropdown = view.modelBuilder.dropDown().withProperties({ width: 180 }).component();
			this.startStepDropdown.enabled = this.steps.length >= 1;
			this.steps.forEach((step) => {
				this.startStepDropdownValues.push({ displayName: step.id + ': ' + step.stepName, name: step.id.toString() });
			});
			this.startStepDropdown.values = this.startStepDropdownValues;

			this.moveStepUpButton = view.modelBuilder.button()
				.withProperties({
					label: this.MoveStepUpButtonString,
					title: this.MoveStepUpButtonString,
					width: 120
				}).component();

			this.moveStepDownButton = view.modelBuilder.button()
				.withProperties({
					label: this.MoveStepDownButtonString,
					title: this.MoveStepDownButtonString,
					width: 120
				}).component();

			this.moveStepUpButton.enabled = false;
			this.moveStepDownButton.enabled = false;

			this.newStepButton = view.modelBuilder.button().withProperties({
				label: this.NewStepButtonString,
				title: this.NewStepButtonString,
				width: 140
			}).component();

			this.newStepButton.onDidClick((e) => {
				if (this.nameTextBox.value && this.nameTextBox.value.length > 0) {
					let stepDialog = new JobStepDialog(this.model.ownerUri, '', this.model, null, true);
					stepDialog.onSuccess((step) => {
						let stepInfo = JobStepData.convertToAgentJobStepInfo(step);
						this.steps.push(stepInfo);
						this.stepsTable.data = this.convertStepsToData(this.steps);
						this.startStepDropdownValues = [];
						this.steps.forEach((step) => {
							this.startStepDropdownValues.push({ displayName: step.id + ': ' + step.stepName, name: step.id.toString() });
						});
						this.startStepDropdown.values = this.startStepDropdownValues;
						this.startStepDropdown.enabled = true;
						this.model.jobSteps = this.steps;
					});
					stepDialog.jobName = this.nameTextBox.value;
					stepDialog.openDialog();
				} else {
					this.dialog.message = { text: this.BlankJobNameErrorText };
				}
			});

			this.editStepButton = view.modelBuilder.button().withProperties({
				label: this.EditStepButtonString,
				title: this.EditStepButtonString,
				width: 140
			}).component();

			this.deleteStepButton = view.modelBuilder.button().withProperties({
				label: this.DeleteStepButtonString,
				title: this.DeleteStepButtonString,
				width: 140
			}).component();

			this.stepsTable.enabled = false;
			this.editStepButton.enabled = false;
			this.deleteStepButton.enabled = false;

			this.moveStepUpButton.onDidClick(() => {
				let rowNumber = this.stepsTable.selectedRows[0];
				let previousRow = rowNumber - 1;
				let previousStep = this.steps[previousRow];
				let previousStepId = this.steps[previousRow].id;
				let currentStep = this.steps[rowNumber];
				let currentStepId = this.steps[rowNumber].id;
				this.steps[previousRow] = currentStep;
				this.steps[rowNumber] = previousStep;
				this.stepsTable.data = this.convertStepsToData(this.steps);
				this.steps[previousRow].id = previousStepId;
				this.steps[rowNumber].id = currentStepId;
				this.stepsTable.selectedRows = [previousRow];
			});

			this.moveStepDownButton.onDidClick(() => {
				let rowNumber = this.stepsTable.selectedRows[0];
				let nextRow = rowNumber + 1;
				let nextStep = this.steps[nextRow];
				let nextStepId = this.steps[nextRow].id;
				let currentStep = this.steps[rowNumber];
				let currentStepId = this.steps[rowNumber].id;
				this.steps[nextRow] = currentStep;
				this.steps[rowNumber] = nextStep;
				this.stepsTable.data = this.convertStepsToData(this.steps);
				this.steps[nextRow].id = nextStepId;
				this.steps[rowNumber].id = currentStepId;
				this.stepsTable.selectedRows = [nextRow];
			});

			this.editStepButton.onDidClick(() => {
				if (this.stepsTable.selectedRows.length === 1) {
					let rowNumber = this.stepsTable.selectedRows[0];
					let stepData = this.model.jobSteps[rowNumber];
					let editStepDialog = new JobStepDialog(this.model.ownerUri, '', this.model, stepData, true);
					editStepDialog.onSuccess((step) => {
						let stepInfo = JobStepData.convertToAgentJobStepInfo(step);
						for (let i = 0; i < this.steps.length; i++) {
							if (this.steps[i].id === stepInfo.id) {
								this.steps[i] = stepInfo;
							}
						}
						this.stepsTable.data = this.convertStepsToData(this.steps);
						this.startStepDropdownValues = [];
						this.steps.forEach((step) => {
							this.startStepDropdownValues.push({ displayName: step.id + ': ' + step.stepName, name: step.id.toString() });
						});
						this.startStepDropdown.values = this.startStepDropdownValues;
						this.model.jobSteps = this.steps;
					});
					editStepDialog.openDialog();
				}
			});

			this.deleteStepButton.onDidClick(async () => {
				if (this.stepsTable.selectedRows.length === 1) {
					let rowNumber = this.stepsTable.selectedRows[0];
					AgentUtils.getAgentService().then(async (agentService) => {
						let stepData = this.steps[rowNumber];
						if (stepData.jobId) {
							await agentService.deleteJobStep(this.ownerUri, stepData).then((result) => {
								if (result && result.success) {
									this.steps.splice(rowNumber, 1);
									let data = this.convertStepsToData(this.steps);
									this.stepsTable.data = data;
									this.startStepDropdownValues = [];
									this.steps.forEach((step) => {
										this.startStepDropdownValues.push({ displayName: step.id + ': ' + step.stepName, name: step.id.toString() });
									});
									this.startStepDropdown.values = this.startStepDropdownValues;
								}
							});
						} else {
							this.steps.splice(rowNumber, 1);
							let data = this.convertStepsToData(this.steps);
							this.stepsTable.data = data;
							this.startStepDropdownValues = [];
							this.steps.forEach((step) => {
								this.startStepDropdownValues.push({ displayName: step.id + ': ' + step.stepName, name: step.id.toString() });
							});
							this.startStepDropdown.values = this.startStepDropdownValues;
							this.startStepDropdown.enabled = this.steps.length >= 1;
						}
						this.model.jobSteps = this.steps;
					});
				}
			});

			this.stepsTable.onRowSelected((row) => {
				// only let edit or delete steps if there's
				// one step selection
				if (this.stepsTable.selectedRows.length === 1) {
					let rowNumber = this.stepsTable.selectedRows[0];
					// if it's not the last step
					if (this.steps.length !== rowNumber + 1) {
						this.moveStepDownButton.enabled = true;
					}
					// if it's not the first step
					if (rowNumber !== 0) {
						this.moveStepUpButton.enabled = true;
					}
					this.deleteStepButton.enabled = true;
					this.editStepButton.enabled = true;
				}
			});
			let stepMoveContainer = this.createRowContainer(view).withItems([this.startStepDropdown, this.moveStepUpButton, this.moveStepDownButton]).component();
			let stepsDialogContainer = this.createRowContainer(view).withItems([this.newStepButton, this.editStepButton, this.deleteStepButton]).component();
			let formModel = view.modelBuilder.formContainer().withFormItems([
				{
					component: this.stepsTable,
					title: this.JobStepsTopLabelString
				},
				{
					component: stepMoveContainer,
					title: this.StartStepDropdownString
				},
				{
					component: stepsDialogContainer,
					title: ''
				}
			]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.setConditionDropdownSelectedValue(this.startStepDropdown, this.model.startStepId);
		});
	}

	private initializeAlertsTab() {
		this.alertsTab.registerContent(async view => {
			let alerts = this.model.alerts ? this.model.alerts : [];
			let data = this.convertAlertsToData(alerts);
			this.alertsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						this.AlertNameLabelString,
						this.AlertEnabledLabelString,
						this.AlertTypeLabelString
					],
					data: data,
					height: 750,
					width: 400
				}).component();

			this.newAlertButton = view.modelBuilder.button().withProperties({
				label: this.NewAlertButtonString,
				width: 80
			}).component();

			let alertDialog = new AlertDialog(this.model.ownerUri, this.model, null, true);
			alertDialog.onSuccess((alert) => {
				let alertInfo = alert.toAgentAlertInfo();
				this.alerts.push(alertInfo);
				this.alertsTable.data = this.convertAlertsToData(this.alerts);
			});
			this.newAlertButton.onDidClick(() => {
				if (this.nameTextBox.value && this.nameTextBox.value.length > 0) {
					alertDialog.jobId = this.model.jobId;
					alertDialog.jobName = this.model.name ? this.model.name : this.nameTextBox.value;
					alertDialog.openDialog();
				} else {
					this.dialog.message = { text: this.BlankJobNameErrorText };
				}
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
						PickScheduleDialog.SchedulesIDText,
						PickScheduleDialog.ScheduleNameLabelText,
						PickScheduleDialog.ScheduleDescription
					],
					data: [],
					height: 750,
					width: 420
				}).component();

			this.pickScheduleButton = view.modelBuilder.button().withProperties({
				label: this.PickScheduleButtonString,
				width: 80
			}).component();
			this.removeScheduleButton = view.modelBuilder.button().withProperties({
				label: 'Remove schedule',
				width: 100
			}).component();
			this.pickScheduleButton.onDidClick(() => {
				let pickScheduleDialog = new PickScheduleDialog(this.model.ownerUri, this.model.name);
				pickScheduleDialog.onSuccess((dialogModel) => {
					let selectedSchedule = dialogModel.selectedSchedule;
					if (selectedSchedule) {
						let existingSchedule = this.schedules.find(item => item.name === selectedSchedule.name);
						if (!existingSchedule) {
							selectedSchedule.jobName = this.model.name ? this.model.name : this.nameTextBox.value;
							this.schedules.push(selectedSchedule);
						}
						this.populateScheduleTable();
					}
				});
				pickScheduleDialog.showDialog();
			});
			this.removeScheduleButton.onDidClick(() => {
				if (this.schedulesTable.selectedRows.length === 1) {
					let selectedRow = this.schedulesTable.selectedRows[0];
					let selectedScheduleName = this.schedulesTable.data[selectedRow][1];
					for (let i = 0; i < this.schedules.length; i++) {
						if (this.schedules[i].name === selectedScheduleName) {
							this.schedules.splice(i, 1);
						}
					}
					this.populateScheduleTable();
				}
			});
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.schedulesTable,
					title: this.SchedulesTopLabelString,
					actions: [this.pickScheduleButton, this.removeScheduleButton]
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			this.populateScheduleTable();
		});
	}

	private populateScheduleTable() {
		let data = this.convertSchedulesToData(this.schedules);
		this.schedulesTable.data = data;
		this.schedulesTable.height = 750;

	}

	private initializeNotificationsTab() {
		this.notificationsTab.registerContent(async view => {

			this.emailCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.EmailCheckBoxString,
				width: '20%'
			}).component();

			this.pagerCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.PagerCheckBoxString,
				width: '20%'
			}).component();
			this.eventLogCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.EventLogCheckBoxString,
				width: '5%'
			}).component();
			this.deleteJobCheckBox = view.modelBuilder.checkBox().withProperties({
				label: this.DeleteJobCheckBoxString,
				width: '7%'
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

			this.emailOperatorDropdown = view.modelBuilder.dropDown().withProperties({ width: '90%' }).component();
			this.pagerOperatorDropdown = view.modelBuilder.dropDown().withProperties({ width: '90%' }).component();
			this.emailConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: '80%' }).component();
			this.pagerConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: '80%' }).component();
			this.eventLogConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: '80%' }).component();
			this.deleteJobConditionDropdown = view.modelBuilder.dropDown().withProperties({ width: '85%' }).component();

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
						}], title: this.NotificationsTabTopLabelString
				}]).withLayout({ width: '100%' }).component();

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

	private createRowContainer(view: azdata.ModelView): azdata.FlexBuilder {
		return view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			justifyContent: 'space-between'
		});
	}

	private convertStepsToData(jobSteps: azdata.AgentJobStepInfo[]): Array<string | number>[] {
		let result: Array<string | number>[] = [];
		jobSteps.forEach(jobStep => {
			let cols: Array<string | number> = [];
			cols.push(jobStep.id);
			cols.push(jobStep.stepName);
			cols.push(JobStepData.convertToSubSystemDisplayName(jobStep.subSystem));
			cols.push(JobStepData.convertToCompletionActionDisplayName(jobStep.successAction));
			cols.push(JobStepData.convertToCompletionActionDisplayName(jobStep.failureAction));
			result.push(cols);
		});
		return result;
	}

	private convertSchedulesToData(jobSchedules: azdata.AgentJobScheduleInfo[]): Array<string | number>[] {
		let result: Array<string | number>[] = [];
		jobSchedules.forEach(schedule => {
			let cols = [];
			cols.push(schedule.id);
			cols.push(schedule.name);
			cols.push(schedule.description);
			result.push(cols);
		});
		return result;
	}

	private convertAlertsToData(alerts: azdata.AgentAlertInfo[]): Array<string | boolean>[] {
		let result: Array<string | boolean>[] = [];
		alerts.forEach(alert => {
			let cols = [];
			cols.push(alert.name);
			cols.push(alert.isEnabled);
			cols.push(alert.alertType.toString());
			result.push(cols);
		});
		return result;
	}

	protected async updateModel(): Promise<void> {
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
		this.model.startStepId = this.startStepDropdown.enabled ? +this.getDropdownValue(this.startStepDropdown) : 1;
		if (!this.model.jobSteps) {
			this.model.jobSteps = [];
		}
		this.model.jobSteps = this.steps;
		// Change the last step's success action to quit because the
		// default is "Go To Next Step"
		if (this.model.jobSteps.length > 0) {
			this.model.jobSteps[this.model.jobSteps.length - 1].successAction = azdata.StepCompletionAction.QuitWithSuccess;
		}
		if (!this.model.jobSchedules) {
			this.model.jobSchedules = [];
		}
		this.model.jobSchedules = this.schedules;
		if (!this.model.alerts) {
			this.model.alerts = [];
		}
		this.model.alerts = this.alerts;
		this.model.categoryId = +this.model.jobCategoryIdsMap.find(cat => cat.name === this.model.category).id;
	}
}
