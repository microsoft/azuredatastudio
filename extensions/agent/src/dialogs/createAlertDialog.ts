/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { CreateAlertData } from '../data/createAlertData';

export class CreateAlertDialog {

	// Top level
	private readonly DialogTitle: string = 'Create Alert';
	private readonly OkButtonText: string = 'OK';
	private readonly CancelButtonText: string = 'Cancel';
	private readonly GeneralTabText: string = 'Response';
	private readonly ResponseTabText: string = 'Steps';
	private readonly OptionsTabText: string = 'Options';
	private readonly HistoryTabText: string = 'History';

	// General tab strings
	private readonly NameTextBoxLabel: string = 'Name';

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
	private historyTab: sqlops.window.modelviewdialog.DialogTab;
	private schedulesTable: sqlops.TableComponent;

	// General tab controls
	private nameTextBox: sqlops.InputBoxComponent;

	// Response tab controls
	private executeJobTextBox: sqlops.InputBoxComponent;

	// Options tab controls
	private additionalMessageTextBox: sqlops.InputBoxComponent;

	// History tab controls
	private resetCountTextBox: sqlops.InputBoxComponent;

	private model: CreateAlertData;

	private _onSuccess: vscode.EventEmitter<CreateAlertData> = new vscode.EventEmitter<CreateAlertData>();
	public readonly onSuccess: vscode.Event<CreateAlertData> = this._onSuccess.event;

	constructor(ownerUri: string) {
		this.model = new CreateAlertData(ownerUri);
	}

	public async showDialog() {
		await this.model.initialize();
		this.dialog = sqlops.window.modelviewdialog.createDialog(this.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(this.GeneralTabText);
		this.responseTab = sqlops.window.modelviewdialog.createTab(this.ResponseTabText);
		this.optionsTab = sqlops.window.modelviewdialog.createTab(this.OptionsTabText);
		this.historyTab = sqlops.window.modelviewdialog.createTab(this.HistoryTabText);

		this.initializeGeneralTab();
		this.initializeResponseTab();
		this.initializeOptionsTab();
		this.initializeHistoryTab();

		this.dialog.content = [this.generalTab, this.responseTab, this.optionsTab, this.historyTab];
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = this.OkButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: this.NameTextBoxLabel
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

	private initializeHistoryTab() {
		this.historyTab.registerContent(async view => {
			this.resetCountTextBox = view.modelBuilder.inputBox().component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.resetCountTextBox,
					title: this.ResetCountTextBoxLabel
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
