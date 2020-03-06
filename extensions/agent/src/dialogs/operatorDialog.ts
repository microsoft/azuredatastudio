/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { OperatorData } from '../data/operatorData';
import * as nls from 'vscode-nls';
import { AgentDialog } from './agentDialog';

const localize = nls.loadMessageBundle();

export class OperatorDialog extends AgentDialog<OperatorData> {

	// Top level
	private static readonly CreateDialogTitle: string = localize('createOperator.createOperator', "Create Operator");
	private static readonly EditDialogTitle: string = localize('createOperator.editOperator', "Edit Operator");
	private static readonly GeneralTabText: string = localize('createOperator.General', "General");
	private static readonly NotificationsTabText: string = localize('createOperator.Notifications', "Notifications");

	// General tab strings
	private static readonly NameLabel: string = localize('createOperator.Name', "Name");
	private static readonly EnabledCheckboxLabel: string = localize('createOperator.Enabled', "Enabled");
	private static readonly EmailNameTextLabel: string = localize('createOperator.EmailName', "E-mail Name");
	private static readonly PagerEmailNameTextLabel: string = localize('createOperator.PagerEmailName', "Pager E-mail Name");
	private static readonly PagerMondayCheckBoxLabel: string = localize('createOperator.PagerMondayCheckBox', "Monday");
	private static readonly PagerTuesdayCheckBoxLabel: string = localize('createOperator.PagerTuesdayCheckBox', "Tuesday");
	private static readonly PagerWednesdayCheckBoxLabel: string = localize('createOperator.PagerWednesdayCheckBox', "Wednesday");
	private static readonly PagerThursdayCheckBoxLabel: string = localize('createOperator.PagerThursdayCheckBox', "Thursday");
	private static readonly PagerFridayCheckBoxLabel: string = localize('createOperator.PagerFridayCheckBox', "Friday  ");
	private static readonly PagerSaturdayCheckBoxLabel: string = localize('createOperator.PagerSaturdayCheckBox', "Saturday");
	private static readonly PagerSundayCheckBoxLabel: string = localize('createOperator.PagerSundayCheckBox', "Sunday");
	private static readonly WorkdayBeginLabel: string = localize('createOperator.workdayBegin', "Workday begin");
	private static readonly WorkdayEndLabel: string = localize('createOperator.workdayEnd', "Workday end");
	private static readonly PagerDutyScheduleLabel: string = localize('createOperator.PagerDutySchedule', "Pager on duty schedule");

	// Notifications tab strings
	private static readonly AlertsTableLabel: string = localize('createOperator.AlertListHeading', "Alert list");
	private static readonly AlertNameColumnLabel: string = localize('createOperator.AlertNameColumnLabel', "Alert name");
	private static readonly AlertEmailColumnLabel: string = localize('createOperator.AlertEmailColumnLabel', "E-mail");
	private static readonly AlertPagerColumnLabel: string = localize('createOperator.AlertPagerColumnLabel', "Pager");

	// Event strings
	private readonly NewOperatorDialog = 'NewOperatorDialogOpened';
	private readonly EditOperatorDialog = 'EditOperatorDialogOpened';

	// UI Components
	private generalTab: azdata.window.DialogTab;
	private notificationsTab: azdata.window.DialogTab;

	// General tab controls
	private nameTextBox: azdata.InputBoxComponent;
	private enabledCheckBox: azdata.CheckBoxComponent;
	private emailNameTextBox: azdata.InputBoxComponent;
	private pagerEmailNameTextBox: azdata.InputBoxComponent;
	private pagerMondayCheckBox: azdata.CheckBoxComponent;
	private pagerTuesdayCheckBox: azdata.CheckBoxComponent;
	private pagerWednesdayCheckBox: azdata.CheckBoxComponent;
	private pagerThursdayCheckBox: azdata.CheckBoxComponent;
	private pagerFridayCheckBox: azdata.CheckBoxComponent;
	private pagerSaturdayCheckBox: azdata.CheckBoxComponent;
	private pagerSundayCheckBox: azdata.CheckBoxComponent;
	private weekdayPagerStartTimeInput: azdata.InputBoxComponent;
	private weekdayPagerEndTimeInput: azdata.InputBoxComponent;
	private saturdayPagerStartTimeInput: azdata.InputBoxComponent;
	private saturdayPagerEndTimeInput: azdata.InputBoxComponent;
	private sundayPagerStartTimeInput: azdata.InputBoxComponent;
	private sundayPagerEndTimeInput: azdata.InputBoxComponent;

	// Notification tab controls
	private alertsTable: azdata.TableComponent;
	private isEdit: boolean = false;

	constructor(ownerUri: string, operatorInfo: azdata.AgentOperatorInfo = undefined) {
		super(
			ownerUri,
			new OperatorData(ownerUri, operatorInfo),
			operatorInfo ? OperatorDialog.EditDialogTitle : OperatorDialog.CreateDialogTitle);
		this.isEdit = operatorInfo ? true : false;
		this.dialogName = this.isEdit ? this.EditOperatorDialog : this.NewOperatorDialog;
	}

