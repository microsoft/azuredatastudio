/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { AgentDialog } from './agentDialog';
import { AgentUtils } from '../agentUtils';
import { AlertData } from '../data/alertData';

const localize = nls.loadMessageBundle();

export class AlertDialog extends AgentDialog<AlertData> {

	// Top level
	private static readonly CreateDialogTitle: string = localize('alertDialog.createAlert', 'Create Alert');
	private static readonly EditDialogTitle: string = localize('alertDialog.editAlert', 'Edit Alert');
	private static readonly GeneralTabText: string = localize('alertDialog.General', 'General');
	private static readonly ResponseTabText: string = localize('alertDialog.Response', 'Response');
	private static readonly OptionsTabText: string = localize('alertDialog.Options', 'Options');

	// General tab strings
	private static readonly NameLabel: string = localize('alertDialog.Name', 'Name');
	private static readonly TypeLabel: string = localize('alertDialog.Type', 'Type');
	private static readonly EnabledCheckboxLabel: string = localize('alertDialog.Enabled', 'Enabled');
	private static readonly DatabaseLabel: string = localize('alertDialog.DatabaseName', 'Database name');
	private static readonly ErrorNumberLabel: string = localize('alertDialog.ErrorNumber', 'Error number');
	private static readonly SeverityLabel: string = localize('alertDialog.Severity', 'Severity');
	private static readonly RaiseIfMessageContainsLabel: string = localize('alertDialog.RaiseAlertContains', 'Raise alert when message contains');
	private static readonly MessageTextLabel: string = localize('alertDialog.MessageText', 'Message text');
	private static readonly AlertTypeSqlServerEventString: string = localize('alertDialog.SqlServerEventAlert', 'SQL Server event alert');
	private static readonly AlertTypePerformanceConditionString: string = localize('alertDialog.PerformanceCondition', 'SQL Server performance condition alert');
	private static readonly AlertTypeWmiEventString: string = localize('alertDialog.WmiEvent', 'WMI event alert');
	private static readonly AlertSeverity001Label: string = localize('alertDialog.Severity001', '001 - Miscellaneous System Information');
	private static readonly AlertSeverity002Label: string = localize('alertDialog.Severity002', '002 - Reserved');
	private static readonly AlertSeverity003Label: string = localize('alertDialog.Severity003', '003 - Reserved');
	private static readonly AlertSeverity004Label: string = localize('alertDialog.Severity004', '004 - Reserved');
	private static readonly AlertSeverity005Label: string = localize('alertDialog.Severity005', '005 - Reserved');
	private static readonly AlertSeverity006Label: string = localize('alertDialog.Severity006', '006 - Reserved');
	private static readonly AlertSeverity007Label: string = localize('alertDialog.Severity007', '007 - Notification: Status Information');
	private static readonly AlertSeverity008Label: string = localize('alertDialog.Severity008', '008 - Notification: User Intervention Required');
	private static readonly AlertSeverity009Label: string = localize('alertDialog.Severity009', '009 - User Defined');
	private static readonly AlertSeverity010Label: string = localize('alertDialog.Severity010', '010 - Information');
	private static readonly AlertSeverity011Label: string = localize('alertDialog.Severity011', '011 - Specified Database Object Not Found');
	private static readonly AlertSeverity012Label: string = localize('alertDialog.Severity012', '012 - Unused');
	private static readonly AlertSeverity013Label: string = localize('alertDialog.Severity013', '013 - User Transaction Syntax Error');
	private static readonly AlertSeverity014Label: string = localize('alertDialog.Severity014', '014 - Insufficient Permission');
	private static readonly AlertSeverity015Label: string = localize('alertDialog.Severity015', '015 - Syntax Error in SQL Statements');
	private static readonly AlertSeverity016Label: string = localize('alertDialog.Severity016', '016 - Miscellaneous User Error');
	private static readonly AlertSeverity017Label: string = localize('alertDialog.Severity017', '017 - Insufficient Resources');
	private static readonly AlertSeverity018Label: string = localize('alertDialog.Severity018', '018 - Nonfatal Internal Error');
	private static readonly AlertSeverity019Label: string = localize('alertDialog.Severity019', '019 - Fatal Error in Resource');
	private static readonly AlertSeverity020Label: string = localize('alertDialog.Severity020', '020 - Fatal Error in Current Process');
	private static readonly AlertSeverity021Label: string = localize('alertDialog.Severity021', '021 - Fatal Error in Database Processes');
	private static readonly AlertSeverity022Label: string = localize('alertDialog.Severity022', '022 - Fatal Error: Table Integrity Suspect');
	private static readonly AlertSeverity023Label: string = localize('alertDialog.Severity023', '023 - Fatal Error: Database Integrity Suspect');
	private static readonly AlertSeverity024Label: string = localize('alertDialog.Severity024', '024 - Fatal Error: Hardware Error');
	private static readonly AlertSeverity025Label: string = localize('alertDialog.Severity025', '025 - Fatal Error');

