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
	private static readonly DialogTitle: string = localize('createProxy.createAlert', 'Create Alert');
	private static readonly GeneralTabText: string = localize('createProxy.General', 'General');

	// General tab strings
	private static readonly ProxyNameTextBoxLabel: string = localize('createProxy.ProxyName', 'Proxy name');
	private static readonly CredentialNameTextBoxLabel: string = localize('createProxy.CredentialName', 'Credential name');
	private static readonly DescriptionTextBoxLabel: string = localize('createProxy.Description', 'Description');
	private static readonly SubsystemsTableLabel: string = localize('createProxy.Subsystems', 'Subsystems');
	private static readonly SubsystemNameColumnLabel: string = localize('createProxy.SubsystemName', 'Subsystem');

	// UI Components
	private generalTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	private proxyNameTextBox: sqlops.InputBoxComponent;
	private credentialNameTextBox: sqlops.InputBoxComponent;
	private descriptionTextBox: sqlops.InputBoxComponent;
	private subsystemsTable: sqlops.TableComponent;

	constructor(ownerUri: string) {
		super(ownerUri, new ProxyData(ownerUri), ProxyDialog.DialogTitle);
	}

	protected async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
		this.generalTab = sqlops.window.modelviewdialog.createTab(ProxyDialog.GeneralTabText);

		this.initializeGeneralTab();

		this.dialog.content = [this.generalTab];
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {

			this.proxyNameTextBox = view.modelBuilder.inputBox().component();

			this.credentialNameTextBox = view.modelBuilder.inputBox().component();

			this.descriptionTextBox = view.modelBuilder.inputBox().component();

			this.subsystemsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						ProxyDialog.SubsystemNameColumnLabel
					],
					data: [],
					height: 500
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.proxyNameTextBox,
					title: ProxyDialog.ProxyNameTextBoxLabel
				}, {
					component: this.credentialNameTextBox,
					title: ProxyDialog.CredentialNameTextBoxLabel
				}, {
					component: this.descriptionTextBox,
					title: ProxyDialog.DescriptionTextBoxLabel
				}, {
					component: this.subsystemsTable,
					title: ProxyDialog.SubsystemsTableLabel
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	protected updateModel() {
		this.model.accountName = this.proxyNameTextBox.value;
		this.model.credentialName = this.credentialNameTextBox.value;
		this.model.description = this.descriptionTextBox.value;
	}
}
