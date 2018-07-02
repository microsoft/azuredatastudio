/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { AgentUtils } from '../agentUtils';
import { CreateAlertData } from '../data/createAlertData';

export class CreateAlertDialog {

	// Top level
	private static readonly DialogTitle: string = 'Create Alert';
	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';
	private static readonly GeneralTabText: string = 'General';
	private static readonly ResponseTabText: string = 'Response';
	private static readonly OptionsTabText: string = 'Options';

	// General tab strings
	private static readonly NameLabel: string = 'Name';
	private static readonly TypeLabel: string = 'Type';
	private static readonly DatabaseLabel: string = 'Database name';
	private static readonly ErrorNumberLabel: string = 'Error number';
	private static readonly SeverityrLabel: string = 'Severity';
	private static readonly AlertTypeSqlServerEventString: string = 'SQL Server event alert';
	private static readonly AlertTypePerformanceConditionString: string = 'SQL Server performance condition alert';
	private static readonly AlertTypeWmiEventString: string = 'WMI event alert';
	private static readonly AlertSeverity001Label: string = '001 - Miscellaneous System Information';
	private static readonly AlertSeverity002Label: string = '002 - Reserved';
	private static readonly AlertSeverity003Label: string = '003 - Reserved';
	private static readonly AlertSeverity004Label: string = '004 - Reserved';
	private static readonly AlertSeverity005Label: string = '005 - Reserved';
	private static readonly AlertSeverity006Label: string = '006 - Reserved';
	private static readonly AlertSeverity007Label: string = '007 - Notification: Status Information';
	private static readonly AlertSeverity008Label: string = '008 - Notification: User Intervention Required';
	private static readonly AlertSeverity009Label: string = '009 - User Defined';
	private static readonly AlertSeverity010Label: string = '010 - Information';
	private static readonly AlertSeverity011Label: string = '011 - Specified Database Object Not Found';
	private static readonly AlertSeverity012Label: string = '012 - Unused';
	private static readonly AlertSeverity013Label: string = '013 - User Transaction Syntax Error';
	private static readonly AlertSeverity014Label: string = '014 - Insufficient Permission';
	private static readonly AlertSeverity015Label: string = '015 - Syntax Error in SQL Statements';
	private static readonly AlertSeverity016Label: string = '016 - Miscellaneous User Error';
	private static readonly AlertSeverity017Label: string = '017 - Insufficient Resources';
	private static readonly AlertSeverity018Label: string = '018 - Nonfatal Internal Error';
	private static readonly AlertSeverity019Label: string = '019 - Fatal Error in Resource';
	private static readonly AlertSeverity020Label: string = '020 - Fatal Error in Current Process';
	private static readonly AlertSeverity021Label: string = '021 - Fatal Error in Database Processes';
	private static readonly AlertSeverity022Label: string = '022 - Fatal Error: Table Integrity Suspect';
	private static readonly AlertSeverity023Label: string = '023 - Fatal Error: Database Integrity Suspect';
	private static readonly AlertSeverity024Label: string = '024 - Fatal Error: Hardware Error';
	private static readonly AlertSeverity025Label: string = '025 - Fatal Error';

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
	private readonly ExecuteJobTextBoxLabel: string = 'Execute Job';

	// Options tab strings
	private readonly AdditionalMessageTextBoxLabel: string = 'Additional notification message to send';

	// History tab strings
	private readonly ResetCountTextBoxLabel: string = 'Reset Count';

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
	private raiseAlertMessageCheckBox: sqlops.CheckBoxComponent;
	private raiseAlertMessageTextBox: sqlops.InputBoxComponent;

	// Response tab controls
	private executeJobTextBox: sqlops.InputBoxComponent;

	// Options tab controls
	private additionalMessageTextBox: sqlops.InputBoxComponent;

	// History tab controls
	private resetCountTextBox: sqlops.InputBoxComponent;

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

			// this.enabledCheckBox = view.modelBuilder.checkBox()
			// 	.withProperties({
			// 		label: this.EnabledCheckboxLabel
			// 	}).component();

			this.databaseDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases,
					title: CreateAlertDialog.DatabaseLabel
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: CreateAlertDialog.NameLabel
				}, {
					component: this.databaseDropDown,
					title: CreateAlertDialog.DatabaseLabel
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeResponseTab() {
		this.responseTab.registerContent(async view => {
			this.executeJobTextBox = view.modelBuilder.inputBox().component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.executeJobTextBox,
					title: this.ExecuteJobTextBoxLabel
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeOptionsTab() {
		this.optionsTab.registerContent(async view => {
			this.additionalMessageTextBox = view.modelBuilder.inputBox().component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.additionalMessageTextBox,
					title: this.AdditionalMessageTextBoxLabel
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
