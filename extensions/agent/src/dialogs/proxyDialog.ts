/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { AgentDialog } from './agentDialog';
import { ProxyData } from '../data/proxyData';

const localize = nls.loadMessageBundle();

export class ProxyDialog extends AgentDialog<ProxyData>  {

	// Top level
	private static readonly CreateDialogTitle: string = localize('createProxy.createProxy', 'Create Proxy');
	private static readonly EditDialogTitle: string = localize('createProxy.editProxy', 'Edit Proxy');
	private static readonly GeneralTabText: string = localize('createProxy.General', 'General');

	// General tab strings
	private static readonly ProxyNameTextBoxLabel: string = localize('createProxy.ProxyName', 'Proxy name');
	private static readonly CredentialNameTextBoxLabel: string = localize('createProxy.CredentialName', 'Credential name');
	private static readonly DescriptionTextBoxLabel: string = localize('createProxy.Description', 'Description');
	private static readonly SubsystemLabel: string = localize('createProxy.SubsystemName', 'Subsystem');
	private static readonly OperatingSystemLabel: string = localize('createProxy.OperatingSystem', 'Operating system (CmdExec)');
	private static readonly ReplicationSnapshotLabel: string = localize('createProxy.ReplicationSnapshot', 'Replication Snapshot');
	private static readonly ReplicationTransactionLogLabel: string = localize('createProxy.ReplicationTransactionLog', 'Replication Transaction-Log Reader');
	private static readonly ReplicationDistributorLabel: string = localize('createProxy.ReplicationDistributor', 'Replication Distributor');
	private static readonly ReplicationMergeLabel: string = localize('createProxy.ReplicationMerge', 'Replication Merge');
	private static readonly ReplicationQueueReaderLabel: string = localize('createProxy.ReplicationQueueReader', 'Replication Queue Reader');
	private static readonly SSASQueryLabel: string = localize('createProxy.SSASQueryLabel', 'SQL Server Analysis Services Query');
	private static readonly SSASCommandLabel: string = localize('createProxy.SSASCommandLabel', 'SQL Server Analysis Services Command');
	private static readonly SSISPackageLabel: string = localize('createProxy.SSISPackage', 'SQL Server Integration Services Package');
	private static readonly PowerShellLabel: string = localize('createProxy.PowerShell', 'PowerShell');
	private static readonly SubSystemHeadingLabel: string = localize('createProxy.subSystemHeading', 'Active to the following subsytems');

	private readonly NewProxyDialog = 'NewProxyDialogOpened';
	private readonly EditProxyDialog = 'EditProxyDialogOpened';

	// UI Components
	private generalTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	private proxyNameTextBox: sqlops.InputBoxComponent;
	private credentialNameDropDown: sqlops.DropDownComponent;
	private descriptionTextBox: sqlops.InputBoxComponent;
	private subsystemCheckBox: sqlops.CheckBoxComponent;
	private operatingSystemCheckBox: sqlops.CheckBoxComponent;
	private replicationSnapshotCheckBox: sqlops.CheckBoxComponent;
	private replicationTransactionLogCheckBox: sqlops.CheckBoxComponent;
	private replicationDistributorCheckBox: sqlops.CheckBoxComponent;
	private replicationMergeCheckbox: sqlops.CheckBoxComponent;
	private replicationQueueReaderCheckbox: sqlops.CheckBoxComponent;
	private sqlQueryCheckBox: sqlops.CheckBoxComponent;
	private sqlCommandCheckBox: sqlops.CheckBoxComponent;
	private sqlIntegrationServicesPackageCheckbox: sqlops.CheckBoxComponent;
	private powershellCheckBox: sqlops.CheckBoxComponent;

	private credentials: sqlops.CredentialInfo[];
	private isEdit: boolean = false;

	constructor(ownerUri: string, proxyInfo: sqlops.AgentProxyInfo = undefined, credentials: sqlops.CredentialInfo[]) {
		super(
			ownerUri,
			new ProxyData(ownerUri, proxyInfo),
			proxyInfo ? ProxyDialog.EditDialogTitle : ProxyDialog.CreateDialogTitle);
		this.credentials = credentials;
		this.isEdit = proxyInfo ? true : false;
		this.dialogName = this.isEdit ? this.EditProxyDialog : this.NewProxyDialog;
	}

