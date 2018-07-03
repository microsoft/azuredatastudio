/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { CreateOperatorData } from '../data/createOperatorData';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class OperatorDialog {

	// Top level
	private static readonly DialogTitle: string = localize('createOperator.createOperator', 'Create Operator');
	private static readonly OkButtonText: string = localize('createOperator.OK', 'OK');
	private static readonly CancelButtonText: string = localize('createOperator.Cancel', 'Cancel');
	private static readonly GeneralTabText: string = localize('createOperator.General', 'General');
	private static readonly NotificationsTabText: string = localize('createOperator.Notifications', 'Notifications');

	// General tab strings
	private static readonly NameLabel: string = localize('createOperator.Name', 'Name');
	private static readonly EnabledCheckboxLabel: string = localize('createOperator.Enabled', 'Enabled');
	private static readonly EmailNameTextLabel: string = localize('createOperator.EmailName', 'E-mail Name');
	private static readonly PagerEmailNameTextLabel: string = localize('createOperator.PagerEmailName', 'Pager E-mail Name');
	private static readonly PagerMondayCheckBoxLabel: string = localize('createOperator.PagerMondayCheckBox', 'Pager on duty Monday');
	private static readonly PagerTuesdayCheckBoxLabel: string = localize('createOperator.PagerTuesdayCheckBox', 'Pager on duty Tuesday');
	private static readonly PagerWednesdayCheckBoxLabel: string = localize('createOperator.PagerWednesdayCheckBox', 'Pager on duty Wednesday');
	private static readonly PagerThursdayCheckBoxLabel: string = localize('createOperator.PagerThursdayCheckBox', 'Pager on duty Thursday');
	private static readonly PagerFridayCheckBoxLabel: string = localize('createOperator.PagerFridayCheckBox', 'Pager on duty Friday');
	private static readonly PagerSaturdayCheckBoxLabel: string = localize('createOperator.PagerSaturdayCheckBox', 'Pager on duty Saturday');
	private static readonly PagerSundayCheckBoxLabel: string = localize('createOperator.PagerSundayCheckBox', 'Pager on duty Sunday');

	// Notifications tab strings
	private static readonly AlertsTableLabel: string = localize('createOperator.PagerSundayCheckBox', 'Pager on duty Sunday');
	private static readonly AlertNameColumnLabel: string = localize('createOperator.AlertNameColumnLabel', 'Alert name');
	private static readonly AlertEmailColumnLabel: string = localize('createOperator.AlertEmailColumnLabel', 'E-mail');
	private static readonly AlertPagerColumnLabel: string = localize('createOperator.AlertPagerColumnLabel', 'Pager');

	// UI Components
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private notificationsTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	private nameTextBox: sqlops.InputBoxComponent;
	private enabledCheckBox: sqlops.CheckBoxComponent;
	private emailNameTextBox: sqlops.InputBoxComponent;
	private pagerEmailNameTextBox: sqlops.InputBoxComponent;
	private pagerMondayCheckBox: sqlops.CheckBoxComponent;
	private pagerTuesdayCheckBox: sqlops.CheckBoxComponent;
	private pagerWednesdayCheckBox: sqlops.CheckBoxComponent;
	private pagerThursdayCheckBox: sqlops.CheckBoxComponent;
	private pagerFridayCheckBox: sqlops.CheckBoxComponent;
	private pagerSaturdayCheckBox: sqlops.CheckBoxComponent;
	private pagerSundayCheckBox: sqlops.CheckBoxComponent;

	// Notification tab controls
	private alertsTable: sqlops.TableComponent;

	private model: CreateOperatorData;

	private _onSuccess: vscode.EventEmitter<CreateOperatorData> = new vscode.EventEmitter<CreateOperatorData>();
	public readonly onSuccess: vscode.Event<CreateOperatorData> = this._onSuccess.event;

	constructor(ownerUri: string) {
		this.model = new CreateOperatorData(ownerUri);
	}

	public async showDialog() {
		await this.model.initialize();
		this.dialog = sqlops.window.modelviewdialog.createDialog(OperatorDialog.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(OperatorDialog.GeneralTabText);
		this.notificationsTab = sqlops.window.modelviewdialog.createTab(OperatorDialog.NotificationsTabText);

		this.initializeGeneralTab();
		this.initializeNotificationTab();

		this.dialog.content = [this.generalTab, this.notificationsTab];
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = OperatorDialog.OkButtonText;
		this.dialog.cancelButton.label = OperatorDialog.CancelButtonText;

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();

			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.EnabledCheckboxLabel
				}).component();

			this.emailNameTextBox = view.modelBuilder.inputBox().component();

			this.pagerEmailNameTextBox = view.modelBuilder.inputBox().component();

			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.EnabledCheckboxLabel
				}).component();

			this.pagerMondayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerMondayCheckBoxLabel
				}).component();

			this.pagerTuesdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerTuesdayCheckBoxLabel
				}).component();

			this.pagerWednesdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerWednesdayCheckBoxLabel
				}).component();

			this.pagerThursdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerThursdayCheckBoxLabel
				}).component();

			this.pagerFridayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerFridayCheckBoxLabel
				}).component();

			this.pagerSaturdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerSaturdayCheckBoxLabel
				}).component();

			this.pagerSundayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerSundayCheckBoxLabel
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: OperatorDialog.NameLabel
				}, {
					component: this.enabledCheckBox,
					title: ''
				}, {
					component: this.emailNameTextBox,
					title: OperatorDialog.EmailNameTextLabel
				}, {
					component: this.pagerEmailNameTextBox,
					title: OperatorDialog.PagerEmailNameTextLabel
				}, {
					component: this.pagerTuesdayCheckBox,
					title: ''
				}, {
					component: this.pagerWednesdayCheckBox,
					title: ''
				}, {
					component: this.pagerThursdayCheckBox,
					title: ''
				}, {
					component: this.pagerFridayCheckBox,
					title: ''
				}, {
					component: this.pagerSaturdayCheckBox,
					title: ''
				}, {
					component: this.pagerSundayCheckBox,
					title: ''
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeNotificationTab() {
		this.notificationsTab.registerContent(async view => {

			this.alertsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						OperatorDialog.AlertNameColumnLabel,
						OperatorDialog.AlertEmailColumnLabel,
						OperatorDialog.AlertPagerColumnLabel
					],
					data: [],
					height: 500
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.alertsTable,
					title: OperatorDialog.AlertsTableLabel
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
