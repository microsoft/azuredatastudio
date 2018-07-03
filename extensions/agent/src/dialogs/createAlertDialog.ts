/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { AgentUtils } from '../agentUtils';
import { CreateAlertData } from '../data/createAlertData';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class CreateAlertDialog {

	// Top level
	private static readonly DialogTitle: string = localize('createAlert.createAlert', 'Create Alert');
	private static readonly OkButtonText: string = localize('createAlert.OK', 'OK');
	private static readonly CancelButtonText: string = localize('createAlert.Cancel', 'Cancel');
	private static readonly GeneralTabText: string = localize('createAlert.General', 'General');
	private static readonly ResponseTabText: string = localize('createAlert.Response', 'Response');
	private static readonly OptionsTabText: string = localize('createAlert.Options', 'Options');

	// General tab strings
	private static readonly NameLabel: string = localize('createAlert.Name', 'Name');
	private static readonly TypeLabel: string = localize('createAlert.Type', 'Type');
	private static readonly EnabledCheckboxLabel: string = localize('createAlert.Enabled', 'Enabled');
	private static readonly DatabaseLabel: string = localize('createAlert.DatabaseName', 'Database name');
	private static readonly ErrorNumberLabel: string = localize('createAlert.ErrorNumber', 'Error number');
	private static readonly SeverityLabel: string = localize('createAlert.Severity', 'Severity');
	private static readonly RaiseIfMessageContainsLabel: string = localize('createAlert.RaiseAlertContains', 'Raise alert when message contains');
	private static readonly MessageTextLabel: string = localize('createAlert.MessageText', 'Message text');
	private static readonly AlertTypeSqlServerEventString: string = localize('createAlert.SqlServerEventAlert', 'SQL Server event alert');
	private static readonly AlertTypePerformanceConditionString: string = localize('createAlert.PerformanceCondition', 'SQL Server performance condition alert');
	private static readonly AlertTypeWmiEventString: string = localize('createAlert.WmiEvent', 'WMI event alert');
	private static readonly AlertSeverity001Label: string = localize('createAlert.Severity001', '001 - Miscellaneous System Information');
	private static readonly AlertSeverity002Label: string = localize('createAlert.Severity002', '002 - Reserved');
	private static readonly AlertSeverity003Label: string = localize('createAlert.Severity003', '003 - Reserved');
	private static readonly AlertSeverity004Label: string = localize('createAlert.Severity004', '004 - Reserved');
	private static readonly AlertSeverity005Label: string = localize('createAlert.Severity005', '005 - Reserved');
	private static readonly AlertSeverity006Label: string = localize('createAlert.Severity006', '006 - Reserved');
	private static readonly AlertSeverity007Label: string = localize('createAlert.Severity007', '007 - Notification: Status Information');
	private static readonly AlertSeverity008Label: string = localize('createAlert.Severity008', '008 - Notification: User Intervention Required');
	private static readonly AlertSeverity009Label: string = localize('createAlert.Severity009', '009 - User Defined');
	private static readonly AlertSeverity010Label: string = localize('createAlert.Severity010', '010 - Information');
	private static readonly AlertSeverity011Label: string = localize('createAlert.Severity011', '011 - Specified Database Object Not Found');
	private static readonly AlertSeverity012Label: string = localize('createAlert.Severity012', '012 - Unused');
	private static readonly AlertSeverity013Label: string = localize('createAlert.Severity013', '013 - User Transaction Syntax Error');
	private static readonly AlertSeverity014Label: string = localize('createAlert.Severity014', '014 - Insufficient Permission');
	private static readonly AlertSeverity015Label: string = localize('createAlert.Severity015', '015 - Syntax Error in SQL Statements');
	private static readonly AlertSeverity016Label: string = localize('createAlert.Severity016', '016 - Miscellaneous User Error');
	private static readonly AlertSeverity017Label: string = localize('createAlert.Severity017', '017 - Insufficient Resources');
	private static readonly AlertSeverity018Label: string = localize('createAlert.Severity018', '018 - Nonfatal Internal Error');
	private static readonly AlertSeverity019Label: string = localize('createAlert.Severity019', '019 - Fatal Error in Resource');
	private static readonly AlertSeverity020Label: string = localize('createAlert.Severity020', '020 - Fatal Error in Current Process');
	private static readonly AlertSeverity021Label: string = localize('createAlert.Severity021', '021 - Fatal Error in Database Processes');
	private static readonly AlertSeverity022Label: string = localize('createAlert.Severity022', '022 - Fatal Error: Table Integrity Suspect');
	private static readonly AlertSeverity023Label: string = localize('createAlert.Severity023', '023 - Fatal Error: Database Integrity Suspect');
	private static readonly AlertSeverity024Label: string = localize('createAlert.Severity024', '024 - Fatal Error: Hardware Error');
	private static readonly AlertSeverity025Label: string = localize('createAlert.Severity025', '025 - Fatal Error');

	private static readonly AlertTypes: string[]  = [
		CreateAlertDialog.AlertTypeSqlServerEventString,
		CreateAlertDialog.AlertTypePerformanceConditionString,
		CreateAlertDialog.AlertTypeWmiEventString
	];

	private static readonly AlertSeverities: string[]  = [
		CreateAlertDialog.AlertSeverity001Label,
		CreateAlertDialog.AlertSeverity002Label,
		CreateAlertDialog.AlertSeverity003Label,
		CreateAlertDialog.AlertSeverity004Label,
		CreateAlertDialog.AlertSeverity005Label,
		CreateAlertDialog.AlertSeverity006Label,
		CreateAlertDialog.AlertSeverity007Label,
		CreateAlertDialog.AlertSeverity008Label,
		CreateAlertDialog.AlertSeverity009Label,
		CreateAlertDialog.AlertSeverity010Label,
		CreateAlertDialog.AlertSeverity011Label,
		CreateAlertDialog.AlertSeverity012Label,
		CreateAlertDialog.AlertSeverity013Label,
		CreateAlertDialog.AlertSeverity014Label,
		CreateAlertDialog.AlertSeverity015Label,
		CreateAlertDialog.AlertSeverity016Label,
		CreateAlertDialog.AlertSeverity017Label,
		CreateAlertDialog.AlertSeverity018Label,
		CreateAlertDialog.AlertSeverity019Label,
		CreateAlertDialog.AlertSeverity020Label,
		CreateAlertDialog.AlertSeverity021Label,
		CreateAlertDialog.AlertSeverity022Label,
		CreateAlertDialog.AlertSeverity023Label,
		CreateAlertDialog.AlertSeverity024Label,
		CreateAlertDialog.AlertSeverity025Label
	];

	// Response tab strings
	private static readonly ExecuteJobTextBoxLabel: string = localize('createAlert.ExecuteJob', 'Execute Job');
	private static readonly NotifyOperatorsTextBoxLabel: string =  localize('createAlert.NotifyOperators', 'Notify Operators');
	private static readonly NewJobButtonLabel: string =  localize('createAlert.NewJob', 'New Job');
	private static readonly OperatorListLabel: string =  localize('createAlert.OperatorList', 'Operator List');
	private static readonly OperatorNameColumnLabel: string =  localize('createAlert.OperatorName', 'Operator');
	private static readonly OperatorEmailColumnLabel: string =  localize('createAlert.OperatorEmail', 'E-mail');
	private static readonly OperatorPagerColumnLabel: string =  localize('createAlert.OperatorPager', 'Pager');
	private static readonly NewOperatorButtonLabel: string =  localize('createAlert.NewOperator', 'New Operator');

	// Options tab strings
	private static readonly IncludeErrorInEmailCheckBoxLabel: string =  localize('createAlert.IncludeErrorInEmail', 'Include alert error text in e-mail');
	private static readonly IncludeErrorInPagerCheckBoxLabel: string =  localize('createAlert.IncludeErrorInPager', 'Include alert error text in pager');
	private static readonly AdditionalMessageTextBoxLabel: string =  localize('createAlert.AdditionalNotification', 'Additional notification message to send');
	private static readonly DelayBetweenResponsesTextBoxLabel: string =  localize('createAlert.DelayBetweenResponse', 'Delay between responses');
	private static readonly DelayMinutesTextBoxLabel: string =  localize('createAlert.DelayMinutes', 'Delay Minutes');
	private static readonly DelaySecondsTextBoxLabel: string =  localize('createAlert.DelaySeconds', 'Delay Seconds');

	// UI Components
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private responseTab: sqlops.window.modelviewdialog.DialogTab;
	private optionsTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	private nameTextBox: sqlops.InputBoxComponent;
	private typeDropDown: sqlops.DropDownComponent;
	private severityDropDown: sqlops.DropDownComponent;
	private databaseDropDown: sqlops.DropDownComponent;
	private enabledCheckBox: sqlops.CheckBoxComponent;
	private raiseAlertMessageCheckBox: sqlops.CheckBoxComponent;
	private raiseAlertMessageTextBox: sqlops.InputBoxComponent;

	// Response tab controls
	private executeJobTextBox: sqlops.InputBoxComponent;
	private executeJobCheckBox: sqlops.CheckBoxComponent;
	private newJobButton: sqlops.ButtonComponent;
	private notifyOperatorsCheckBox: sqlops.CheckBoxComponent;
	private operatorsTable: sqlops.TableComponent;
	private newOperatorButton: sqlops.ButtonComponent;

	// Options tab controls
	private additionalMessageTextBox: sqlops.InputBoxComponent;
	private includeErrorInEmailTextBox: sqlops.CheckBoxComponent;
	private includeErrorInPagerTextBox: sqlops.CheckBoxComponent;
	private delayMinutesTextBox: sqlops.InputBoxComponent;
	private delaySecondsTextBox: sqlops.InputBoxComponent;


	private model: CreateAlertData;

	private _onSuccess: vscode.EventEmitter<CreateAlertData> = new vscode.EventEmitter<CreateAlertData>();
	public readonly onSuccess: vscode.Event<CreateAlertData> = this._onSuccess.event;

	constructor(public ownerUri: string) {
		this.model = new CreateAlertData(ownerUri);
	}

	public async showDialog() {

		let databases = await AgentUtils.getDatabases(this.ownerUri);
		await this.model.initialize();
		this.dialog = sqlops.window.modelviewdialog.createDialog(CreateAlertDialog.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(CreateAlertDialog.GeneralTabText);
		this.responseTab = sqlops.window.modelviewdialog.createTab(CreateAlertDialog.ResponseTabText);
		this.optionsTab = sqlops.window.modelviewdialog.createTab(CreateAlertDialog.OptionsTabText);

		this.initializeGeneralTab(databases);
		this.initializeResponseTab();
		this.initializeOptionsTab();

		this.dialog.content = [this.generalTab, this.responseTab, this.optionsTab];
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = CreateAlertDialog.OkButtonText;
		this.dialog.cancelButton.label = CreateAlertDialog.CancelButtonText;

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeGeneralTab(databases: string[]) {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();

			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: CreateAlertDialog.EnabledCheckboxLabel
				}).component();

			this.databaseDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases
				}).component();

			this.typeDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: CreateAlertDialog.AlertTypes[0],
					values: CreateAlertDialog.AlertTypes
				}).component();

			this.severityDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: CreateAlertDialog.AlertSeverities[0],
					values: CreateAlertDialog.AlertSeverities
				}).component();

			this.raiseAlertMessageCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: CreateAlertDialog.RaiseIfMessageContainsLabel
				}).component();

			this.raiseAlertMessageTextBox = view.modelBuilder.inputBox().component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: CreateAlertDialog.NameLabel
				}, {
					component: this.enabledCheckBox,
					title: ''
				}, {
					component: this.typeDropDown,
					title: CreateAlertDialog.TypeLabel
				}, {
					component: this.databaseDropDown,
					title: CreateAlertDialog.DatabaseLabel
				}, {
					component: this.raiseAlertMessageCheckBox,
					title: CreateAlertDialog.RaiseIfMessageContainsLabel
				}, {
					component: this.raiseAlertMessageTextBox,
					title: CreateAlertDialog.MessageTextLabel
				}
			]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeResponseTab() {
		this.responseTab.registerContent(async view => {
			this.executeJobCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: CreateAlertDialog.EnabledCheckboxLabel
				}).component();

			this.executeJobTextBox = view.modelBuilder.inputBox().component();

			this.newJobButton = view.modelBuilder.button().withProperties({
					label: CreateAlertDialog.NewJobButtonLabel,
					width: 80
				}).component();

			this.notifyOperatorsCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: CreateAlertDialog.NotifyOperatorsTextBoxLabel
				}).component();

			this.operatorsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						CreateAlertDialog.OperatorNameColumnLabel,
						CreateAlertDialog.OperatorEmailColumnLabel,
						CreateAlertDialog.OperatorPagerColumnLabel
					],
					data: [],
					height: 500
				}).component();

			this.newOperatorButton = view.modelBuilder.button().withProperties({
					label: this.newOperatorButton,
					width: 80
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.executeJobCheckBox,
					title: CreateAlertDialog.ExecuteJobTextBoxLabel
				}, {
					component: this.executeJobTextBox,
					title: CreateAlertDialog.ExecuteJobTextBoxLabel
				}, {
					component: this.newJobButton,
					title: CreateAlertDialog.NewJobButtonLabel
				}, {
					component: this.notifyOperatorsCheckBox,
					title: CreateAlertDialog.NotifyOperatorsTextBoxLabel
				}, {
					component: this.operatorsTable,
					title: CreateAlertDialog.OperatorListLabel,
					actions: [this.newOperatorButton]
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeOptionsTab() {
		this.optionsTab.registerContent(async view => {

			this.includeErrorInEmailTextBox = view.modelBuilder.checkBox()
				.withProperties({
					label: CreateAlertDialog.IncludeErrorInEmailCheckBoxLabel
				}).component();

			this.includeErrorInPagerTextBox = view.modelBuilder.checkBox()
				.withProperties({
					label: CreateAlertDialog.IncludeErrorInPagerCheckBoxLabel
				}).component();

			this.additionalMessageTextBox = view.modelBuilder.inputBox().component();

			this.delayMinutesTextBox = view.modelBuilder.inputBox().component();

			this.delaySecondsTextBox = view.modelBuilder.inputBox().component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.includeErrorInEmailTextBox,
					title: ''
				}, {
					component: this.includeErrorInPagerTextBox,
					title: ''
				}, {
					component: this.additionalMessageTextBox,
					title: CreateAlertDialog.AdditionalMessageTextBoxLabel
				}, {
					component: this.delayMinutesTextBox,
					title: CreateAlertDialog.DelayMinutesTextBoxLabel
				}, {
					component: this.delaySecondsTextBox,
					title: CreateAlertDialog.DelaySecondsTextBoxLabel
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private async execute() {
		this.updateModel();
		await this.model.save();
		this._onSuccess.fire(this.model);
	}

	private async cancel() {
	}

	private updateModel() {
	}
}
