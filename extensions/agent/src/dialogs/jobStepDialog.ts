/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { JobStepData } from '../data/jobStepData';
import { AgentUtils } from '../agentUtils';
import { JobData } from '../data/jobData';
import { AgentDialog } from './agentDialog';
import { AgentDialogMode } from '../interfaces';
const path = require('path');

const localize = nls.loadMessageBundle();

export class JobStepDialog extends AgentDialog<JobStepData> {

	// TODO: localize
	// Top level
	//
	private static readonly NewDialogTitle: string = localize('jobStepDialog.newJobStep', 'New Job Step');
	private static readonly EditDialogTitle: string = localize('jobStepDialog.editJobStep', 'Edit Job Step');
	private readonly FileBrowserDialogTitle: string = localize('jobStepDialog.fileBrowserTitle', 'Locate Database Files - ');
	private readonly OkButtonText: string = localize('jobStepDialog.ok', 'OK');
	private readonly CancelButtonText: string = localize('jobStepDialog.cancel', 'Cancel');
	private readonly GeneralTabText: string = localize('jobStepDialog.general', 'General');
	private readonly AdvancedTabText: string = localize('jobStepDialog.advanced', 'Advanced');
	private readonly OpenCommandText: string = localize('jobStepDialog.open', 'Open...');
	private readonly ParseCommandText: string = localize('jobStepDialog.parse', 'Parse');
	private readonly SuccessfulParseText: string = localize('jobStepDialog.successParse', 'The command was successfully parsed.');
	private readonly FailureParseText: string = localize('jobStepDialog.failParse', 'The command failed.');
	private readonly BlankStepNameErrorText: string = localize('jobStepDialog.blankStepName', 'The step name cannot be left blank');
	private readonly ProcessExitCodeText: string = localize('jobStepDialog.processExitCode', 'Process exit code of a successful command:');

	// General Control Titles
	private readonly StepNameLabelString: string = localize('jobStepDialog.stepNameLabel', 'Step Name');
	private readonly TypeLabelString: string = localize('jobStepDialog.typeLabel', 'Type');
	private readonly RunAsLabelString: string = localize('jobStepDialog.runAsLabel', 'Run as');
	private readonly DatabaseLabelString: string = localize('jobStepDialog.databaseLabel', 'Database');
	private readonly CommandLabelString: string = localize('jobStepDialog.commandLabel', 'Command');

	// Advanced Control Titles
	private readonly SuccessActionLabel: string = localize('jobStepDialog.successAction', 'On success action');
	private readonly FailureActionLabel: string = localize('jobStepDialog.failureAction', 'On failure action');
	private readonly RunAsUserLabel: string = localize('jobStepDialog.runAsUser', 'Run as user');
	private readonly RetryAttemptsLabel: string = localize('jobStepDialog.retryAttempts', 'Retry Attempts');
	private readonly RetryIntervalLabel: string = localize('jobStepDialog.retryInterval', 'Retry Interval (minutes)');
	private readonly LogToTableLabel: string = localize('jobStepDialog.logToTable', 'Log to table');
	private readonly AppendExistingTableEntryLabel: string = localize('jobStepDialog.appendExistingTableEntry', 'Append output to exisiting entry in table');
	private readonly IncludeStepOutputHistoryLabel: string = localize('jobStepDialog.includeStepOutputHistory', 'Include step output in history');
	private readonly OutputFileNameLabel: string = localize('jobStepDialog.outputFile', 'Output File');
	private readonly AppendOutputToFileLabel: string = localize('jobStepDialog.appendOutputToFile', 'Append output to existing file');

	// File Browser Control Titles
	private readonly SelectedPathLabelString: string = localize('jobStepDialog.selectedPath', 'Selected path');
	private readonly FilesOfTypeLabelString: string = localize('jobStepDialog.filesOfType', 'Files of type');
	private readonly FileNameLabelString: string = localize('jobStepDialog.fileName', 'File name');
	private readonly AllFilesLabelString: string = localize('jobStepDialog.allFiles', 'All Files (*)');