	private static readonly AlertTypes: string[]  = [
		AlertDialog.AlertTypeSqlServerEventString,
		AlertDialog.AlertTypePerformanceConditionString,
		AlertDialog.AlertTypeWmiEventString
	];

	private static readonly AlertSeverities: string[]  = [
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
	private static readonly ExecuteJobCheckBoxLabel: string = localize('alertDialog.ExecuteJob', 'Execute Job');
	private static readonly ExecuteJobTextBoxLabel: string = localize('alertDialog.ExecuteJobName', 'Job Name');
	private static readonly NotifyOperatorsTextBoxLabel: string =  localize('alertDialog.NotifyOperators', 'Notify Operators');
	private static readonly NewJobButtonLabel: string =  localize('alertDialog.NewJob', 'New Job');
	private static readonly OperatorListLabel: string =  localize('alertDialog.OperatorList', 'Operator List');
	private static readonly OperatorNameColumnLabel: string =  localize('alertDialog.OperatorName', 'Operator');
	private static readonly OperatorEmailColumnLabel: string =  localize('alertDialog.OperatorEmail', 'E-mail');
	private static readonly OperatorPagerColumnLabel: string =  localize('alertDialog.OperatorPager', 'Pager');
	private static readonly NewOperatorButtonLabel: string =  localize('alertDialog.NewOperator', 'New Operator');

	// Options tab strings
	private static readonly IncludeErrorInEmailCheckBoxLabel: string =  localize('alertDialog.IncludeErrorInEmail', 'Include alert error text in e-mail');
	private static readonly IncludeErrorInPagerCheckBoxLabel: string =  localize('alertDialog.IncludeErrorInPager', 'Include alert error text in pager');
	private static readonly AdditionalMessageTextBoxLabel: string =  localize('alertDialog.AdditionalNotification', 'Additional notification message to send');
	private static readonly DelayBetweenResponsesTextBoxLabel: string =  localize('alertDialog.DelayBetweenResponse', 'Delay between responses');
	private static readonly DelayMinutesTextBoxLabel: string =  localize('alertDialog.DelayMinutes', 'Delay Minutes');
	private static readonly DelaySecondsTextBoxLabel: string =  localize('alertDialog.DelaySeconds', 'Delay Seconds');

	// Object dropdown strings
	private static readonly AccessMethodsLabel: string = localize('alertDialog.AccessMethods', 'Access Methods');
	private static readonly AdvancedAnalyticsLabel: string = localize('alertDialog.AdvancedAnalyticsLabel', 'Advanced Analytics');
	private static readonly AvailabilityReplicaLabel: string = localize('alertDialog.AvailabilityReplica', 'Availability Replica');
	private static readonly BatchRespStatisticsLabel: string = localize('alertDialog.BatchRespStatistics', 'Batch Resp Statistics');
	private static readonly BrokerActivationLabel: string = localize('alertDialog.BrokerActivation', 'Broker Activation');
	private static readonly BrokerStatisticsLabel: string = localize('alertDialog.BrokerStatistics', 'Broker Statistics');
	private static readonly BrokerTOStatisticsLabel: string = localize('alertDialog.BrokerTOStatistics', 'Broker TO Statistics');
	private static readonly BrokerDBMTransportLabel: string = localize('alertDialog.BrokerDBMTransport', 'Broker/DBM Transport');
	private static readonly BufferManagerLabel: string = localize('alertDialog.BufferManager', 'Buffer Manager');
	private static readonly BufferNodeLabel: string = localize('alertDialog.BufferNode', 'Buffer Node');
	private static readonly CatalogMetadataLabel: string = localize('alertDialog.CatalogMetadata', 'Catalog Metadata');
	private static readonly CLRLabel: string = localize('alertDialog.CLR', 'CLR');
	private static readonly ColumnstoreLabel: string = localize('alertDialog.Columnstore', 'Columnstore');
	private static readonly CursorManagerLabel: string = localize('alertDialog.CursorManagerLabel', 'Cursor Manager by Type');
	private static readonly CursorManagerTotalLabel: string = localize('alertDialog.CursorManagerTotalLabel', 'Cursor Manager Total');
	private static readonly DatabaseReplicaLabel: string = localize('alertDialog.DatabaseReplica', 'Database Replica');
	private static readonly DatabasesLabel: string = localize('alertDialog.DatabasesLabel', 'Databases');
	private static readonly DeprecatedFeaturesLabel: string = localize('alertDialog.DeprecatedFeatures', 'Deprecated Features');
	private static readonly ExecStatisticsLabel: string = localize('alertDialog.ExecStatistics', 'Exec Statistics');
	private static readonly ExternalScriptsLabel: string = localize('alertDialog.ExternalScripts', 'External Scripts');
	private static readonly FileTableLabel: string = localize('alertDialog.FileTable', 'File Table');
	private static readonly GeneralStatisticsLabel: string = localize('alertDialog.GeneralStatistics', 'General Statistics');
	private static readonly HTTPStorageLabel: string = localize('alertDialog.HTTPStorage', 'HTTP Storage');
	private static readonly LatchesLabel: string = localize('alertDialog.Latches', 'Latches');
	private static readonly LocksLabel: string = localize('alertDialog.Locks', 'Locks');
	private static readonly LogPoolFreePoolLabel: string = localize('alertDialog.LogPoolFreePool', 'LogPool FreePool');
	private static readonly MemoryBrokerClerksLabel: string = localize('alertDialog.MemoryBrokerClerks', 'Memory Broker Clerks');
	private static readonly MemoryManagerLabel: string = localize('alertDialog.MemoryManager', 'Memory Manager');
	private static readonly MemoryNodeLabel: string = localize('alertDialog.MemoryNode', 'Memory Node');
	private static readonly PlanCacheLabel: string = localize('alertDialog.PlanCache', 'Plan Cache');
	private static readonly QueryStoreLabel: string = localize('alertDialog.QueryStore', 'Query Store');
	private static readonly ResourcePoolStatsLabel: string = localize('alertDialog.ResourcePoolStats', 'Resource Pool Stats');
	private static readonly SQLErrorsLabel: string = localize('alertDialog.SQLErrors', 'SQL Errors');
	private static readonly SQLServer2017XTPCursorsLabel: string = localize('alertDialog.SQLServer2017XTPCursors', 'SQL Server 2017 XTP Cursors');
	private static readonly SQLServer2017XTPGarbageCollectionLabel: string = localize('alertDialog.SQLServer2017XTPGarbageCollection', 'SQL Server 2017 XTP Garbage Collection');
	private static readonly SQLServer2017XTPIOGovernerLabel: string = localize('alertDialog.SQLServer2017XTPIOGoverner', 'SQL Server 2017 XTP IO Governer');
	private static readonly SQLServer2017XTPPhantomProcessorLabel: string = localize('alertDialog.SQLServer2017XTPPhantomProcessor', 'SQL Server 2017 XTP Phantom Processor');
	private static readonly SQLServer2017XTPStorageLabel: string = localize('alertDialog.SQLServer2017XTPStorage', 'SQL Server 2017 XTP Storage');
	private static readonly SQLServer2017XTPTransactionLogLabel: string = localize('alertDialog.SQLServer2017XTPTransactionLog', 'SQL Server 2017 XTP Transaction Log');
	private static readonly SQLServer2017XTPTransactionsLabel: string = localize('alertDialog.SQLServer2017XTPTransactions', 'SQL Server 2017 XTP Transactions');
	private static readonly TransactionsLabel: string = localize('alertDialog.Transactions', 'Transactions');
	private static readonly UserSettableLabel: string = localize('alertDialog.UserSettable', 'User Settable');
	private static readonly WaitStatisticsLabel: string = localize('alertDialog.WaitStatistics', 'Wait Statistics');
	private static readonly WorkloadGroupStats: string = localize('alertDialog.WorkloadGroupStats', 'Workload Group Stats');
	private static readonly ObjectDropdownOptions: string[] = [AlertDialog.AccessMethodsLabel, AlertDialog.AdvancedAnalyticsLabel, AlertDialog.AvailabilityReplicaLabel,
		AlertDialog.BatchRespStatisticsLabel, AlertDialog.BrokerActivationLabel, AlertDialog.BrokerStatisticsLabel, AlertDialog.BrokerTOStatisticsLabel, AlertDialog.BrokerDBMTransportLabel,
		AlertDialog.BufferManagerLabel, AlertDialog.BufferNodeLabel, AlertDialog.CatalogMetadataLabel, AlertDialog.CLRLabel, AlertDialog.ColumnstoreLabel,
		AlertDialog.CursorManagerLabel, AlertDialog.CursorManagerTotalLabel, AlertDialog.DatabaseReplicaLabel, AlertDialog.DatabasesLabel, AlertDialog.DeprecatedFeaturesLabel,
		AlertDialog.ExecStatisticsLabel, AlertDialog.ExternalScriptsLabel, AlertDialog.FileTableLabel, AlertDialog.GeneralStatisticsLabel, AlertDialog.HTTPStorageLabel,
		AlertDialog.LatchesLabel, AlertDialog.LocksLabel, AlertDialog.LogPoolFreePoolLabel, AlertDialog.MemoryBrokerClerksLabel, AlertDialog.MemoryManagerLabel,
		AlertDialog.MemoryNodeLabel, AlertDialog.PlanCacheLabel, AlertDialog.QueryStoreLabel, AlertDialog.ResourcePoolStatsLabel, AlertDialog.SQLErrorsLabel,
		AlertDialog.SQLServer2017XTPCursorsLabel, AlertDialog.SQLServer2017XTPGarbageCollectionLabel, AlertDialog.SQLServer2017XTPIOGovernerLabel,
		AlertDialog.SQLServer2017XTPPhantomProcessorLabel, AlertDialog.SQLServer2017XTPStorageLabel, AlertDialog.SQLServer2017XTPTransactionLogLabel,
		AlertDialog.SQLServer2017XTPTransactionsLabel, AlertDialog.TransactionsLabel, AlertDialog.UserSettableLabel, AlertDialog.WaitStatisticsLabel,
		AlertDialog.WorkloadGroupStats];

	// UI Components
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private responseTab: sqlops.window.modelviewdialog.DialogTab;
	private optionsTab: sqlops.window.modelviewdialog.DialogTab;

	// Form Models
	private eventAlertFormModel: sqlops.FormContainer;
	private performanceConditionAlertFormModel: sqlops.FormContainer;
	private wmiEventFormModel: sqlops.FormContainer;

	// General tab controls
	private nameTextBox: sqlops.InputBoxComponent;
	private typeDropDown: sqlops.DropDownComponent;
	private severityDropDown: sqlops.DropDownComponent;
	private errorNumberTextBox: sqlops.InputBoxComponent;
	private databaseDropDown: sqlops.DropDownComponent;
	private enabledCheckBox: sqlops.CheckBoxComponent;
	private raiseAlertMessageCheckBox: sqlops.CheckBoxComponent;
	private raiseAlertMessageTextBox: sqlops.InputBoxComponent;
	private severityRadioButton: sqlops.RadioButtonComponent;
	private errorNumberRadioButton: sqlops.RadioButtonComponent;
	private objectDropDown: sqlops.DropDownComponent;

	// Response tab controls
	private executeJobDropdown: sqlops.DropDownComponent;
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

	private jobs: string[];

	constructor(ownerUri: string, alertInfo: sqlops.AgentAlertInfo = null, jobs: string[]) {
		super(ownerUri,
			new AlertData(ownerUri, alertInfo),
			alertInfo ? AlertDialog.EditDialogTitle : AlertDialog.CreateDialogTitle);
			this.jobs = jobs;
	}

	protected async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
		let databases = await AgentUtils.getDatabases(this.ownerUri);
		this.generalTab = sqlops.window.modelviewdialog.createTab(AlertDialog.GeneralTabText);
		this.responseTab = sqlops.window.modelviewdialog.createTab(AlertDialog.ResponseTabText);
		this.optionsTab = sqlops.window.modelviewdialog.createTab(AlertDialog.OptionsTabText);

		this.initializeGeneralTab(databases);
		this.initializeResponseTab();
		this.initializeOptionsTab();

		dialog.content = [this.generalTab, this.responseTab, this.optionsTab];
	}

