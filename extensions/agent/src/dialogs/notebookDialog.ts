/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as nls from 'vscode-nls';
import * as fs from 'fs';
import * as azdata from 'azdata';
import { JobData } from '../data/jobData';
import { JobStepDialog } from './jobStepDialog';
import { PickScheduleDialog } from './pickScheduleDialog';
import { AlertDialog } from './alertDialog';
import { AgentDialog } from './agentDialog';
import { AgentUtils } from '../agentUtils';
import { JobStepData } from '../data/jobStepData';
import { NotebookData } from '../data/notebookData';


const localize = nls.loadMessageBundle();

export class NotebookDialog extends AgentDialog<NotebookData>  {

	// TODO: localize
	// Top level
	private static readonly CreateDialogTitle: string = localize('jobDialog.newJob', 'New Notebook');
	private static readonly EditDialogTitle: string = localize('jobDialog.editJob', 'Edit Notebook');
	private readonly GeneralTabText: string = localize('jobDialog.general', 'General');
	private readonly SchedulesTabText: string = localize('jobDialog.schedules', 'Schedules');
	private readonly BlankJobNameErrorText: string = localize('jobDialog.blankJobNameError', 'The name of the job cannot be blank.');

	// General tab strings
	private readonly NameTextBoxLabel: string = localize('jobDialog.name', 'Name');
	private readonly OwnerTextBoxLabel: string = localize('jobDialog.owner', 'Owner');
	private readonly TargetDatabaseDropdownLabel: string = localize('jobDialog.targetDatabase', 'Target Database');
	private readonly TemplateNotebookTextBoxLabel: string = localize('jobDialog.templateNotebook', 'Template Notebook');
	private readonly DescriptionTextBoxLabel: string = localize('jobDialog.description', 'Description');
	private readonly EnabledCheckboxLabel: string = localize('jobDialog.enabled', 'Enabled');

	// Schedules tab strings
	private readonly SchedulesTopLabelString: string = localize('jobDialog.schedulesaLabel', 'Schedules list');
	private readonly PickScheduleButtonString: string = localize('jobDialog.pickSchedule', 'Pick Schedule');
	private readonly ScheduleNameLabelString: string = localize('jobDialog.scheduleNameLabel', 'Schedule Name');

	// Event Name strings
	private readonly NewJobDialogEvent: string = 'NewJobDialogOpened';
	private readonly EditJobDialogEvent: string = 'EditJobDialogOpened';

	// UI Components
	private generalTab: azdata.window.DialogTab;
	private schedulesTab: azdata.window.DialogTab;

	// General tab controls
	private nameTextBox: azdata.InputBoxComponent;
	private ownerTextBox: azdata.InputBoxComponent;
	private targetDatabaseDropDown: azdata.DropDownComponent;
	private TemplateFilePathBox: azdata.InputBoxComponent;
	private openTemplateFileButton: azdata.ButtonComponent;
	private descriptionTextBox: azdata.InputBoxComponent;
	private enabledCheckBox: azdata.CheckBoxComponent;

	// Schedule tab controls
	private removeScheduleButton: azdata.ButtonComponent;

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

	constructor(ownerUri: string, notebookInfo: azdata.AgentNotebookInfo = undefined) {
		super(
			ownerUri,
			new NotebookData(ownerUri, notebookInfo),
			notebookInfo ? NotebookDialog.EditDialogTitle : NotebookDialog.CreateDialogTitle);
		this.steps = this.model.jobSteps ? this.model.jobSteps : [];
		this.schedules = this.model.jobSchedules ? this.model.jobSchedules : [];
		this.alerts = this.model.alerts ? this.model.alerts : [];
		this.isEdit = notebookInfo ? true : false;
		this.dialogName = this.isEdit ? this.EditJobDialogEvent : this.NewJobDialogEvent;
	}

	protected async initializeDialog() {
		this.generalTab = azdata.window.createTab(this.GeneralTabText);
		this.schedulesTab = azdata.window.createTab(this.SchedulesTabText);
		this.initializeGeneralTab();
		this.initializeSchedulesTab();
		this.dialog.content = [this.generalTab, this.schedulesTab];
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
			this.targetDatabaseDropDown = view.modelBuilder.dropDown().component();
			this.dialog.okButton.enabled = false;
			this.TemplateFilePathBox = view.modelBuilder.inputBox().component();
			this.TemplateFilePathBox.onTextChanged(() => {
				if (this.TemplateFilePathBox.value && this.TemplateFilePathBox.value.length > 0) {
					this.dialog.okButton.enabled = true;
				}
				else {
					this.dialog.okButton.enabled = false;
				}
			});
			this.openTemplateFileButton = view.modelBuilder.button()
				.withProperties({
					label: this.TemplateNotebookTextBoxLabel,
					title: this.TemplateNotebookTextBoxLabel,
					width: '130px',
					isFile: true,
					fileType: '.ipynb'
				}).component();
			this.TemplateFilePathBox.required = true;
			this.TemplateFilePathBox.enabled = false;
			this.openTemplateFileButton.onDidClick(e => {
				if (e) {
					this.TemplateFilePathBox.value = e.filePath;
				}
			});
			let databases = await AgentUtils.getDatabases(this.ownerUri);
			this.targetDatabaseDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases
				}).component();
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
					component: this.targetDatabaseDropDown,
					title: this.TargetDatabaseDropdownLabel
				}, {
					component: this.TemplateFilePathBox,
					title: this.TemplateNotebookTextBoxLabel,
					actions: [this.openTemplateFileButton]
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
			//this.categoryDropdown.values = this.model.jobCategories;
			if (this.isEdit) {
				this.TemplateFilePathBox.required = false;
				this.targetDatabaseDropDown.value = this.model.targetDatabase;
				this.targetDatabaseDropDown.enabled = false;
			}
			let idx: number = undefined;
			if (this.model.category && this.model.category !== '') {
				idx = this.model.jobCategories.indexOf(this.model.category);
			}
			//this.categoryDropdown.value = this.model.jobCategories[idx > 0 ? idx : 0];

			this.enabledCheckBox.checked = this.model.enabled;
			this.descriptionTextBox.value = this.model.description;
			this.openTemplateFileButton.onDidClick(e => {
				console.log(e);

			});
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

	private createRowContainer(view: azdata.ModelView): azdata.FlexBuilder {
		return view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			alignItems: 'left',
			justifyContent: 'space-between'
		});
	}
	private convertSchedulesToData(jobSchedules: azdata.AgentJobScheduleInfo[]): any[][] {
		let result = [];
		jobSchedules.forEach(schedule => {
			let cols = [];
			cols.push(schedule.id);
			cols.push(schedule.name);
			cols.push(schedule.description);
			result.push(cols);
		});
		return result;
	}

	protected updateModel() {
		console.log(this);
		this.model.name = this.nameTextBox.value;
		this.model.owner = this.ownerTextBox.value;
		this.model.enabled = this.enabledCheckBox.checked;
		this.model.description = this.descriptionTextBox.value;
		this.model.templatePath = this.TemplateFilePathBox.value;
		this.model.targetDatabase = this.targetDatabaseDropDown.value as string;
		if (!this.model.jobSchedules) {
			this.model.jobSchedules = [];
		}
		this.model.alerts = [];
		this.model.jobSteps = [];
		this.model.jobSchedules = this.schedules;
		this.model.category = '[Uncategorized (Local)]';
		this.model.categoryId = 0;
		this.model.eventLogLevel = 0;

	}
}