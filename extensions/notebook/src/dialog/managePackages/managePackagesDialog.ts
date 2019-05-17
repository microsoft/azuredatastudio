/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import JupyterServerInstallation from '../../jupyter/jupyterServerInstallation';
import { InstalledPackagesTab } from './installedPackagesTab';
import { AddNewPackageTab } from './addNewPackageTab';

const localize = nls.loadMessageBundle();

export class ManagePackagesDialog {
	private dialog: azdata.window.Dialog;

	private readonly DialogTitle = localize('managePackages.dialogName', "Manage Pip Packages");
	private readonly CancelButtonText = localize('managePackages.cancelButtonText', "Close");

	constructor(private jupyterInstallation: JupyterServerInstallation) {
	}

	/**
	 * Opens a dialog to manage pip packages used by notebooks.
	 */
	public showDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(this.DialogTitle);

		let installedPkgTab = new InstalledPackagesTab(this, this.jupyterInstallation);
		let addNewPkgTab = new AddNewPackageTab(this, this.jupyterInstallation);

		this.dialog.okButton.hidden = true;
		this.dialog.cancelButton.label = this.CancelButtonText;

		this.dialog.content = [installedPkgTab.tab, addNewPkgTab.tab];

		azdata.window.openDialog(this.dialog);
	}

	public showInfoMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: azdata.window.MessageLevel.Information
		};
	}

	public showErrorMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}
}