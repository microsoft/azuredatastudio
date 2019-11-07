/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { AgentDialog } from './agentDialog';
import { AgentUtils } from '../agentUtils';
import { AlertData } from '../data/alertData';
import { OperatorDialog } from './operatorDialog';
import { JobDialog } from './jobDialog';
import { JobData } from '../data/jobData';

const localize = nls.loadMessageBundle();

export class AlertDialog extends AgentDialog<AlertData> {

	// Top level
	private static readonly CreateDialogTitle: string = localize('alertDialog.createAlert', "Create Alert");
	private static readonly EditDialogTitle: string = localize('alertDialog.editAlert', "Edit Alert");
	private static readonly GeneralTabText: string = localize('alertDialog.General', "General");
	private static readonly ResponseTabText: string = localize('alertDialog.Response', "Response");
	private static readonly OptionsTabText: string = localize('alertDialog.Options', "Options");
	private static readonly EventAlertText: string = localize('alertDialog.eventAlert', "Event alert definition");

	// General tab strings
	private static readonly NameLabel: string = localize('alertDialog.Name', "Name");
	private static readonly TypeLabel: string = localize('alertDialog.Type', "Type");
	private static readonly EnabledCheckboxLabel: string = localize('alertDialog.Enabled', "Enabled");
	private static readonly DatabaseLabel: string = localize('alertDialog.DatabaseName', "Database name");
	private static readonly ErrorNumberLabel: string = localize('alertDialog.ErrorNumber', "Error number");
	private static readonly SeverityLabel: string = localize('alertDialog.Severity', "Severity");
	private static readonly RaiseIfMessageContainsLabel: string = localize('alertDialog.RaiseAlertContains', "Raise alert when message contains");
	private static readonly MessageTextLabel: string = localize('alertDialog.MessageText', "Message text");
	private static readonly AlertSeverity001Label: string = localize('alertDialog.Severity001', "001 - Miscellaneous System Information");
	private static readonly AlertSeverity002Label: string = localize('alertDialog.Severity002', "002 - Reserved");
	private static readonly AlertSeverity003Label: string = localize('alertDialog.Severity003', "003 - Reserved");
	private static readonly AlertSeverity004Label: string = localize('alertDialog.Severity004', "004 - Reserved");
	private static readonly AlertSeverity005Label: string = localize('alertDialog.Severity005', "005 - Reserved");
	private static readonly AlertSeverity006Label: string = localize('alertDialog.Severity006', "006 - Reserved");
	private static readonly AlertSeverity007Label: string = localize('alertDialog.Severity007', "007 - Notification: Status Information");
	private static readonly AlertSeverity008Label: string = localize('alertDialog.Severity008', "008 - Notification: User Intervention Required");
	private static readonly AlertSeverity009Label: string = localize('alertDialog.Severity009', "009 - User Defined");
	private static readonly AlertSeverity010Label: string = localize('alertDialog.Severity010', "010 - Information");
	private static readonly AlertSeverity011Label: string = localize('alertDialog.Severity011', "011 - Specified Database Object Not Found");
	private static readonly AlertSeverity012Label: string = localize('alertDialog.Severity012', "012 - Unused");
	private static readonly AlertSeverity013Label: string = localize('alertDialog.Severity013', "013 - User Transaction Syntax Error");
	private static readonly AlertSeverity014Label: string = localize('alertDialog.Severity014', "014 - Insufficient Permission");
	private static readonly AlertSeverity015Label: string = localize('alertDialog.Severity015', "015 - Syntax Error in SQL Statements");
	private static readonly AlertSeverity016Label: string = localize('alertDialog.Severity016', "016 - Miscellaneous User Error");
	private static readonly AlertSeverity017Label: string = localize('alertDialog.Severity017', "017 - Insufficient Resources");
	private static readonly AlertSeverity018Label: string = localize('alertDialog.Severity018', "018 - Nonfatal Internal Error");
	private static readonly AlertSeverity019Label: string = localize('alertDialog.Severity019', "019 - Fatal Error in Resource");
	private static readonly AlertSeverity020Label: string = localize('alertDialog.Severity020', "020 - Fatal Error in Current Process");
	private static readonly AlertSeverity021Label: string = localize('alertDialog.Severity021', "021 - Fatal Error in Database Processes");
	private static readonly AlertSeverity022Label: string = localize('alertDialog.Severity022', "022 - Fatal Error: Table Integrity Suspect");
	private static readonly AlertSeverity023Label: string = localize('alertDialog.Severity023', "023 - Fatal Error: Database Integrity Suspect");
	private static readonly AlertSeverity024Label: string = localize('alertDialog.Severity024', "024 - Fatal Error: Hardware Error");
	private static readonly AlertSeverity025Label: string = localize('alertDialog.Severity025', "025 - Fatal Error");
	private static readonly AllDatabases: string = localize('alertDialog.AllDatabases', "<all databases>");