	// Dropdown options
	public static readonly TSQLScript: string = localize('jobStepDialog.TSQL', 'Transact-SQL script (T-SQL)');
	public static readonly Powershell: string = localize('jobStepDialog.powershell', 'PowerShell');
	public static readonly CmdExec: string = localize('jobStepDialog.CmdExec', 'Operating system (CmdExec)');
	public static readonly ReplicationDistributor: string = localize('jobStepDialog.replicationDistribution', 'Replication Distributor');
	public static readonly ReplicationMerge: string = localize('jobStepDialog.replicationMerge', 'Replication Merge');
	public static readonly ReplicationQueueReader: string = localize('jobStepDialog.replicationQueueReader', 'Replication Queue Reader');
	public static readonly ReplicationSnapshot: string = localize('jobStepDialog.replicationSnapshot', 'Replication Snapshot');
	public static readonly ReplicationTransactionLogReader: string = localize('jobStepDialog.replicationTransactionLogReader', 'Replication Transaction-Log Reader');
	public static readonly AnalysisServicesCommand: string = localize('jobStepDialog.analysisCommand', 'SQL Server Analysis Services Command');
	public static readonly AnalysisServicesQuery: string = localize('jobStepDialog.analysisQuery', 'SQL Server Analysis Services Query');
	public static readonly ServicesPackage: string = localize('jobStepDialog.servicesPackage', 'SQL Server Integration Service Package');


	public static readonly AgentServiceAccount: string = localize('jobStepDialog.agentServiceAccount', 'SQL Server Agent Service Account');
	public static readonly NextStep: string = localize('jobStepDialog.nextStep', 'Go to the next step');
	public static readonly QuitJobReportingSuccess: string = localize('jobStepDialog.quitJobSuccess', 'Quit the job reporting success');
	public static readonly QuitJobReportingFailure: string = localize('jobStepDialog.quitJobFailure', 'Quit the job reporting failure');

	// Event Name strings
	private readonly NewStepDialog = 'NewStepDialogOpened';
	private readonly EditStepDialog = 'EditStepDialogOpened';
	// UI Components

	// Dialogs
	private fileBrowserDialog: azdata.window.Dialog;

	// Dialog tabs
	private generalTab: azdata.window.DialogTab;
	private advancedTab: azdata.window.DialogTab;

	//Input boxes
	private nameTextBox: azdata.InputBoxComponent;
	private commandTextBox: azdata.InputBoxComponent;
	private selectedPathTextBox: azdata.InputBoxComponent;
	private retryAttemptsBox: azdata.InputBoxComponent;
	private retryIntervalBox: azdata.InputBoxComponent;
	private outputFileNameBox: azdata.InputBoxComponent;
	private fileBrowserNameBox: azdata.InputBoxComponent;
	private userInputBox: azdata.InputBoxComponent;
	private processExitCodeBox: azdata.InputBoxComponent;

	// Dropdowns
	private typeDropdown: azdata.DropDownComponent;
	private runAsDropdown: azdata.DropDownComponent;
	private databaseDropdown: azdata.DropDownComponent;
	private successActionDropdown: azdata.DropDownComponent;
	private failureActionDropdown: azdata.DropDownComponent;
	private fileTypeDropdown: azdata.DropDownComponent;

	// Buttons
	private openButton: azdata.ButtonComponent;
	private parseButton: azdata.ButtonComponent;
	private outputFileBrowserButton: azdata.ButtonComponent;

	// Checkbox
	private appendToExistingFileCheckbox: azdata.CheckBoxComponent;
	private logToTableCheckbox: azdata.CheckBoxComponent;
	private logStepOutputHistoryCheckbox: azdata.CheckBoxComponent;

	private fileBrowserTree: azdata.FileBrowserTreeComponent;
	private jobModel: JobData;
	public jobName: string;
	private server: string;
	private stepId: number;
	private isEdit: boolean;

	constructor(
		ownerUri: string,
		server: string,
		jobModel: JobData,
		jobStepInfo?: azdata.AgentJobStepInfo,
		viaJobDialog: boolean = false
	) {
		super(ownerUri,
			jobStepInfo ? JobStepData.convertToJobStepData(jobStepInfo, jobModel) : new JobStepData(ownerUri, jobModel, viaJobDialog),
			jobStepInfo ? JobStepDialog.EditDialogTitle : JobStepDialog.NewDialogTitle);
		this.stepId = jobStepInfo ?
			jobStepInfo.id : jobModel.jobSteps ?
				jobModel.jobSteps.length + 1 : 1;
		this.isEdit = jobStepInfo ? true : false;
		this.model.dialogMode = this.isEdit ? AgentDialogMode.EDIT : AgentDialogMode.CREATE;
		this.jobModel = jobModel;
		this.jobName = this.jobName ? this.jobName : this.jobModel.name;
		this.server = server;
		this.dialogName = this.isEdit ? this.EditStepDialog : this.NewStepDialog;
	}

