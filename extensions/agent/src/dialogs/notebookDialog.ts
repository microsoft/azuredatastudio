/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as azdata from 'azdata';
import { PickScheduleDialog } from './pickScheduleDialog';
import { AgentDialog } from './agentDialog';
import { AgentUtils } from '../agentUtils';
import { NotebookData } from '../data/notebookData';

const localize = nls.loadMessageBundle();

export class NotebookDialogOptions {
	notebookInfo?: azdata.AgentNotebookInfo;
	filePath?: string;
	connection?: azdata.connection.Connection;
}

export class NotebookDialog extends AgentDialog<NotebookData>  {

	// TODO: localize
	// Top level
	private static readonly CreateDialogTitle: string = localize('notebookDialog.newJob', 'New Notebook Job');
	private static readonly EditDialogTitle: string = localize('notebookDialog.editJob', 'Edit Notebook Job');
	private readonly GeneralTabText: string = localize('notebookDialog.general', 'General');
	private readonly BlankJobNameErrorText: string = localize('notebookDialog.blankJobNameError', 'The name of the job cannot be blank.');

	// Notebook details strings
	private readonly NotebookDetailsSeparatorTitle: string = localize('notebookDialog.notebookSection', "Notebook Details");
	private readonly TemplateNotebookTextBoxLabel: string = localize('notebookDialog.templateNotebook', 'Notebook Path');
	private readonly TargetDatabaseDropdownLabel: string = localize('notebookDialog.targetDatabase', 'Storage Database');
	private readonly ExecuteDatabaseDropdownLabel: string = localize('notebookDialog.executeDatabase', 'Execution Database');

	// Job details string
	private readonly JobDetailsSeparatorTitle: string = localize('notebookDialog.jobSection', "Job Details");
	private readonly NameTextBoxLabel: string = localize('notebookDialog.name', 'Name');
	private readonly OwnerTextBoxLabel: string = localize('notebookDialog.owner', 'Owner');
	private readonly SchedulesTopLabelString: string = localize('notebookDialog.schedulesaLabel', 'Schedules list');
	private readonly PickScheduleButtonString: string = localize('notebookDialog.pickSchedule', 'Pick Schedule');
	private readonly ScheduleNameLabelString: string = localize('notebookDialog.scheduleNameLabel', 'Schedule Name');
	private readonly DescriptionTextBoxLabel: string = localize('notebookDialog.description', 'Description');

	// Event Name strings
	private readonly NewJobDialogEvent: string = 'NewNotebookJobDialogOpened';
	private readonly EditJobDialogEvent: string = 'EditNotebookJobDialogOpened';

	// UI Components
	private generalTab: azdata.window.DialogTab;

	// Notebook Details controls
	private templateFilePathBox: azdata.InputBoxComponent;
	private openTemplateFileButton: azdata.ButtonComponent;
	private targetDatabaseDropDown: azdata.DropDownComponent;
	private executeDatabaseDropDown: azdata.DropDownComponent;

	// Job Details controls

	private nameTextBox: azdata.InputBoxComponent;
	private ownerTextBox: azdata.InputBoxComponent;
	private schedulesTable: azdata.TableComponent;
	private pickScheduleButton: azdata.ButtonComponent;
	private removeScheduleButton: azdata.ButtonComponent;
	private descriptionTextBox: azdata.InputBoxComponent;



	private isEdit: boolean = false;

	// Job objects
	private steps: azdata.AgentJobStepInfo[];
	private schedules: azdata.AgentJobScheduleInfo[];

	constructor(ownerUri: string, options: NotebookDialogOptions = undefined) {
		super(
			ownerUri,
			new NotebookData(ownerUri, options),
			options.notebookInfo ? NotebookDialog.EditDialogTitle : NotebookDialog.CreateDialogTitle);
		this.steps = this.model.jobSteps ? this.model.jobSteps : [];
		this.schedules = this.model.jobSchedules ? this.model.jobSchedules : [];
		this.isEdit = options.notebookInfo ? true : false;
		this.dialogName = this.isEdit ? this.EditJobDialogEvent : this.NewJobDialogEvent;
	}