	private static readonly AlertTypes: string[] = [
		AlertData.AlertTypeSqlServerEventString,
		// Disabled until next release
		// AlertData.AlertTypePerformanceConditionString,
		// AlertData.AlertTypeWmiEventString
	];

	private static readonly AlertSeverities: string[] = [
		AlertDialog.AlertSeverity001Label,
		AlertDialog.AlertSeverity002Label,
		AlertDialog.AlertSeverity003Label,
		AlertDialog.AlertSeverity004Label,
		AlertDialog.AlertSeverity005Label,
		AlertDialog.AlertSeverity006Label,
		AlertDialog.AlertSeverity007Label,
		AlertDialog.AlertSeverity008Label,
		AlertDialog.AlertSeverity009Label,
		AlertDialog.AlertSeverity010Label,
		AlertDialog.AlertSeverity011Label,
		AlertDialog.AlertSeverity012Label,
		AlertDialog.AlertSeverity013Label,
		AlertDialog.AlertSeverity014Label,
		AlertDialog.AlertSeverity015Label,
		AlertDialog.AlertSeverity016Label,
		AlertDialog.AlertSeverity017Label,
		AlertDialog.AlertSeverity018Label,
		AlertDialog.AlertSeverity019Label,
		AlertDialog.AlertSeverity020Label,
		AlertDialog.AlertSeverity021Label,
		AlertDialog.AlertSeverity022Label,
		AlertDialog.AlertSeverity023Label,
		AlertDialog.AlertSeverity024Label,
		AlertDialog.AlertSeverity025Label
	];

	// Response tab strings
	private static readonly ExecuteJobCheckBoxLabel: string = localize('alertDialog.ExecuteJob', "Execute Job");
	private static readonly ExecuteJobTextBoxLabel: string = localize('alertDialog.ExecuteJobName', "Job Name");
	private static readonly NotifyOperatorsTextBoxLabel: string = localize('alertDialog.NotifyOperators', "Notify Operators");
	private static readonly NewJobButtonLabel: string = localize('alertDialog.NewJob', "New Job");
	private static readonly OperatorListLabel: string = localize('alertDialog.OperatorList', "Operator List");
	private static readonly OperatorNameColumnLabel: string = localize('alertDialog.OperatorName', "Operator");
	private static readonly OperatorEmailColumnLabel: string = localize('alertDialog.OperatorEmail', "E-mail");
	private static readonly OperatorPagerColumnLabel: string = localize('alertDialog.OperatorPager', "Pager");
	private static readonly NewOperatorButtonLabel: string = localize('alertDialog.NewOperator', "New Operator");

	// Options tab strings
	private static readonly IncludeErrorInEmailCheckBoxLabel: string = localize('alertDialog.IncludeErrorInEmail', "Include alert error text in e-mail");
	private static readonly IncludeErrorInPagerCheckBoxLabel: string = localize('alertDialog.IncludeErrorInPager', "Include alert error text in pager");
	private static readonly AdditionalMessageTextBoxLabel: string = localize('alertDialog.AdditionalNotification', "Additional notification message to send");
	private static readonly DelayMinutesTextBoxLabel: string = localize('alertDialog.DelayMinutes', "Delay Minutes");
	private static readonly DelaySecondsTextBoxLabel: string = localize('alertDialog.DelaySeconds', "Delay Seconds");

	// Event Name strings
	private readonly NewAlertDialog = 'NewAlertDialogOpen';
	private readonly EditAlertDialog = 'EditAlertDialogOpened';

	// UI Components
	private generalTab: azdata.window.DialogTab;
	private responseTab: azdata.window.DialogTab;
	private optionsTab: azdata.window.DialogTab;