	protected async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
		this.generalTab = sqlops.window.modelviewdialog.createTab(ProxyDialog.GeneralTabText);


		this.initializeGeneralTab();

		this.dialog.content = [this.generalTab];
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {

			this.proxyNameTextBox = view.modelBuilder.inputBox()
				.withProperties({width: 420})
				.component();

			this.credentialNameDropDown = view.modelBuilder.dropDown()
				.withProperties({
					width: 432,
					value: '',
					editable: true,
					values: this.credentials.length > 0 ? this.credentials.map(c => c.name) : ['']
				})
				.component();

			this.descriptionTextBox = view.modelBuilder.inputBox()
				.withProperties({
					width: 420,
					multiline: true,
					height: 300
				})
				.component();

			this.subsystemCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.SubsystemLabel
				}).component();

			this.subsystemCheckBox.onChanged(() => {
				if (this.subsystemCheckBox.checked) {
					this.operatingSystemCheckBox.checked = true;
					this.replicationSnapshotCheckBox.checked = true;
					this.replicationTransactionLogCheckBox.checked = true;
					this.replicationDistributorCheckBox.checked = true;
					this.replicationMergeCheckbox.checked = true;
					this.replicationQueueReaderCheckbox.checked = true;
					this.sqlQueryCheckBox.checked = true;
					this.sqlCommandCheckBox.checked = true;
					this.sqlIntegrationServicesPackageCheckbox.checked = true;
					this.powershellCheckBox.checked = true;
				} else {
					this.operatingSystemCheckBox.checked = false;
					this.replicationSnapshotCheckBox.checked = false;
					this.replicationTransactionLogCheckBox.checked = false;
					this.replicationDistributorCheckBox.checked = false;
					this.replicationMergeCheckbox.checked = false;
					this.replicationQueueReaderCheckbox.checked = false;
					this.sqlQueryCheckBox.checked = false;
					this.sqlCommandCheckBox.checked = false;
					this.sqlIntegrationServicesPackageCheckbox.checked = false;
					this.powershellCheckBox.checked = false;
				}
			});

			this.operatingSystemCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.OperatingSystemLabel
				}).component();

			this.replicationSnapshotCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.ReplicationSnapshotLabel
				}).component();

			this.replicationTransactionLogCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.ReplicationTransactionLogLabel
				}).component();

			this.replicationDistributorCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.ReplicationDistributorLabel
				}).component();

			this.replicationMergeCheckbox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.ReplicationMergeLabel
				}).component();

			this.replicationQueueReaderCheckbox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.ReplicationQueueReaderLabel
				}).component();

			this.sqlQueryCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.SSASQueryLabel
				}).component();

			this.sqlCommandCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.SSASCommandLabel
				}).component();

			this.sqlIntegrationServicesPackageCheckbox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.SSISPackageLabel
				}).component();

			this.powershellCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: ProxyDialog.PowerShellLabel
				}).component();

			let checkBoxContainer = view.modelBuilder.groupContainer()
				.withItems([this.operatingSystemCheckBox, this.replicationSnapshotCheckBox,
				this.replicationTransactionLogCheckBox, this.replicationDistributorCheckBox, this.replicationMergeCheckbox,
				this.replicationQueueReaderCheckbox, this.sqlQueryCheckBox, this.sqlCommandCheckBox, this.sqlIntegrationServicesPackageCheckbox,
				this.powershellCheckBox])
				.component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.proxyNameTextBox,
					title: ProxyDialog.ProxyNameTextBoxLabel
				}, {
					component: this.credentialNameDropDown,
					title: ProxyDialog.CredentialNameTextBoxLabel
				}, {
					component: this.descriptionTextBox,
					title: ProxyDialog.DescriptionTextBoxLabel
				}]).withLayout({ width: 420 }).component();

			await view.initializeModel(formModel);

			this.proxyNameTextBox.value = this.model.accountName;
			this.credentialNameDropDown.value = this.model.credentialName;
			this.descriptionTextBox.value = this.model.description;
		});
	}


	protected updateModel() {
		this.model.accountName = this.proxyNameTextBox.value;
		this.model.credentialName = this.credentialNameDropDown.value as string;
		this.model.credentialId = this.credentials.find(
			c => c.name === this.model.credentialName).id;
		this.model.credentialIdentity = this.credentials.find(
			c => c.name === this.model.credentialName).identity;
		this.model.description = this.descriptionTextBox.value;
	}
}
