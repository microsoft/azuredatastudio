/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { JobStepData } from '../data/jobStepData';
import { AgentUtils } from '../agentUtils';
import { JobData } from '../data/jobData';
const path = require('path');

const localize = nls.loadMessageBundle();

export class JobStepDialog {

	// TODO: localize
	// Top level
	//
	private static readonly DialogTitle: string = 'New Job Step';
	private static readonly FileBrowserDialogTitle: string = 'Locate Database Files - ';
	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';
	private static readonly GeneralTabText: string = 'General';
	private static readonly AdvancedTabText: string = 'Advanced';
	private static readonly OpenCommandText: string = 'Open...';
	private static readonly ParseCommandText: string = 'Parse';
	private static readonly NextButtonText: string = 'Next';
	private static readonly PreviousButtonText: string = 'Previous';
	private static readonly SuccessAction: string = 'On success action';
	private static readonly FailureAction: string = 'On failure action';
	private static readonly RunAsUser: string = 'Run as user';


	// Dropdown options
	private static readonly TSQLScript: string = 'Transact-SQL script (T-SQL)';
	private static readonly AgentServiceAccount: string = 'SQL Server Agent Service Account';
	private static readonly NextStep: string = 'Go to the next step';
	private static readonly QuitJobReportingSuccess: string = 'Quit the job reporting success';
	private static readonly QuitJobReportingFailure: string = 'Quit the job reporting failure';

	// UI Components

	// Dialogs
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private fileBrowserDialog: sqlops.window.modelviewdialog.Dialog;

	// Dialog tabs
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private advancedTab: sqlops.window.modelviewdialog.DialogTab;

	//Input boxes
	private nameTextBox: sqlops.InputBoxComponent;
	private commandTextBox: sqlops.InputBoxComponent;
	private selectedPathTextBox: sqlops.InputBoxComponent;
	private retryAttemptsBox: sqlops.InputBoxComponent;
	private retryIntervalBox: sqlops.InputBoxComponent;
	private outputFileNameBox: sqlops.InputBoxComponent;
	private fileBrowserNameBox: sqlops.InputBoxComponent;
	private userInputBox: sqlops.InputBoxComponent;

	// Dropdowns
	private typeDropdown: sqlops.DropDownComponent;
	private runAsDropdown: sqlops.DropDownComponent;
	private databaseDropdown: sqlops.DropDownComponent;
	private successActionDropdown: sqlops.DropDownComponent;
	private failureActionDropdown: sqlops.DropDownComponent;
	private fileTypeDropdown: sqlops.DropDownComponent;

	// Buttons
	private openButton: sqlops.ButtonComponent;
	private parseButton: sqlops.ButtonComponent;
	private nextButton: sqlops.ButtonComponent;
	private previousButton: sqlops.ButtonComponent;
	private outputFileBrowserButton: sqlops.ButtonComponent;

	// Checkbox
	private appendToExistingFileCheckbox: sqlops.CheckBoxComponent;
	private logToTableCheckbox: sqlops.CheckBoxComponent;

	private fileBrowserTree: sqlops.FileBrowserTreeComponent;
	private jobModel: JobData;
	private model: JobStepData;
	private ownerUri: string;
	private jobName: string;
	private server: string;
	private stepId: number;

	constructor(
		ownerUri: string,
		jobName: string,
		server: string,
		stepId: number,
		jobModel?: JobData
	) {
		this.model = new JobStepData(ownerUri);
		this.stepId = stepId;
		this.ownerUri = ownerUri;
		this.jobName = jobName;
		this.server = server;
		this.jobModel = jobModel;
	}