	// General tab controls
	private nameTextBox: azdata.InputBoxComponent;
	private typeDropDown: azdata.DropDownComponent;
	private severityDropDown: azdata.DropDownComponent;
	private databaseDropDown: azdata.DropDownComponent;
	private enabledCheckBox: azdata.CheckBoxComponent;
	private errorNumberRadioButton: azdata.RadioButtonComponent;
	private severityRadioButton: azdata.RadioButtonComponent;
	private errorNumberTextBox: azdata.InputBoxComponent;

	private raiseAlertMessageCheckBox: azdata.CheckBoxComponent;
	private raiseAlertMessageTextBox: azdata.InputBoxComponent;

	// Response tab controls
	private executeJobTextBox: azdata.InputBoxComponent;
	private executeJobCheckBox: azdata.CheckBoxComponent;
	private newJobButton: azdata.ButtonComponent;
	private notifyOperatorsCheckBox: azdata.CheckBoxComponent;
	private operatorsTable: azdata.TableComponent;
	private newOperatorButton: azdata.ButtonComponent;

	// Options tab controls
	private additionalMessageTextBox: azdata.InputBoxComponent;
	private includeErrorInEmailTextBox: azdata.CheckBoxComponent;
	private includeErrorInPagerTextBox: azdata.CheckBoxComponent;
	private delayMinutesTextBox: azdata.InputBoxComponent;
	private delaySecondsTextBox: azdata.InputBoxComponent;

	private isEdit: boolean = false;
	private databases: string[];
	private jobModel: JobData;
	public jobId: string;
	public jobName: string;

	constructor(
		ownerUri: string,
		jobModel: JobData,
		alertInfo: azdata.AgentAlertInfo = undefined,
		viaJobDialog: boolean = false
	) {
		super(ownerUri,
			new AlertData(ownerUri, alertInfo, jobModel, viaJobDialog),
			alertInfo ? AlertDialog.EditDialogTitle : AlertDialog.CreateDialogTitle);
		this.jobModel = jobModel;
		this.jobId = this.jobId ? this.jobId : this.jobModel.jobId;
		this.jobName = this.jobName ? this.jobName : this.jobModel.name;
		this.isEdit = alertInfo ? true : false;
		this.dialogName = this.isEdit ? this.EditAlertDialog : this.NewAlertDialog;
	}

	protected async initializeDialog(dialog: azdata.window.Dialog) {
		this.databases = await AgentUtils.getDatabases(this.ownerUri);
		this.databases.unshift(AlertDialog.AllDatabases);

		this.generalTab = azdata.window.createTab(AlertDialog.GeneralTabText);
		this.responseTab = azdata.window.createTab(AlertDialog.ResponseTabText);
		this.optionsTab = azdata.window.createTab(AlertDialog.OptionsTabText);

		this.initializeGeneralTab(this.databases, dialog);
		this.initializeResponseTab();
		this.initializeOptionsTab();

		dialog.content = [this.generalTab, this.responseTab, this.optionsTab];
	}