	protected async initializeDialog(dialog: azdata.window.Dialog) {
		this.generalTab = azdata.window.createTab(OperatorDialog.GeneralTabText);
		this.notificationsTab = azdata.window.createTab(OperatorDialog.NotificationsTabText);

		this.initializeGeneralTab();
		this.initializeNotificationTab();

		this.dialog.content = [this.generalTab, this.notificationsTab];
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {

			this.nameTextBox = view.modelBuilder.inputBox().withProperties({
				ariaLabel: OperatorDialog.NameLabel,
				placeHolder: OperatorDialog.NameLabel
			}).component();
			this.nameTextBox.value = this.model.name;
			this.emailNameTextBox = view.modelBuilder.inputBox().withProperties({
				ariaLabel: OperatorDialog.EmailNameTextLabel,
				placeHolder: OperatorDialog.EmailNameTextLabel
			}).component();
			this.emailNameTextBox.value = this.model.emailAddress;

			this.pagerEmailNameTextBox = view.modelBuilder.inputBox().withProperties({
				ariaLabel: OperatorDialog.PagerEmailNameTextLabel,
				placeHolder: OperatorDialog.PagerEmailNameTextLabel
			}).component();
			this.pagerEmailNameTextBox.value = this.model.pagerAddress;

			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.EnabledCheckboxLabel
				}).component();
			this.enabledCheckBox.checked = this.model.enabled;

