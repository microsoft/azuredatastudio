/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { OperatorData } from '../data/operatorData';
import * as nls from 'vscode-nls';
import { AgentDialog } from './agentDialog';

const localize = nls.loadMessageBundle();

export class OperatorDialog extends AgentDialog<OperatorData> {

	// Top level
	private static readonly DialogTitle: string = localize('createOperator.createOperator', 'Create Operator');
	private static readonly GeneralTabText: string = localize('createOperator.General', 'General');
	private static readonly NotificationsTabText: string = localize('createOperator.Notifications', 'Notifications');

	// General tab strings
	private static readonly NameLabel: string = localize('createOperator.Name', 'Name');
	private static readonly EnabledCheckboxLabel: string = localize('createOperator.Enabled', 'Enabled');
	private static readonly EmailNameTextLabel: string = localize('createOperator.EmailName', 'E-mail Name');
	private static readonly PagerEmailNameTextLabel: string = localize('createOperator.PagerEmailName', 'Pager E-mail Name');
	private static readonly PagerMondayCheckBoxLabel: string = localize('createOperator.PagerMondayCheckBox', 'Monday');
	private static readonly PagerTuesdayCheckBoxLabel: string = localize('createOperator.PagerTuesdayCheckBox', 'Tuesday');
	private static readonly PagerWednesdayCheckBoxLabel: string = localize('createOperator.PagerWednesdayCheckBox', 'Wednesday');
	private static readonly PagerThursdayCheckBoxLabel: string = localize('createOperator.PagerThursdayCheckBox', 'Thursday');
	private static readonly PagerFridayCheckBoxLabel: string = localize('createOperator.PagerFridayCheckBox', 'Friday');
	private static readonly PagerSaturdayCheckBoxLabel: string = localize('createOperator.PagerSaturdayCheckBox', 'Saturday');
	private static readonly PagerSundayCheckBoxLabel: string = localize('createOperator.PagerSundayCheckBox', 'Sunday');

	// Notifications tab strings
	private static readonly AlertsTableLabel: string = localize('createOperator.AlertListHeading', 'Alert list');
	private static readonly AlertNameColumnLabel: string = localize('createOperator.AlertNameColumnLabel', 'Alert name');
	private static readonly AlertEmailColumnLabel: string = localize('createOperator.AlertEmailColumnLabel', 'E-mail');
	private static readonly AlertPagerColumnLabel: string = localize('createOperator.AlertPagerColumnLabel', 'Pager');

	// UI Components
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

	constructor(ownerUri: string) {
		super(ownerUri, new OperatorData(ownerUri), OperatorDialog.DialogTitle);
	}

	protected async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
		this.generalTab = sqlops.window.modelviewdialog.createTab(OperatorDialog.GeneralTabText);
		this.notificationsTab = sqlops.window.modelviewdialog.createTab(OperatorDialog.NotificationsTabText);

		this.initializeGeneralTab();
		this.initializeNotificationTab();

		this.dialog.content = [this.generalTab, this.notificationsTab];
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox()
				.withProperties({ width: 200 })
				.component();
			let nameForm = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: OperatorDialog.NameLabel
				}], {horizontal: true, componentWidth: 240}).component();

			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.EnabledCheckboxLabel
				}).component();
			this.enabledCheckBox.checked = true;
			let nameContainer = view.modelBuilder.flexContainer()
				.withLayout({width: 440 })
				.withLayout({
					flexFlow: 'row',
					alignItems: 'center',
					textAlign: 'left',
					alignContent: 'flex-start'
				}).withItems([nameForm, this.enabledCheckBox], { flex: '1 1 50%' })
				.component();

			let notificationSeparator = view.modelBuilder.lineSeparator()
				.withProperties({value: 'Notification options'})
				.component();

			this.emailNameTextBox = view.modelBuilder.inputBox().component();

			this.pagerEmailNameTextBox = view.modelBuilder.inputBox().component();

			let pagerScheduleSeparator = view.modelBuilder.lineSeparator()
				.withProperties({value: 'Pager on duty schedule'})
				.component();

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
					component: nameContainer,
					title: ''
				}, {
					component: notificationSeparator,
					title: ''
				}, {
					component: this.emailNameTextBox,
					title: OperatorDialog.EmailNameTextLabel
				}, {
					component: this.pagerEmailNameTextBox,
					title: OperatorDialog.PagerEmailNameTextLabel
				}, {
					component: pagerScheduleSeparator,
					title: ''
				}, {
					component: this.pagerMondayCheckBox,
					title: ''
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

	protected updateModel() {
		this.model.name = this.nameTextBox.value;
		this.model.enabled = this.enabledCheckBox.checked;
		this.model.emailAddress = this.emailNameTextBox.value;
	}
}