	private initializeUIComponents() {
		this.dialog = sqlops.window.modelviewdialog.createDialog(JobStepDialog.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(JobStepDialog.GeneralTabText);
		this.advancedTab = sqlops.window.modelviewdialog.createTab(JobStepDialog.AdvancedTabText);
		this.dialog.content = [this.generalTab, this.advancedTab];
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.okButton.label = JobStepDialog.OkButtonText;
		this.dialog.cancelButton.label = JobStepDialog.CancelButtonText;
	}

	private createCommands(view, queryProvider: sqlops.QueryProvider) {
		this.openButton = view.modelBuilder.button()
			.withProperties({
				label: JobStepDialog.OpenCommandText,
				width: '80px'
			}).component();
		this.parseButton = view.modelBuilder.button()
			.withProperties({
				label: JobStepDialog.ParseCommandText,
				width: '80px'
			}).component();
		this.parseButton.onDidClick(e => {
			if (this.commandTextBox.value) {
				queryProvider.parseSyntax(this.ownerUri, this.commandTextBox.value).then(result => {
					if (result && result.parseable) {
						this.dialog.message = { text: 'The command was successfully parsed.', level: 2};
					} else if (result && !result.parseable) {
						this.dialog.message = { text: 'The command failed' };
					}
				});
			}
		});
		this.commandTextBox = view.modelBuilder.inputBox()
			.withProperties({
				height: 300,
				width: 400,
				multiline: true,
				inputType: 'text'
			})
			.component();
		this.nextButton = view.modelBuilder.button()
			.withProperties({
				label: JobStepDialog.NextButtonText,
				enabled: false,
				width: '80px'
			}).component();
		this.previousButton = view.modelBuilder.button()
			.withProperties({
				label: JobStepDialog.PreviousButtonText,
				enabled: false,
				width: '80px'
			}).component();
	}

	private createGeneralTab(databases: string[], queryProvider: sqlops.QueryProvider) {
		this.generalTab.registerContent(async (view) => {
			this.nameTextBox = view.modelBuilder.inputBox()
				.withProperties({
				}).component();
			this.nameTextBox.required = true;
			this.typeDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: JobStepDialog.TSQLScript,
					values: [JobStepDialog.TSQLScript]
				})
				.component();
			this.runAsDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: '',
					values: ['']
				})
				.component();
			this.runAsDropdown.enabled = false;
			this.typeDropdown.onValueChanged((type) => {
				if (type.selected !== JobStepDialog.TSQLScript) {
					this.runAsDropdown.value = JobStepDialog.AgentServiceAccount;
					this.runAsDropdown.values = [this.runAsDropdown.value];
				} else {
					this.runAsDropdown.value = '';
					this.runAsDropdown.values = [''];
				}
			});
			this.databaseDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases
				}).component();

			// create the commands section
			this.createCommands(view, queryProvider);

			let buttonContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				justifyContent: 'space-between',
				width: 420
			}).withItems([this.openButton, this.parseButton, this.previousButton, this.nextButton], {
				flex: '1 1 50%'
			}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: 'Step name'
				}, {
					component: this.typeDropdown,
					title: 'Type'
				}, {
					component: this.runAsDropdown,
					title: 'Run as'
				}, {
					component: this.databaseDropdown,
					title: 'Database'
				}, {
					component: this.commandTextBox,
					title: 'Command',
					actions: [buttonContainer]
				}], {
						horizontal: false,
						componentWidth: 420
					}).component();
			let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
			formWrapper.loading = false;
			await view.initializeModel(formWrapper);
		});
	}

	private createAdvancedTab() {
		this.advancedTab.registerContent(async (view) => {
			this.successActionDropdown = view.modelBuilder.dropDown()
				.withProperties({
					width: '100%',
					value: JobStepDialog.NextStep,
					values: [JobStepDialog.NextStep, JobStepDialog.QuitJobReportingSuccess, JobStepDialog.QuitJobReportingFailure]
				})
				.component();
			let retryFlexContainer = this.createRetryCounters(view);

			this.failureActionDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: JobStepDialog.QuitJobReportingFailure,
					values: [JobStepDialog.QuitJobReportingFailure, JobStepDialog.NextStep, JobStepDialog.QuitJobReportingSuccess]
				})
				.component();
			let optionsGroup = this.createTSQLOptions(view);
			this.logToTableCheckbox = view.modelBuilder.checkBox()
				.withProperties({
					label: 'Log to table'
				}).component();
			let appendToExistingEntryInTableCheckbox = view.modelBuilder.checkBox()
				.withProperties({ label: 'Append output to existing entry in table' }).component();
			appendToExistingEntryInTableCheckbox.enabled = false;
			this.logToTableCheckbox.onChanged(e => {
				appendToExistingEntryInTableCheckbox.enabled = e;
			});
			let appendCheckboxContainer = view.modelBuilder.groupContainer()
				.withItems([appendToExistingEntryInTableCheckbox]).component();
			let logToTableContainer = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'row', justifyContent: 'space-between', width: 300 })
				.withItems([this.logToTableCheckbox]).component();
			let logStepOutputHistoryCheckbox = view.modelBuilder.checkBox()
				.withProperties({ label: 'Include step output in history' }).component();
			this.userInputBox = view.modelBuilder.inputBox()
				.withProperties({ inputType: 'text', width: '100%' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems(
					[{
						component: this.successActionDropdown,
						title: JobStepDialog.SuccessAction
					}, {
						component: retryFlexContainer,
						title: ''
					}, {
						component: this.failureActionDropdown,
						title: JobStepDialog.FailureAction
					}, {
						component: optionsGroup,
						title: 'Transact-SQL script (T-SQL)'
					}, {
						component: logToTableContainer,
						title: ''
					}, {
						component: appendCheckboxContainer,
						title: '                            '
					}, {
						component: logStepOutputHistoryCheckbox,
						title: ''
					}, {
						component: this.userInputBox,
						title: JobStepDialog.RunAsUser
					}], {
						componentWidth: 400
					}).component();

			let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
			formWrapper.loading = false;
			view.initializeModel(formWrapper);
		});
	}

	private createRetryCounters(view) {
		this.retryAttemptsBox = view.modelBuilder.inputBox()
		.withValidation(component => component.value >= 0)
		.withProperties({
			inputType: 'number',
			width: '100%'
		})
		.component();
		this.retryIntervalBox = view.modelBuilder.inputBox()
			.withValidation(component => component.value >= 0)
			.withProperties({
				inputType: 'number',
				width: '100%'
			}).component();

		let retryAttemptsContainer = view.modelBuilder.formContainer()
			.withFormItems(
			[{
				component: this.retryAttemptsBox,
				title: 'Retry Attempts'
			}], {
				horizontal: false,
				componentWidth: '100%'
			})
			.component();

		let retryIntervalContainer = view.modelBuilder.formContainer()
			.withFormItems(
				[{
					component: this.retryIntervalBox,
					title: 'Retry Interval (minutes)'
					}], {
					horizontal: false
				})
			.component();

		let retryFlexContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
			}).withItems([retryAttemptsContainer, retryIntervalContainer]).component();
		return retryFlexContainer;
	}

	private openFileBrowserDialog() {
		let fileBrowserTitle = JobStepDialog.FileBrowserDialogTitle + `${this.server}`;
		this.fileBrowserDialog = sqlops.window.modelviewdialog.createDialog(fileBrowserTitle);
		let fileBrowserTab = sqlops.window.modelviewdialog.createTab('File Browser');
		this.fileBrowserDialog.content =  [fileBrowserTab];
		fileBrowserTab.registerContent(async (view) => {
			this.fileBrowserTree = view.modelBuilder.fileBrowserTree()
				.withProperties({ ownerUri: this.ownerUri, width: 420, height: 700 })
				.component();
			this.selectedPathTextBox = view.modelBuilder.inputBox()
				.withProperties({ inputType: 'text'})
				.component();
			this.fileBrowserTree.onDidChange((args) => {
				this.selectedPathTextBox.value = args.fullPath;
				this.fileBrowserNameBox.value = args.isFile ? path.win32.basename(args.fullPath) : '';
			});
			this.fileTypeDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: 'All Files (*)',
					values: ['All Files (*)']
				})
				.component();
			this.fileBrowserNameBox = view.modelBuilder.inputBox()
				.withProperties({})
				.component();
			let fileBrowserContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.fileBrowserTree,
					title: ''
				}, {
					component: this.selectedPathTextBox,
					title: 'Selected path:'
				}, {
					component: this.fileTypeDropdown,
					title: 'Files of type:'
				}, {
					component: this.fileBrowserNameBox,
					title: 'File name:'
				}
			]).component();
			view.initializeModel(fileBrowserContainer);
		});
		this.fileBrowserDialog.okButton.onClick(() => {
			this.outputFileNameBox.value = path.join(path.dirname(this.selectedPathTextBox.value), this.fileBrowserNameBox.value);
		});
		this.fileBrowserDialog.okButton.label = JobStepDialog.OkButtonText;
		this.fileBrowserDialog.cancelButton.label = JobStepDialog.CancelButtonText;
		sqlops.window.modelviewdialog.openDialog(this.fileBrowserDialog);
	}

	private createTSQLOptions(view) {
		this.outputFileBrowserButton = view.modelBuilder.button()
			.withProperties({ width: '20px', label: '...' }).component();
		this.outputFileBrowserButton.onDidClick(() => this.openFileBrowserDialog());
		this.outputFileNameBox = view.modelBuilder.inputBox()
			.withProperties({
				width: 250,
				inputType: 'text'
			}).component();
		let outputButtonContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				textAlign: 'right',
				width: '100%'
			}).withItems([this.outputFileBrowserButton], { flex: '1 1 50%' }).component();
		let outputFlexBox = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				width: 350
			}).withItems([this.outputFileNameBox, outputButtonContainer], {
				flex: '1 1 50%'
			}).component();
		this.appendToExistingFileCheckbox = view.modelBuilder.checkBox()
			.withProperties({
				label: 'Append output to existing file'
			}).component();
		this.appendToExistingFileCheckbox.enabled = false;
		this.outputFileNameBox.onTextChanged((input) => {
			if (input !== '') {
				this.appendToExistingFileCheckbox.enabled = true;
			} else {
				this.appendToExistingFileCheckbox.enabled = false;
			}
		});
		let outputFileForm = view.modelBuilder.formContainer()
			.withFormItems([{
				component: outputFlexBox,
				title: 'Output file'
			}, {
				component: this.appendToExistingFileCheckbox,
				title: ''
			}], { horizontal: false, componentWidth: 200 }).component();
		return outputFileForm;
	}

	private async execute() {
		this.model.jobName = this.jobName;
		this.model.id = this.stepId;
		this.model.server = this.server;
		this.model.stepName = this.nameTextBox.value;
		this.model.subSystem = this.typeDropdown.value as string;
		this.model.databaseName = this.databaseDropdown.value as string;
		this.model.script = this.commandTextBox.value;
		this.model.successAction = this.successActionDropdown.value as string;
		this.model.retryAttempts = this.retryAttemptsBox.value ? +this.retryAttemptsBox.value : 0;
		this.model.retryInterval = +this.retryIntervalBox.value ? +this.retryIntervalBox.value : 0;
		this.model.failureAction = this.failureActionDropdown.value as string;
		this.model.outputFileName = this.outputFileNameBox.value;
		this.model.appendToLogFile = this.appendToExistingFileCheckbox.checked;
		await this.model.save();
	}

	public async openNewStepDialog() {
		let databases = await AgentUtils.getDatabases(this.ownerUri);
		let queryProvider = await AgentUtils.getQueryProvider();
		this.initializeUIComponents();
		this.createGeneralTab(databases, queryProvider);
		this.createAdvancedTab();
		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}
}