			this.pagerMondayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerMondayCheckBoxLabel
				}).component();

			this.pagerMondayCheckBox.onChanged(() => {
				if (this.pagerMondayCheckBox.checked) {
					this.weekdayPagerStartTimeInput.enabled = true;
					this.weekdayPagerEndTimeInput.enabled = true;
				} else {
					if (!this.pagerTuesdayCheckBox.checked && !this.pagerWednesdayCheckBox.checked &&
						!this.pagerThursdayCheckBox.checked && !this.pagerFridayCheckBox.checked) {
						this.weekdayPagerStartTimeInput.enabled = false;
						this.weekdayPagerEndTimeInput.enabled = false;
					}
				}
			});

			this.pagerTuesdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerTuesdayCheckBoxLabel
				}).component();


			this.pagerTuesdayCheckBox.onChanged(() => {
				if (this.pagerTuesdayCheckBox.checked) {
					this.weekdayPagerStartTimeInput.enabled = true;
					this.weekdayPagerEndTimeInput.enabled = true;
				} else {
					if (!this.pagerMondayCheckBox.checked && !this.pagerWednesdayCheckBox.checked &&
						!this.pagerThursdayCheckBox.checked && !this.pagerFridayCheckBox.checked) {
						this.weekdayPagerStartTimeInput.enabled = false;
						this.weekdayPagerEndTimeInput.enabled = false;
					}
				}
			});

			this.pagerWednesdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerWednesdayCheckBoxLabel
				}).component();

			this.pagerWednesdayCheckBox.onChanged(() => {
				if (this.pagerWednesdayCheckBox.checked) {
					this.weekdayPagerStartTimeInput.enabled = true;
					this.weekdayPagerEndTimeInput.enabled = true;
				} else {
					if (!this.pagerMondayCheckBox.checked && !this.pagerTuesdayCheckBox.checked &&
						!this.pagerThursdayCheckBox.checked && !this.pagerFridayCheckBox.checked) {
						this.weekdayPagerStartTimeInput.enabled = false;
						this.weekdayPagerEndTimeInput.enabled = false;
					}
				}
			});

			this.pagerThursdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerThursdayCheckBoxLabel
				}).component();

			this.pagerThursdayCheckBox.onChanged(() => {
				if (this.pagerThursdayCheckBox.checked) {
					this.weekdayPagerStartTimeInput.enabled = true;
					this.weekdayPagerEndTimeInput.enabled = true;
				} else {
					if (!this.pagerMondayCheckBox.checked && !this.pagerWednesdayCheckBox.checked &&
						!this.pagerTuesdayCheckBox.checked && !this.pagerFridayCheckBox.checked) {
						this.weekdayPagerStartTimeInput.enabled = false;
						this.weekdayPagerEndTimeInput.enabled = false;
					}
				}
			});

			this.weekdayPagerStartTimeInput = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'time',
					placeHolder: '08:00:00',
				}).component();
			this.weekdayPagerStartTimeInput.enabled = false;
			let weekdayStartInputContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.weekdayPagerStartTimeInput,
					title: OperatorDialog.WorkdayBeginLabel
				}]).component();

			this.weekdayPagerEndTimeInput = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'time',
					placeHolder: '06:00:00'
				}).component();
			this.weekdayPagerEndTimeInput.enabled = false;
			let weekdayEndInputContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.weekdayPagerEndTimeInput,
					title: OperatorDialog.WorkdayEndLabel
				}]).component();

			this.pagerFridayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerFridayCheckBoxLabel
				}).component();
			this.pagerFridayCheckBox.onChanged(() => {
				if (this.pagerFridayCheckBox.checked) {
					this.weekdayPagerStartTimeInput.enabled = true;
					this.weekdayPagerEndTimeInput.enabled = true;
				} else {
					if (!this.pagerMondayCheckBox.checked && !this.pagerWednesdayCheckBox.checked &&
						!this.pagerThursdayCheckBox.checked && !this.pagerTuesdayCheckBox.checked) {
						this.weekdayPagerStartTimeInput.enabled = false;
						this.weekdayPagerEndTimeInput.enabled = false;
					}
				}
			});

			let pagerFridayCheckboxContainer = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'row',
					alignItems: 'baseline',
					width: '100%'
				}).withItems([this.pagerFridayCheckBox, weekdayStartInputContainer, weekdayEndInputContainer])
				.component();

			this.pagerSaturdayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerSaturdayCheckBoxLabel
				}).component();

			this.pagerSaturdayCheckBox.onChanged(() => {
				if (this.pagerSaturdayCheckBox.checked) {
					this.saturdayPagerStartTimeInput.enabled = true;
					this.saturdayPagerEndTimeInput.enabled = true;
				} else {
					this.saturdayPagerStartTimeInput.enabled = false;
					this.saturdayPagerEndTimeInput.enabled = false;
				}
			});

			this.saturdayPagerStartTimeInput = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'time',
					placeHolder: '08:00:00'
				}).component();
			this.saturdayPagerStartTimeInput.enabled = false;
			let saturdayStartInputContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.saturdayPagerStartTimeInput,
					title: OperatorDialog.WorkdayBeginLabel
				}]).component();

			this.saturdayPagerEndTimeInput = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'time',
					placeHolder: '06:00:00'
				}).component();
			this.saturdayPagerEndTimeInput.enabled = false;
			let saturdayEndInputContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.saturdayPagerEndTimeInput,
					title: OperatorDialog.WorkdayEndLabel
				}]).component();

			let pagerSaturdayCheckboxContainer = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'row',
					alignItems: 'baseline'
				}).withItems([this.pagerSaturdayCheckBox, saturdayStartInputContainer, saturdayEndInputContainer])
				.component();

			this.pagerSundayCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: OperatorDialog.PagerSundayCheckBoxLabel
				}).component();

			this.pagerSundayCheckBox.onChanged(() => {
				if (this.pagerSundayCheckBox.checked) {
					this.sundayPagerStartTimeInput.enabled = true;
					this.sundayPagerEndTimeInput.enabled = true;
				} else {
					this.sundayPagerStartTimeInput.enabled = false;
					this.sundayPagerEndTimeInput.enabled = false;
				}
			});

			this.sundayPagerStartTimeInput = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'time',
					placeHolder: '08:00:00'
				}).component();
			this.sundayPagerStartTimeInput.enabled = false;
			let sundayStartInputContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.sundayPagerStartTimeInput,
					title: OperatorDialog.WorkdayBeginLabel
				}]).component();

			this.sundayPagerEndTimeInput = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'time',
					placeHolder: '06:00:00'
				}).component();
			this.sundayPagerEndTimeInput.enabled = false;
			let sundayEndInputContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.sundayPagerEndTimeInput,
					title: OperatorDialog.WorkdayEndLabel
				}]).component();

			let pagerSundayCheckboxContainer = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'row',
					alignItems: 'baseline'
				}).withItems([this.pagerSundayCheckBox, sundayStartInputContainer, sundayEndInputContainer])
				.component();

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
					components: [{
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
					}],
					title: OperatorDialog.PagerDutyScheduleLabel
				}, {
					component: pagerFridayCheckboxContainer,
					title: ''
				}, {
					component: view.modelBuilder.separator().component(),
					title: ''
				}, {
					component: pagerSaturdayCheckboxContainer,
					title: ''
				}, {
					component: view.modelBuilder.separator().component(),
					title: ''
				}, {
					component: pagerSundayCheckboxContainer,
					title: ''
				}
				]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
		});
	}

	private initializeNotificationTab() {
		this.notificationsTab.registerContent(async view => {

			let previewTag = view.modelBuilder.text()
				.withProperties({
					value: 'Feature Preview'
				}).component();
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
					component: previewTag,
					title: ''
				}, {
					component: this.alertsTable,
					title: OperatorDialog.AlertsTableLabel
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	protected async updateModel(): Promise<void> {
		this.model.name = this.nameTextBox.value;
		this.model.enabled = this.enabledCheckBox.checked;
		this.model.emailAddress = this.emailNameTextBox.value;
		this.model.pagerAddress = this.pagerEmailNameTextBox.value;
		this.model.weekdayPagerStartTime = this.weekdayPagerStartTimeInput.value;
		this.model.weekdayPagerEndTime = this.weekdayPagerEndTimeInput.value;
		this.model.saturdayPagerStartTime = this.saturdayPagerStartTimeInput.value;
		this.model.saturdayPagerEndTime = this.saturdayPagerEndTimeInput.value;
		this.model.sundayPagerStartTime = this.sundayPagerStartTimeInput.value;
		this.model.sundayPagerEndTime = this.sundayPagerEndTimeInput.value;
	}
}
