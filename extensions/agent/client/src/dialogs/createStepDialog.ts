/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { CreateStepData } from '../data/createStepData';
import { AgentUtils } from '../agentUtils';

export class CreateStepDialog {

	// TODO: localize
	// Top level
	//
	private static readonly DialogTitle: string = 'New Job Step';
	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';
	private static readonly GeneralTabText: string = 'General';
	private static readonly AdvancedTabText: string = 'Advanced';
	private static readonly OpenCommandText: string = 'Open...';
	private static readonly SelectAllCommandText: string = 'Select All';
	private static readonly CopyCommandText: string = 'Copy';
	private static readonly PasteCommandText: string = 'Paste';
	private static readonly ParseCommandText: string = 'Parse';
	private static readonly NextButtonText: string = 'Next';
	private static readonly PreviousButtonText: string = 'Previous';
	private static readonly SuccessAction: string = 'On success action';
	private static readonly FailureAction: string = 'On failure action';


	// Dropdown options
	private static readonly TSQLScript: string = 'Transact-SQL script (T-SQL)';
	private static readonly AgentServiceAccount: string = 'SQL Server Agent Service Account';
	private static readonly NextStep: string =  'Go to the next step';
	private static readonly QuitJobReportingSuccess: string =  'Quit the job reporting success';
	private static readonly QuitJobReportingFailure: string = 'Quit the job reporting failure';

	// UI Components
	//
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private advancedTab: sqlops.window.modelviewdialog.DialogTab;
	private nameTextBox: sqlops.InputBoxComponent;
	private typeDropdown: sqlops.DropDownComponent;
	private runAsDropdown: sqlops.DropDownComponent;
	private databaseDropdown: sqlops.DropDownComponent;
	private successActionDropdown: sqlops.DropDownComponent;
	private failureActionDropdown: sqlops.DropDownComponent;
	private commandTextBox: sqlops.InputBoxComponent;
	private openButton: sqlops.ButtonComponent;
	private selectAllButton: sqlops.ButtonComponent;
	private copyButton: sqlops.ButtonComponent;
	private pasteButton: sqlops.ButtonComponent;
	private parseButton: sqlops.ButtonComponent;
	private nextButton: sqlops.ButtonComponent;
	private previousButton: sqlops.ButtonComponent;
	private retryAttemptsBox: sqlops.InputBoxComponent;
	private retryIntervalBox: sqlops.InputBoxComponent;
	private appendToExistingFileCheckbox: sqlops.CheckBoxComponent;
	private logToTableCheckbox: sqlops.CheckBoxComponent;
	private outputFileNameBox: sqlops.InputBoxComponent;
	private outputFileBrowserButton: sqlops.ButtonComponent;

	private flexButtonsModel;
	private overallContainer;

	private model: CreateStepData;
	private ownerUri: string;
	private jobId: string;
	private server: string;

	constructor(
		ownerUri: string,
		jobId: string,
		server: string
	) {
		this.model = new CreateStepData(ownerUri);
		this.ownerUri = ownerUri;
		this.jobId = jobId;
		this.server = server;
	}

	private initializeUIComponents() {
		this.dialog = sqlops.window.modelviewdialog.createDialog(CreateStepDialog.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(CreateStepDialog.GeneralTabText);
		this.advancedTab = sqlops.window.modelviewdialog.createTab(CreateStepDialog.AdvancedTabText);
		this.dialog.content = [this.generalTab, this.advancedTab];
		this.dialog.okButton.label = CreateStepDialog.OkButtonText;
		this.dialog.okButton.onClick(() => this.execute());
		this.dialog.cancelButton.label = CreateStepDialog.CancelButtonText;
	}

	private createCommands(view, queryProvider: sqlops.QueryProvider) {
		this.openButton = view.modelBuilder.button()
			.withProperties({
				label: CreateStepDialog.OpenCommandText,
				width: '55px'
			}).component();
		this.selectAllButton = view.modelBuilder.button()
			.withProperties({
				label: CreateStepDialog.SelectAllCommandText,
				width: '55px'
			}).component();
		this.copyButton = view.modelBuilder.button()
			.withProperties({
				label: CreateStepDialog.CopyCommandText,
				width: '55px'
			}).component();
		this.pasteButton = view.modelBuilder.button()
			.withProperties({
				label: CreateStepDialog.PasteCommandText,
				width: '55px'
			}).component();
		this.parseButton = view.modelBuilder.button()
			.withProperties({
				label: CreateStepDialog.ParseCommandText,
				width: '55px'
			}).component();
		this.parseButton.onDidClick(e => {
			queryProvider.runQueryAndReturn(this.ownerUri, this.commandTextBox.value, true).then(result => {
				if (result && result.parseable) {
					this.dialog.message = { text: 'The command was successfully parsed.'};
				} else if (result && !result.parseable) {
					this.dialog.message = { text: 'The command failed.'};
				}
			});
		});
		let text = view.modelBuilder.text()
			.withProperties({
				value: 'Command'
			}).component();
		this.flexButtonsModel = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				alignItems: 'left',
				height: 300,
			}).withItems([
				text, this.openButton, this.selectAllButton , this.copyButton, this.pasteButton, this.parseButton]
			, { flex: '1 1 50%' }).component();
			this.commandTextBox = view.modelBuilder.inputBox()
			.withProperties({
				height: 300,
				width: 350,
				multiline: true,
				inputType: 'text'
			})
			.component();