	private initializeGeneralTab(databases: string[]) {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();

			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.EnabledCheckboxLabel
				}).component();

			this.enabledCheckBox.checked = true;

			this.typeDropDown = view.modelBuilder.dropDown()
			.withProperties({
				value: '',
				values: AlertDialog.AlertTypes
			}).component();

			this.initializeSqlServerEventAlert(view, databases);
		});
	}

	private async initializeSqlServerPerformanceConditionAlert(view: sqlops.ModelView) {
		this.objectDropDown = view.modelBuilder.dropDown()
			.withProperties({
				value: '',
				values: AlertDialog.ObjectDropdownOptions
			}).component();
		this.performanceConditionAlertFormModel = view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.nameTextBox,
				title: AlertDialog.NameLabel
			}, {
				component: this.typeDropDown,
				title: AlertDialog.TypeLabel
			}, {
				component: this.objectDropDown,
				title: 'Object'
			}]).component();
	}

	private async initializeSqlServerEventAlert(view: sqlops.ModelView, databases: string[]) {
		this.databaseDropDown = view.modelBuilder.dropDown()
		.withProperties({
			value: databases[0],
			values: databases
		}).component();

		this.severityDropDown = view.modelBuilder.dropDown()
			.withProperties({
				value: AlertDialog.AlertSeverities[0],
				values: AlertDialog.AlertSeverities,
				width: 320
			}).component();

		let severityFormContainer = view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.severityDropDown,
				title: ''
			}]).component();

		this.severityRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				value: 'Severity',
				name: 'radioButtonOptions',
				label: AlertDialog.SeverityLabel
			}).component();

		this.severityRadioButton.checked = true;
		this.severityDropDown.enabled = true;

		this.severityRadioButton.onDidClick(() => {
			this.errorNumberTextBox.enabled = false;
			this.errorNumberRadioButton.checked = false;
			this.severityDropDown.enabled = true;
		});

		this.errorNumberTextBox = view.modelBuilder.inputBox()
			.withProperties({
				inputType: 'text',
				placeHolder: '1',
				width: 320
			}).component();

		let errorNumberFormContainer = view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.errorNumberTextBox,
				title: ''
			}]).component();

		this.errorNumberRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				value: 'Error Number',
				name: 'radioButtonOptions',
				label: AlertDialog.ErrorNumberLabel
			}).component();

		this.errorNumberRadioButton.checked = false;

		this.errorNumberRadioButton.onDidClick(() => {
			this.severityRadioButton.checked = false;
			this.errorNumberTextBox.enabled = true;
			this.severityDropDown.enabled = false;
		});

		this.raiseAlertMessageCheckBox = view.modelBuilder.checkBox()
			.withProperties({
				label: AlertDialog.RaiseIfMessageContainsLabel
			}).component();

		this.raiseAlertMessageTextBox = view.modelBuilder.inputBox()
			.withProperties({
				width: 320
			})
			.component();
		this.raiseAlertMessageTextBox.enabled = false;
		let raiseAlertMessageContainer = view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.raiseAlertMessageTextBox,
				title: AlertDialog.MessageTextLabel
			}])
			.component();

		this.raiseAlertMessageCheckBox.onChanged(() => {
			if (this.raiseAlertMessageCheckBox.checked) {
				this.raiseAlertMessageTextBox.enabled = true;
			} else {
				this.raiseAlertMessageTextBox.enabled = false;
			}
		});
		let flexRadioButtonContainer = view.modelBuilder.flexContainer()
		.withLayout({
			flexFlow: 'column'
		}).withItems([this.errorNumberRadioButton, errorNumberFormContainer,
			this.severityRadioButton, severityFormContainer, this.raiseAlertMessageCheckBox,
			raiseAlertMessageContainer])
		.component();

		this.eventAlertFormModel = view.modelBuilder.formContainer()
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
				component: this.databaseDropDown,
				title: AlertDialog.DatabaseLabel
			}, {
				component: flexRadioButtonContainer,
				title: ''
			}
		]).withLayout({ width: '100%' }).component();

		let flexModel = view.modelBuilder.flexContainer()
			.withItems([this.eventAlertFormModel]).component();

		await view.initializeModel(flexModel);

		this.nameTextBox.value = this.model.name;
		this.enabledCheckBox.checked = this.model.isEnabled;
	}

	private initializeResponseTab() {
		this.responseTab.registerContent(async view => {
			this.executeJobCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.ExecuteJobCheckBoxLabel
				}).component();

			this.executeJobDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: this.jobs[0],
					values: this.jobs,
					width: 380
				}).component();

			this.executeJobDropdown.editable = true;
			this.executeJobDropdown.enabled = false;
			this.newJobButton = view.modelBuilder.button().withProperties({
					label: AlertDialog.NewJobButtonLabel,
					width: 80
				}).component();
			this.newJobButton.enabled = false;

			let executeJobContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.executeJobDropdown,
					title: AlertDialog.ExecuteJobTextBoxLabel
				},{ component: this.newJobButton,
					title: ''
				}])
				.component();

			this.executeJobCheckBox.onChanged(() => {
				if (this.executeJobCheckBox.checked) {
					this.executeJobDropdown.enabled = true;
					this.newJobButton.enabled = true;
				} else {
					this.executeJobDropdown.enabled = false;
					this.newJobButton.enabled = false;
				}
			});

			this.notifyOperatorsCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.NotifyOperatorsTextBoxLabel
				}).component();

			this.operatorsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						AlertDialog.OperatorNameColumnLabel,
						AlertDialog.OperatorEmailColumnLabel,
						AlertDialog.OperatorPagerColumnLabel
					],
					data: [],
					height: 500,
					width: 380
				}).component();

			this.newOperatorButton = view.modelBuilder.button().withProperties({
					label: AlertDialog.NewOperatorButtonLabel,
					width: 80
				}).component();

			this.operatorsTable.enabled = false;
			this.newOperatorButton.enabled = false;

			let operatorContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.operatorsTable,
					title: AlertDialog.OperatorListLabel
				}, {
					component: this.newOperatorButton,
					title: ''
				}])
				.component();

			this.notifyOperatorsCheckBox.onChanged(() => {
				if (this.notifyOperatorsCheckBox.checked) {
					this.operatorsTable.enabled = true;
					this.newOperatorButton.enabled = true;
				} else {
					this.operatorsTable.enabled = false;
					this.newOperatorButton.enabled = false;
				}
			});

			let flexModel = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				})
				.withItems([this.executeJobCheckBox, executeJobContainer, this.notifyOperatorsCheckBox, operatorContainer])
				.component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: flexModel,
					title: ''
				}]).withLayout({ width: '100%' }).component();

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

			this.additionalMessageTextBox = view.modelBuilder.inputBox()
				.withProperties({
					multiline: true,
					height: 150,
					inputType: 'text'
				})
				.component();

			this.delayMinutesTextBox = view.modelBuilder.inputBox()
				.withValidation(component => +component.value >= 0)
				.withProperties({
					inputType: 'number'
				})
				.component();

			this.delaySecondsTextBox = view.modelBuilder.inputBox()
				.withValidation(component => +component.value >= 0)
				.withProperties({
					inputType: 'number'
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
		} else {
			let errorNumber = +this.errorNumberTextBox.value;
			if (errorNumber) {
				severityNumber = errorNumber;
			}
		}
		return severityNumber;
	}

	protected updateModel() {
		this.model.name = this.nameTextBox.value;
		this.model.isEnabled = this.enabledCheckBox.checked;
		this.model.alertType = this.getDropdownValue(this.typeDropDown);
		this.model.databaseName = this.getDropdownValue(this.databaseDropDown);
		this.model.severity = this.getSeverityNumber();
		this.model.messageId = undefined;

		let raiseIfError = this.raiseAlertMessageCheckBox.checked;
		if (raiseIfError) {
			let messageText = this.raiseAlertMessageTextBox.value;
		}
		this.model.notificationMessage = this.additionalMessageTextBox.value;
		this.model.delayBetweenResponses = +this.delayMinutesTextBox.value * 60 + +this.delaySecondsTextBox.value;
	}
}