	private initializeGeneralTab(databases: string[], dialog: azdata.window.Dialog) {
		this.generalTab.registerContent(async view => {
			// create controls
			this.nameTextBox = view.modelBuilder.inputBox().component();
			this.nameTextBox.required = true;
			this.nameTextBox.onTextChanged(() => {
				if (this.nameTextBox.value.length > 0) {
					dialog.okButton.enabled = true;
				} else {
					dialog.okButton.enabled = false;
				}
			});
			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.EnabledCheckboxLabel
				}).component();

			this.enabledCheckBox.checked = true;

			this.databaseDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases,
					width: '100%'
				}).component();

			this.typeDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: '',
					values: AlertDialog.AlertTypes,
					width: '100%'
				}).component();

			this.severityRadioButton = view.modelBuilder.radioButton()
				.withProperties({
					value: 'serverity',
					name: 'alertTypeOptions',
					label: AlertDialog.SeverityLabel,
					checked: true
				}).component();
			this.severityRadioButton.checked = true;

			this.severityDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: AlertDialog.AlertSeverities[0],
					values: AlertDialog.AlertSeverities,
					width: '100%'
				}).component();

			this.errorNumberRadioButton = view.modelBuilder.radioButton()
				.withProperties({
					value: 'errorNumber',
					name: 'alertTypeOptions',
					label: AlertDialog.ErrorNumberLabel
				}).component();

			this.errorNumberTextBox = view.modelBuilder.inputBox()
				.withProperties({
					width: '100%'
				})
				.component();
			this.errorNumberTextBox.enabled = false;

			this.errorNumberRadioButton.onDidClick(() => {
				this.errorNumberTextBox.enabled = true;
				this.severityDropDown.enabled = false;
			});

			this.severityRadioButton.onDidClick(() => {
				this.errorNumberTextBox.enabled = false;
				this.severityDropDown.enabled = true;
			});

			this.raiseAlertMessageCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.RaiseIfMessageContainsLabel
				}).component();

			this.raiseAlertMessageTextBox = view.modelBuilder.inputBox().component();
			this.raiseAlertMessageTextBox.enabled = false;

			this.raiseAlertMessageCheckBox.onChanged(() => {
				this.raiseAlertMessageTextBox.enabled = this.raiseAlertMessageCheckBox.checked;
			});

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: AlertDialog.NameLabel
				}, {
					component: this.enabledCheckBox,
					title: ''
				}, {
					component: this.typeDropDown,
					title: AlertDialog.TypeLabel
				}, {
					components: [{
						component: this.databaseDropDown,
						title: AlertDialog.DatabaseLabel
					},
					{
						component: this.severityRadioButton,
						title: ''
					},
					{
						component: this.severityDropDown,
						title: ''
					},
					{
						component: this.errorNumberRadioButton,
						title: ''
					},
					{
						component: this.errorNumberTextBox,
						title: ''
					},
					{
						component: this.raiseAlertMessageCheckBox,
						title: ''
					}, {
						component: this.raiseAlertMessageTextBox,
						title: AlertDialog.MessageTextLabel
					}],
					title: AlertDialog.EventAlertText
				}
				]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			// initialize control values
			this.nameTextBox.value = this.model.name;
			this.raiseAlertMessageTextBox.value = this.model.eventDescriptionKeyword;
			this.typeDropDown.value = this.model.alertType;
			this.enabledCheckBox.checked = this.model.isEnabled;

			if (this.model.messageId > 0) {
				this.errorNumberRadioButton.checked = true;
				this.errorNumberTextBox.value = this.model.messageId.toString();
			}

			if (this.model.severity > 0) {
				this.severityRadioButton.checked = true;
				this.severityDropDown.value = this.severityDropDown.values[this.model.severity - 1];
			}

			if (this.model.databaseName) {
				let idx = this.databases.indexOf(this.model.databaseName);
				if (idx >= 0) {
					this.databaseDropDown.value = this.databases[idx];
				}
			}
		});
	}

	private initializeResponseTab() {
		this.responseTab.registerContent(async view => {
			this.executeJobCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.ExecuteJobCheckBoxLabel
				}).component();

			this.executeJobTextBox = view.modelBuilder.inputBox()
				.withProperties({ width: 375 })
				.component();
			this.executeJobTextBox.enabled = false;
			this.newJobButton = view.modelBuilder.button().withProperties({
				label: AlertDialog.NewJobButtonLabel,
				width: 80
			}).component();
			this.newJobButton.enabled = false;
			this.newJobButton.onDidClick(() => {
				let jobDialog = new JobDialog(this.ownerUri);
				jobDialog.openDialog();
			});

			this.executeJobCheckBox.onChanged(() => {
				if (this.executeJobCheckBox.checked) {
					this.executeJobTextBox.enabled = true;
					this.newJobButton.enabled = true;
				} else {
					this.executeJobTextBox.enabled = false;
					this.newJobButton.enabled = false;
				}
			});

			let executeJobContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.executeJobTextBox,
					title: AlertDialog.ExecuteJobTextBoxLabel
				}, {
					component: this.newJobButton,
					title: AlertDialog.NewJobButtonLabel
				}], { componentWidth: '100%' }).component();

			let previewTag = view.modelBuilder.text()
				.withProperties({
					value: 'Feature Preview'
				}).component();

			this.notifyOperatorsCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.NotifyOperatorsTextBoxLabel
				}).component();

			this.notifyOperatorsCheckBox.enabled = false;

			this.operatorsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						AlertDialog.OperatorNameColumnLabel,
						AlertDialog.OperatorEmailColumnLabel,
						AlertDialog.OperatorPagerColumnLabel
					],
					data: [],
					height: 500,
					width: 375
				}).component();

			this.newOperatorButton = view.modelBuilder.button().withProperties({
				label: AlertDialog.NewOperatorButtonLabel,
				width: 80
			}).component();

			this.operatorsTable.enabled = false;
			this.newOperatorButton.enabled = false;

			this.newOperatorButton.onDidClick(() => {
				let operatorDialog = new OperatorDialog(this.ownerUri);
				operatorDialog.openDialog();
			});

			this.notifyOperatorsCheckBox.onChanged(() => {
				if (this.notifyOperatorsCheckBox.checked) {
					this.operatorsTable.enabled = true;
					this.newOperatorButton.enabled = true;
				} else {
					this.operatorsTable.enabled = false;
					this.newOperatorButton.enabled = false;
				}
			});

			let notifyOperatorContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.operatorsTable,
					title: AlertDialog.OperatorListLabel
				}, {
					component: this.newOperatorButton,
					title: ''
				}], { componentWidth: '100%' }).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.executeJobCheckBox,
					title: ''
				}, {
					component: executeJobContainer,
					title: ''
				}, {
					component: previewTag,
					title: ''
				}, {
					component: this.notifyOperatorsCheckBox,
					title: ''
				}, {
					component: notifyOperatorContainer,
					title: ''
				}])
				.withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeOptionsTab() {
		this.optionsTab.registerContent(async view => {

			this.includeErrorInEmailTextBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.IncludeErrorInEmailCheckBoxLabel
				}).component();

			this.includeErrorInPagerTextBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.IncludeErrorInPagerCheckBoxLabel
				}).component();

			this.additionalMessageTextBox = view.modelBuilder.inputBox().component();

			this.delayMinutesTextBox = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'number',
					placeHolder: 0
				})
				.component();

			this.delaySecondsTextBox = view.modelBuilder.inputBox()
				.withProperties({
					inputType: 'number',
					placeHolder: 0
				})
				.component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.includeErrorInEmailTextBox,
					title: ''
				}, {
					component: this.includeErrorInPagerTextBox,
					title: ''
				}, {
					component: this.additionalMessageTextBox,
					title: AlertDialog.AdditionalMessageTextBoxLabel
				}, {
					component: this.delayMinutesTextBox,
					title: AlertDialog.DelayMinutesTextBoxLabel
				}, {
					component: this.delaySecondsTextBox,
					title: AlertDialog.DelaySecondsTextBoxLabel
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private getSeverityNumber(): number {
		let selected = this.getDropdownValue(this.severityDropDown);
		let severityNumber: number = 0;
		if (selected) {
			let index = AlertDialog.AlertSeverities.indexOf(selected);
			if (index >= 0) {
				severityNumber = index + 1;
			}
		}
		return severityNumber;
	}

	protected async updateModel(): Promise<void> {
		this.model.name = this.nameTextBox.value;
		this.model.isEnabled = this.enabledCheckBox.checked;
		this.model.jobId = this.jobId;
		this.model.jobName = this.jobName;
		this.model.alertType = this.getDropdownValue(this.typeDropDown);
		let databaseName = this.getDropdownValue(this.databaseDropDown);
		this.model.databaseName = (databaseName !== AlertDialog.AllDatabases) ? databaseName : undefined;

		if (this.severityRadioButton.checked) {
			this.model.severity = this.getSeverityNumber();
			this.model.messageId = 0;
		} else {
			this.model.severity = 0;
			this.model.messageId = +this.errorNumberTextBox.value;
		}

		if (this.raiseAlertMessageCheckBox.checked) {
			this.model.eventDescriptionKeyword = this.raiseAlertMessageTextBox.value;
		} else {
			this.model.eventDescriptionKeyword = '';
		}
		let minutes = this.delayMinutesTextBox.value ? +this.delayMinutesTextBox.value : 0;
		let seconds = this.delaySecondsTextBox.value ? +this.delaySecondsTextBox : 0;
		this.model.delayBetweenResponses = minutes + seconds;

	}
}