		let commandContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				height: 300
			}).withItems([this.commandTextBox], {
				flex: '1 1 50%'
			}).component();

		this.overallContainer = view.modelBuilder.flexContainer().withLayout(
				{ flexFlow: 'row', justifyContent: 'center'}
			).withItems([this.flexButtonsModel, commandContainer]).component();
	}

	private createGeneralTab(databases: string[], queryProvider: sqlops.QueryProvider) {
		this.generalTab.registerContent(async (view) => {
			this.nameTextBox = view.modelBuilder.inputBox()
				.withProperties({
				}).component();
			this.typeDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: CreateStepDialog.TSQLScript,
					values: [CreateStepDialog.TSQLScript]
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
				if (type.selected !== CreateStepDialog.TSQLScript) {
					this.runAsDropdown.value = CreateStepDialog.AgentServiceAccount;
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

			this.nextButton = view.modelBuilder.button()
			.withProperties({
				label: CreateStepDialog.NextButtonText,
				enabled: false,
				width: '100px'
			}).component();
			this.previousButton = view.modelBuilder.button()
			.withProperties({
				label: CreateStepDialog.PreviousButtonText,
				enabled: false,
				width: '100px'
			}).component();

			let buttonContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				textAlign: 'right',
				justifyContent: 'flex-end',
				width: 400
			}).withItems([this.nextButton, this.previousButton], {
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
					component: this.overallContainer,
					title: ''
				}, {
					component: buttonContainer,
					title: ''
				}], {
					horizontal: false,
					componentWidth: 420
				}).component();
			let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
			formWrapper.loading = false;
			await view.initializeModel(formWrapper);
		});
	}

	private createRunAsUserOptions(view) {
		let userInputBox = view.modelBuilder.inputBox()
			.withProperties({ inputType: 'text', width: '100px' }).component();
		let viewButton = view.modelBuilder.button()
			.withProperties({label: '...', width: '20px'}).component();
		let viewButtonContainer = view.modelBuilder.flexContainer()
			.withLayout({ width: 100, textAlign: 'right'})
			.withItems([viewButton], { flex: '1 1 50%'}).component();
		let userInputBoxContainer = view.modelBuilder.flexContainer()
			.withLayout({ width: 200, textAlign: 'left' })
			.withItems([userInputBox], { flex: '1 1 50%'}).component();
		let runAsUserContainer = view.modelBuilder.flexContainer()
			.withLayout({ width: 200})
			.withItems([userInputBoxContainer, viewButtonContainer],{ flex: '1 1 50%'})
			.component();
		let runAsUserForm = view.modelBuilder.formContainer()
			.withFormItems([{
				component: runAsUserContainer,
				title: 'Run as user'
			}], { horizontal: true, componentWidth: 200 }).component();
		return runAsUserForm;
	}

	private createAdvancedTab(fileBrowserService: sqlops.FileBrowserProvider) {
		this.advancedTab.registerContent(async (view) => {
			this.successActionDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: CreateStepDialog.NextStep,
					values: [CreateStepDialog.NextStep, CreateStepDialog.QuitJobReportingSuccess, CreateStepDialog.QuitJobReportingFailure]
				})
				.component();
			let retryFlexContainer = this.createRetryCounters(view);
			this.failureActionDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: CreateStepDialog.QuitJobReportingFailure,
					values: [CreateStepDialog.QuitJobReportingFailure, CreateStepDialog.NextStep, CreateStepDialog.QuitJobReportingSuccess]
				})
			.component();
			let optionsGroup = this.createTSQLOptions(view, fileBrowserService);
			let viewButton = view.modelBuilder.button()
				.withProperties({ label: 'View', width: '50px'}).component();
			viewButton.enabled = false;
			this.logToTableCheckbox = view.modelBuilder.checkBox()
				.withProperties({
					label: 'Log to table'
				}).component();
			let appendToExistingEntryInTableCheckbox = view.modelBuilder.checkBox()
				.withProperties({ label: 'Append output to existing entry in table'}).component();
			appendToExistingEntryInTableCheckbox.enabled = false;
			this.logToTableCheckbox.onChanged(e => {
				viewButton.enabled = e;
				appendToExistingEntryInTableCheckbox.enabled = e;
			});
			let appendCheckboxContainer = view.modelBuilder.groupContainer()
				.withItems([appendToExistingEntryInTableCheckbox]).component();
			let logToTableContainer = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'row', justifyContent: 'space-between', width: 300})
				.withItems([this.logToTableCheckbox, viewButton]).component();
			let logStepOutputHistoryCheckbox = view.modelBuilder.checkBox()
				.withProperties({ label: 'Include step output in history'}).component();
			let runAsUserOptions = this.createRunAsUserOptions(view);
			let formModel = view.modelBuilder.formContainer()
				.withFormItems(
				[{
					component: this.successActionDropdown,
					title: CreateStepDialog.SuccessAction
				}, {
					component: retryFlexContainer,
					title: ''
				}, {
					component: this.failureActionDropdown,
					title: CreateStepDialog.FailureAction
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
					component: runAsUserOptions,
					title: ''
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
		.withProperties({
			inputType: 'number'
		})
		.component();
		this.retryIntervalBox = view.modelBuilder.inputBox()
			.withProperties({
				inputType: 'number'
			}).component();

		let retryAttemptsContainer = view.modelBuilder.formContainer()
			.withFormItems(
				[{
					component: this.retryAttemptsBox,
					title: 'Retry Attempts'
				}], {
					horizontal: false
				})
				.component();

		let retryIntervalContainer = view.modelBuilder.formContainer()
			.withFormItems(
				[{
					component: this.retryIntervalBox,
					title: 'Retry Attempts'
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

	private createTSQLOptions(view, fileBrowserService: sqlops.FileBrowserProvider) {
		this.outputFileBrowserButton = view.modelBuilder.button()
			.withProperties({width: '20px', label: '...'}).component();
		this.outputFileBrowserButton.onDidClick(() => {
			fileBrowserService.openFileBrowser(this.ownerUri,
				'C:\\Program Files\\Microsoft SQL Server\\MSSQL14.MSSQLSERVER\\MSSQL\\Backup',
				['*'] , false).then(result => {
				if (result) {
					console.log(result);
					Promise.resolve(result);
				} else {
					Promise.reject(false);
				}
			});
		});
		this.outputFileNameBox = view.modelBuilder.inputBox()
			.withProperties({
				width: '100px',
				inputType: 'text'
			}).component();
		let outputViewButton = view.modelBuilder.button()
			.withProperties({
				width: '50px',
				label: 'View'
			}).component();
		outputViewButton.enabled = false;
		let outputButtonContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				textAlign: 'right',
				width: 120
			}).withItems([this.outputFileBrowserButton, outputViewButton], { flex: '1 1 50%'}).component();
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
				}], { horizontal: true, componentWidth: 200}).component();
		return outputFileForm;
	}

	private async execute() {
		this.model.jobId = this.jobId;
		this.model.server = this.server;
		this.model.stepName = this.nameTextBox.value;
		this.model.subSystem = this.typeDropdown.value as string;
		this.model.databaseName = this.databaseDropdown.value as string;
		this.model.script = this.commandTextBox.value;
		this.model.successAction = this.successActionDropdown.value as string;
		this.model.retryAttempts = +this.retryAttemptsBox.value;
		this.model.retryInterval = +this.retryIntervalBox.value;
		this.model.failureAction = this.failureActionDropdown.value as string;
		this.model.outputFileName = this.outputFileNameBox.value;
		await this.model.save();
	}

	private openFileBrowserDialog(rootNode, selectedNode) {
	}

	private onFileBrowserOpened(handle: number, fileBrowserOpenedParams: sqlops.FileBrowserOpenedParams) {
		if (fileBrowserOpenedParams.succeeded === true
			&& fileBrowserOpenedParams.fileTree
			&& fileBrowserOpenedParams.fileTree.rootNode
			&& fileBrowserOpenedParams.fileTree.selectedNode) {
				this.openFileBrowserDialog(fileBrowserOpenedParams.fileTree.rootNode, fileBrowserOpenedParams.fileTree.selectedNode);
			}
		console.log('no response');
		return;
	}

	public async openNewStepDialog() {
		let databases = await AgentUtils.getDatabases(this.ownerUri);
		let fileBrowserService =  await AgentUtils.getFileBrowserService(this.ownerUri);
		let queryProvider = await AgentUtils.getQueryProvider(this.ownerUri);
		fileBrowserService.registerOnFileBrowserOpened((response: sqlops.FileBrowserOpenedParams) => {
			this.onFileBrowserOpened(fileBrowserService.handle, response);
		});
		this.initializeUIComponents();
		this.createGeneralTab(databases, queryProvider);
		this.createAdvancedTab(fileBrowserService);
		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}
}