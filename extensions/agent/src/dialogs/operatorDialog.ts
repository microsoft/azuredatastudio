/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { OperatorData } from '../data/operatorData';
import * as nls from 'vscode-nls';
import { AgentDialog } from './agentDialog';

const localize = nls.loadMessageBundle();
interface Updatable {
	update(): void
}

class PagerDutyTimeBox implements Updatable {
	private readonly workdayBeginInputBox: azdata.InputBoxComponent;
	private readonly workdayEndInputBox: azdata.InputBoxComponent;
	private _container: azdata.FormContainer[];

	constructor(
		private readonly view: azdata.ModelView,

		private readonly beginLabel: string,
		private readonly endLabel: string,

		private readonly workDayBeginObserver: (newValue: string) => void,
		private readonly workdayEndObserver: (newValue: string) => void
	) {
		this.workdayBeginInputBox = this.view.modelBuilder.inputBox()
			.withProperties({
				inputType: 'time',
				placeHolder: '08:00:00',
			}).component();
		this.workdayBeginInputBox.enabled = false;

		this.workdayEndInputBox = this.view.modelBuilder.inputBox()
			.withProperties({
				inputType: 'time',
				placeHolder: '06:00:00'
			}).component();
		this.workdayEndInputBox.enabled = false;
	}

	public update(): void {
		this.workDayBeginObserver(this.workdayBeginInputBox.value);
		this.workdayEndObserver(this.workdayEndInputBox.value);
	}

	public createContainer() {
		if (this._container) {
			return this._container;
		}
		const beginContainer = this.view.modelBuilder.formContainer().withFormItems([
			{
				component: this.workdayBeginInputBox,
				title: this.beginLabel,
			}
		]).component();

		const endContainer = this.view.modelBuilder.formContainer().withFormItems([
			{
				component: this.workdayEndInputBox,
				title: this.endLabel,
			}
		]).component();

		this._container = [beginContainer, endContainer];
		return this._container;
	}

	public enable() {
		this.workdayBeginInputBox.enabled = true;
		this.workdayEndInputBox.enabled = true;
	}

	public disable() {
		this.workdayBeginInputBox.enabled = false;
		this.workdayEndInputBox.enabled = false;
	}
}
class PagerDutySchedule implements Updatable {
	private readonly checkBox: azdata.CheckBoxComponent;

	constructor(
		checkboxLabel: string,
		private readonly timebox: PagerDutyTimeBox,
		private readonly view: azdata.ModelView,

	) {
		this.checkBox = this.view.modelBuilder.checkBox()
			.withProperties({
				label: checkboxLabel
			}).component();

		this.attachListeners();
	}

	public update(): void {
		this.timebox.update();
	}

	private attachListeners() {
		this.checkBox.onChanged(() => {
			if (this.checkBox.checked) {
				this.timebox.enable();
			} else {
				this.timebox.disable();
			}
		});

	}

	public createContainer(): azdata.FlexContainer {
		return this.view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			alignItems: 'baseline',
			width: '100%'
		}).withItems([this.checkBox, ...this.timebox.createContainer()])
			.component();
	}
}

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

	private pagerDutySchedules: PagerDutySchedule[];


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
		const nameOfDays = [OperatorDialog.PagerMondayCheckBoxLabel, OperatorDialog.PagerTuesdayCheckBoxLabel,
		OperatorDialog.PagerWednesdayCheckBoxLabel, OperatorDialog.PagerThursdayCheckBoxLabel, OperatorDialog.PagerFridayCheckBoxLabel,
		OperatorDialog.PagerSaturdayCheckBoxLabel, OperatorDialog.PagerSundayCheckBoxLabel];

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

			const weekdayTime = new PagerDutyTimeBox(view, OperatorDialog.WorkdayBeginLabel, OperatorDialog.WorkdayEndLabel,
				((value) => {
					this.model.weekdayPagerStartTime = value;
				}), ((value) => {
					this.model.weekdayPagerEndTime = value;
				})
			);

			const saturdayTime = new PagerDutyTimeBox(view, OperatorDialog.WorkdayBeginLabel, OperatorDialog.WorkdayEndLabel,
				((value) => {
					this.model.saturdayPagerStartTime = value;
				}), ((value) => {
					this.model.saturdayPagerEndTime = value;
				})
			);

			const sundayTime = new PagerDutyTimeBox(view, OperatorDialog.WorkdayBeginLabel, OperatorDialog.WorkdayEndLabel,
				((value) => {
					this.model.sundayPagerStartTime = value;
				}), ((value) => {
					this.model.sundayPagerEndTime = value;
				})
			);

			this.pagerDutySchedules = nameOfDays.map((day, index) => {
				let timebox: PagerDutyTimeBox;
				if (index < 5) {
					timebox = weekdayTime;
				} else if (index === 5) {
					timebox = saturdayTime;
				} else {
					timebox = sundayTime;
				}

				return new PagerDutySchedule(day, timebox, view);
			});

			const pagerDutyScheduleComponents: azdata.FormComponent[] = this.pagerDutySchedules.map(c => {
				return {
					title: '',
					component: c.createContainer()
				};
			});


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
					components: pagerDutyScheduleComponents,
					title: OperatorDialog.PagerDutyScheduleLabel
				}]).withLayout({ width: '100%' }).component();
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

		this.pagerDutySchedules.forEach(c => c.update());
	}
}
