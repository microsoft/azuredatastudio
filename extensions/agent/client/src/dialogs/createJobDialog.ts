/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { ApiWrapper } from '.././apiWrapper';

export class CreateJobDialog {
	constructor() {
	}

	public showDialog() {
		let dialog = sqlops.window.modelviewdialog.createDialog('New Job');
		let generalTab = this.createGeneralTab();
		let stepsTab = this.createStepsTab();
		let alertsTab = this.createAlertsTab();
		dialog.content = [generalTab, stepsTab, alertsTab];
		dialog.okButton.onClick(() => console.log('ok clicked!'));
		dialog.cancelButton.onClick(() => console.log('cancel clicked!'));
		dialog.okButton.label = 'Ok';
		dialog.cancelButton.label = 'Cancel';
		sqlops.window.modelviewdialog.openDialog(dialog);
	}

	private createGeneralTab(): sqlops.window.modelviewdialog.DialogTab {
		let tab = sqlops.window.modelviewdialog.createTab('General');
		tab.registerContent(async (view) => {

		});
		return tab;
	}

	private createStepsTab(): sqlops.window.modelviewdialog.DialogTab {
		let tab = sqlops.window.modelviewdialog.createTab('Steps');
		return tab;
	}

	private createAlertsTab(): sqlops.window.modelviewdialog.DialogTab {
		let tab = sqlops.window.modelviewdialog.createTab('Alerts');
		return tab;
	}
}