	protected async initializeDialog() {
		this.generalTab = azdata.window.createTab(this.GeneralTabText);
		this.initializeGeneralTab();
		this.dialog.content = [this.generalTab];
		this.dialog.registerCloseValidator(() => {
			this.updateModel();
			let validationResult = this.model.validate();
			if (!validationResult.valid) {
				// TODO: Show Error Messages
				this.dialog.message = { text: validationResult.errorMessages[0] };
				console.error(validationResult.errorMessages.join(','));
			}

			return validationResult.valid;
		});
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {
			this.templateFilePathBox = view.modelBuilder.inputBox()
				.withProperties({
					width: 400,
					inputType: 'text'
				}).component();
			this.openTemplateFileButton = view.modelBuilder.button()
				.withProperties({
					label: '...',
					title: '...',
					width: '20px',
					isFile: true,
					fileType: '.ipynb'
				}).component();
			this.openTemplateFileButton.onDidClick(e => {
				if (e) {
					this.templateFilePathBox.value = e.filePath;
					if (!this.isEdit) {
						let fileName = path.basename(e.filePath).split('.').slice(0, -1).join('.');
						this.nameTextBox.value = fileName;
					}
				}
			});
			let outputButtonContainer = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'row',
					textAlign: 'right',
					width: 20
				}).withItems([this.openTemplateFileButton], { flex: '1 1 80%' }).component();
			let notebookPathFlexBox = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'row',
					width: '100%'
				}).withItems([this.templateFilePathBox, outputButtonContainer], {
					flex: '1 1 50%'
				}).component();
			this.targetDatabaseDropDown = view.modelBuilder.dropDown().component();
			this.executeDatabaseDropDown = view.modelBuilder.dropDown().component();
			let databases = await AgentUtils.getDatabases(this.ownerUri);
			databases.unshift('Select Database');
			this.targetDatabaseDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases
				}).component();
			this.descriptionTextBox = view.modelBuilder.inputBox().withProperties({
				multiline: true,
				height: 50
			}).component();
			this.executeDatabaseDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases
				}).component();
			this.targetDatabaseDropDown.required = true;
			this.executeDatabaseDropDown.required = true;
			this.descriptionTextBox = view.modelBuilder.inputBox().withProperties({
				multiline: true,
				height: 50
			}).component();
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
			this.schedulesTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						PickScheduleDialog.SchedulesIDText,
						PickScheduleDialog.ScheduleNameLabelText,
						PickScheduleDialog.ScheduleDescription
					],
					data: [],
					height: 50,
					width: 420
				}).component();

			this.pickScheduleButton = view.modelBuilder.button().withProperties({
				label: this.PickScheduleButtonString,
				width: 100
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
				.withFormItems([
					{
						components: [{
							component: notebookPathFlexBox,
							title: this.TemplateNotebookTextBoxLabel
						}, {
							component: this.targetDatabaseDropDown,
							title: this.TargetDatabaseDropdownLabel
						}, {
							component: this.executeDatabaseDropDown,
							title: this.ExecuteDatabaseDropdownLabel
						}],
						title: this.NotebookDetailsSeparatorTitle
					}, {
						components: [{
							component: this.nameTextBox,
							title: this.NameTextBoxLabel
						}, {
							component: this.ownerTextBox,
							title: this.OwnerTextBoxLabel
						}, {
							component: this.schedulesTable,
							title: this.SchedulesTopLabelString,
							actions: [this.pickScheduleButton, this.removeScheduleButton]
						}, {
							component: this.descriptionTextBox,
							title: this.DescriptionTextBoxLabel
						}],
						title: this.JobDetailsSeparatorTitle
					}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);



			this.nameTextBox.value = this.model.name;
			this.ownerTextBox.value = this.model.owner;
			this.templateFilePathBox.value = this.model.templatePath;
			if (this.isEdit) {
				this.templateFilePathBox.placeHolder = this.model.targetDatabase + '\\' + this.model.name;
				this.targetDatabaseDropDown.value = this.model.targetDatabase;
				this.executeDatabaseDropDown.value = this.model.executeDatabase;
				this.targetDatabaseDropDown.enabled = false;
				this.schedules = this.model.jobSchedules;
			}
			else {
				this.templateFilePathBox.required = true;
			}
			let idx: number = undefined;
			if (this.model.category && this.model.category !== '') {
				idx = this.model.jobCategories.indexOf(this.model.category);
			}
			this.descriptionTextBox.value = this.model.description;
			this.openTemplateFileButton.onDidClick(e => {
			});
			this.populateScheduleTable();
		});
	}

	private populateScheduleTable() {
		let data = this.convertSchedulesToData(this.schedules);
		this.schedulesTable.data = data;
		this.schedulesTable.height = 100;

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
		this.model.name = this.nameTextBox.value;
		this.model.owner = this.ownerTextBox.value;
		this.model.description = this.descriptionTextBox.value;
		this.model.templatePath = this.templateFilePathBox.value;
		this.model.targetDatabase = this.targetDatabaseDropDown.value as string;
		this.model.executeDatabase = this.executeDatabaseDropDown.value as string;
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