	private initializeUIComponents() {
		this.generalTab = azdata.window.createTab(this.GeneralTabText);
		this.advancedTab = azdata.window.createTab(this.AdvancedTabText);
		this.dialog.content = [this.generalTab, this.advancedTab];
	}

	private createCommands(view, queryProvider: azdata.QueryProvider) {
		this.openButton = view.modelBuilder.button()
			.withProperties({
				label: this.OpenCommandText,
				title: this.OpenCommandText,
				width: '80px',
				isFile: true
			}).component();
		this.parseButton = view.modelBuilder.button()
			.withProperties({
				label: this.ParseCommandText,
				title: this.ParseCommandText,
				width: '80px',
				isFile: false
			}).component();
		this.openButton.onDidClick(e => {
			let queryContent = e.fileContent;
			this.commandTextBox.value = queryContent;
		});
		this.parseButton.onDidClick(e => {
			if (this.commandTextBox.value) {
				queryProvider.parseSyntax(this.ownerUri, this.commandTextBox.value).then(result => {
					if (result && result.parseable) {
						this.dialog.message = { text: this.SuccessfulParseText, level: 2 };
					} else if (result && !result.parseable) {
						this.dialog.message = { text: this.FailureParseText };
					}
				});
			}
		});
		this.commandTextBox = view.modelBuilder.inputBox()
			.withProperties({
				height: 300,
				width: 400,
				multiline: true,
				inputType: 'text',
				ariaLabel: this.CommandLabelString,
				placeHolder: this.CommandLabelString
			})
			.component();
	}

