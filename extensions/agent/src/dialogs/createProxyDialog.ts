/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { CreateProxyData } from '../data/createProxyData';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class CreateProxyDialog {

	// Top level
	private static readonly DialogTitle: string = localize('createProxy.createAlert', 'Create Alert');
	private static readonly OkButtonText: string = localize('createProxy.OK', 'OK');
	private static readonly CancelButtonText: string = localize('createProxy.Cancel', 'Cancel');
	private static readonly GeneralTabText: string = localize('createProxy.General', 'General');

	// General tab strings
	private static readonly ProxyNameTextBoxLabel: string = localize('createProxy.ProxyName', 'Proxy name');
	private static readonly CredentialNameTextBoxLabel: string = localize('createProxy.CredentialName', 'Credential name');
	private static readonly DescriptionTextBoxLabel: string = localize('createProxy.Description', 'Description');
	private static readonly SubsystemsTableLabel: string = localize('createProxy.Subsystems', 'Subsystems');
	private static readonly SubsystemNameColumnLabel: string = localize('createProxy.SubsystemName', 'Subsystem');

	// UI Components
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	private proxyNameTextBox: sqlops.InputBoxComponent;
	private credentialNameTextBox: sqlops.InputBoxComponent;
	private descriptionTextBox: sqlops.InputBoxComponent;
	private subsystemsTable: sqlops.TableComponent;

	private model: CreateProxyData;

	private _onSuccess: vscode.EventEmitter<CreateProxyData> = new vscode.EventEmitter<CreateProxyData>();
	public readonly onSuccess: vscode.Event<CreateProxyData> = this._onSuccess.event;

	constructor(ownerUri: string) {
		this.model = new CreateProxyData(ownerUri);
	}

	public async showDialog() {
		await this.model.initialize();
		this.dialog = sqlops.window.modelviewdialog.createDialog(CreateProxyDialog.DialogTitle);
		this.generalTab = sqlops.window.modelviewdialog.createTab(CreateProxyDialog.GeneralTabText);

		this.initializeGeneralTab();

		this.dialog.content = [this.generalTab];
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = CreateProxyDialog.OkButtonText;
		this.dialog.cancelButton.label = CreateProxyDialog.CancelButtonText;

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {

			this.proxyNameTextBox = view.modelBuilder.inputBox().component();

			this.credentialNameTextBox = view.modelBuilder.inputBox().component();

			this.descriptionTextBox = view.modelBuilder.inputBox().component();

			this.subsystemsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						CreateProxyDialog.SubsystemNameColumnLabel
					],
					data: [],
					height: 500
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.proxyNameTextBox,
					title: CreateProxyDialog.ProxyNameTextBoxLabel
				}, {
					component: this.credentialNameTextBox,
					title: CreateProxyDialog.CredentialNameTextBoxLabel
				}, {
					component: this.descriptionTextBox,
					title: CreateProxyDialog.DescriptionTextBoxLabel
				}, {
					component: this.subsystemsTable,
					title: CreateProxyDialog.SubsystemsTableLabel
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