	private createGeneralTab(databases: string[], queryProvider: azdata.QueryProvider) {
		this.generalTab.registerContent(async (view) => {
			this.nameTextBox = view.modelBuilder.inputBox()
				.withProperties({
					ariaLabel: this.StepNameLabelString,
					placeHolder: this.StepNameLabelString
				}).component();
			this.nameTextBox.required = true;
			this.nameTextBox.onTextChanged(() => {
				if (this.nameTextBox.value.length > 0) {
					this.dialog.message = null;
				}
			});

			this.typeDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: JobStepDialog.TSQLScript,
					values: [JobStepDialog.TSQLScript, JobStepDialog.CmdExec, JobStepDialog.Powershell]
				})
				.component();
			this.runAsDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: '',
					values: ['']
				})
				.component();
			this.runAsDropdown.enabled = false;
			this.databaseDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases
				}).component();

			this.processExitCodeBox = view.modelBuilder.inputBox()
				.withProperties({
					ariaLabel: this.ProcessExitCodeText,
					placeHolder: this.ProcessExitCodeText
				}).component();
			this.processExitCodeBox.enabled = false;

			// create the commands section
			this.createCommands(view, queryProvider);

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: this.StepNameLabelString
				}, {
					component: this.typeDropdown,
					title: this.TypeLabelString
				}, {
					component: this.runAsDropdown,
					title: this.RunAsLabelString
				}, {
					component: this.databaseDropdown,
					title: this.DatabaseLabelString
				}, {
					component: this.processExitCodeBox,
					title: this.ProcessExitCodeText
				}, {
					component: this.commandTextBox,
					title: this.CommandLabelString,
					actions: [this.openButton, this.parseButton]
				}], {
					horizontal: false,
					componentWidth: 420
				}).component();
			this.typeDropdown.onValueChanged((type) => {
				switch (type.selected) {
					case (JobStepDialog.TSQLScript):
						this.runAsDropdown.value = '';
						this.runAsDropdown.values = [''];
						this.runAsDropdown.enabled = false;
						this.databaseDropdown.enabled = true;
						this.databaseDropdown.values = databases;
						this.databaseDropdown.value = databases[0];
						this.processExitCodeBox.value = '';
						this.processExitCodeBox.enabled = false;
						break;
					case (JobStepDialog.Powershell):
						this.runAsDropdown.value = JobStepDialog.AgentServiceAccount;
						this.runAsDropdown.values = [this.runAsDropdown.value];
						this.runAsDropdown.enabled = true;
						this.databaseDropdown.enabled = false;
						this.databaseDropdown.values = [''];
						this.databaseDropdown.value = '';
						this.processExitCodeBox.value = '';
						this.processExitCodeBox.enabled = false;
						break;
					case (JobStepDialog.CmdExec):
						this.databaseDropdown.enabled = false;
						this.databaseDropdown.values = [''];
						this.databaseDropdown.value = '';
						this.runAsDropdown.value = JobStepDialog.AgentServiceAccount;
						this.runAsDropdown.values = [this.runAsDropdown.value];
						this.runAsDropdown.enabled = true;
						this.processExitCodeBox.enabled = true;
						this.processExitCodeBox.value = '0';
						break;

				}
			});
			let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
			formWrapper.loading = false;
			await view.initializeModel(formWrapper);

			// Load values for edit scenario
			if (this.isEdit) {
				this.nameTextBox.value = this.model.stepName;
				this.typeDropdown.value = JobStepData.convertToSubSystemDisplayName(this.model.subSystem);
				this.databaseDropdown.value = this.model.databaseName;
				this.commandTextBox.value = this.model.command;
			}
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
					label: this.LogToTableLabel
				}).component();
			let appendToExistingEntryInTableCheckbox = view.modelBuilder.checkBox()
				.withProperties({ label: this.AppendExistingTableEntryLabel }).component();
			appendToExistingEntryInTableCheckbox.enabled = false;
			this.logToTableCheckbox.onChanged(e => {
				appendToExistingEntryInTableCheckbox.enabled = e;
			});
			let appendCheckboxContainer = view.modelBuilder.groupContainer()
				.withItems([appendToExistingEntryInTableCheckbox]).component();
			let logToTableContainer = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'row', justifyContent: 'space-between', width: 300 })
				.withItems([this.logToTableCheckbox]).component();
			this.logStepOutputHistoryCheckbox = view.modelBuilder.checkBox()
				.withProperties({ label: this.IncludeStepOutputHistoryLabel }).component();
			this.userInputBox = view.modelBuilder.inputBox()
				.withProperties({ inputType: 'text', width: '100%' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems(
					[{
						component: this.successActionDropdown,
						title: this.SuccessActionLabel
					}, {
						component: retryFlexContainer,
						title: ''
					}, {
						component: this.failureActionDropdown,
						title: this.FailureActionLabel
					}, {
						component: optionsGroup,
						title: JobStepDialog.TSQLScript
					}, {
						component: logToTableContainer,
						title: ''
					}, {
						component: appendCheckboxContainer,
						title: '                            '
					}, {
						component: this.logStepOutputHistoryCheckbox,
						title: ''
					}, {
						component: this.userInputBox,
						title: this.RunAsUserLabel
					}], {
					componentWidth: 400
				}).component();

			let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
			formWrapper.loading = false;
			await view.initializeModel(formWrapper);

			if (this.isEdit) {
				this.successActionDropdown.value = JobStepData.convertToCompletionActionDisplayName(this.model.successAction);
				this.retryAttemptsBox.value = this.model.retryAttempts.toString();
				this.retryIntervalBox.value = this.model.retryInterval.toString();
				this.failureActionDropdown.value = JobStepData.convertToCompletionActionDisplayName(this.model.failureAction);
				this.outputFileNameBox.value = this.model.outputFileName;
				this.appendToExistingFileCheckbox.checked = this.model.appendToLogFile;
				this.logToTableCheckbox.checked = this.model.appendLogToTable;
				this.logStepOutputHistoryCheckbox.checked = this.model.appendToStepHist;
				this.userInputBox.value = this.model.databaseUserName;
			}
		});
	}

	private createRetryCounters(view) {
		this.retryAttemptsBox = view.modelBuilder.inputBox()
			.withValidation(component => component.value >= 0)
			.withProperties({
				inputType: 'number',
				width: '100%',
				placeHolder: '0'
			})
			.component();
		this.retryIntervalBox = view.modelBuilder.inputBox()
			.withValidation(component => component.value >= 0)
			.withProperties({
				inputType: 'number',
				width: '100%',
				placeHolder: '0'
			}).component();

		let retryAttemptsContainer = view.modelBuilder.formContainer()
			.withFormItems(
				[{
					component: this.retryAttemptsBox,
					title: this.RetryAttemptsLabel
				}], {
				horizontal: false,
				componentWidth: '100%'
			})
			.component();

		let retryIntervalContainer = view.modelBuilder.formContainer()
			.withFormItems(
				[{
					component: this.retryIntervalBox,
					title: this.RetryIntervalLabel
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
		let fileBrowserTitle = this.FileBrowserDialogTitle + `${this.server}`;
		this.fileBrowserDialog = azdata.window.createModelViewDialog(fileBrowserTitle);
		let fileBrowserTab = azdata.window.createTab('File Browser');
		this.fileBrowserDialog.content = [fileBrowserTab];
		fileBrowserTab.registerContent(async (view) => {
			this.fileBrowserTree = view.modelBuilder.fileBrowserTree()
				.withProperties({ ownerUri: this.ownerUri, width: 420, height: 700 })
				.component();
			this.selectedPathTextBox = view.modelBuilder.inputBox()
				.withProperties({ inputType: 'text' })
				.component();
			this.fileBrowserTree.onDidChange((args) => {
				this.selectedPathTextBox.value = args.fullPath;
				this.fileBrowserNameBox.value = args.isFile ? path.win32.basename(args.fullPath) : '';
			});
			this.fileTypeDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: this.AllFilesLabelString,
					values: [this.AllFilesLabelString]
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
					title: this.SelectedPathLabelString
				}, {
					component: this.fileTypeDropdown,
					title: this.FilesOfTypeLabelString
				}, {
					component: this.fileBrowserNameBox,
					title: this.FileNameLabelString
				}
				]).component();
			view.initializeModel(fileBrowserContainer);
		});
		this.fileBrowserDialog.okButton.onClick(() => {
			this.outputFileNameBox.value = path.join(path.dirname(this.selectedPathTextBox.value), this.fileBrowserNameBox.value);
		});
		this.fileBrowserDialog.okButton.label = this.OkButtonText;
		this.fileBrowserDialog.cancelButton.label = this.CancelButtonText;
		azdata.window.openDialog(this.fileBrowserDialog);
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
				label: this.AppendOutputToFileLabel
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
				title: this.OutputFileNameLabel
			}, {
				component: this.appendToExistingFileCheckbox,
				title: ''
			}], { horizontal: false, componentWidth: 200 }).component();
		return outputFileForm;
	}

	protected updateModel() {
		this.model.stepName = this.nameTextBox.value;
		if (!this.model.stepName || this.model.stepName.length === 0) {
			this.dialog.message = this.dialog.message = { text: this.BlankStepNameErrorText };
			return;
		}
		this.model.jobName = this.jobName;
		this.model.id = this.stepId;
		this.model.server = this.server;
		this.model.subSystem = JobStepData.convertToAgentSubSystem(this.typeDropdown.value as string);
		this.model.databaseName = this.databaseDropdown.value as string;
		this.model.script = this.commandTextBox.value;
		this.model.successAction = JobStepData.convertToStepCompletionAction(this.successActionDropdown.value as string);
		this.model.retryAttempts = this.retryAttemptsBox.value ? +this.retryAttemptsBox.value : 0;
		this.model.retryInterval = +this.retryIntervalBox.value ? +this.retryIntervalBox.value : 0;
		this.model.failureAction = JobStepData.convertToStepCompletionAction(this.failureActionDropdown.value as string);
		this.model.outputFileName = this.outputFileNameBox.value;
		this.model.appendToLogFile = this.appendToExistingFileCheckbox.checked;
		this.model.command = this.commandTextBox.value ? this.commandTextBox.value : '';
		this.model.commandExecutionSuccessCode = this.processExitCodeBox.value ? +this.processExitCodeBox.value : 0;
	}

	public async initializeDialog() {
		let databases = await AgentUtils.getDatabases(this.ownerUri);
		let queryProvider = await AgentUtils.getQueryProvider();
		this.initializeUIComponents();
		this.createGeneralTab(databases, queryProvider);
		this.createAdvancedTab();
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
}
