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
	private installedPkgTab: InstalledPackagesTab;
	private addNewPkgTab: AddNewPackageTab;

	constructor(private jupyterInstallation: JupyterServerInstallation) {
	}

	/**
	 * Opens a dialog to manage pip packages used by notebooks.
	 */
	public showDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(localize('managePackages.dialogName', "Manage Pip Packages"));

		this.installedPkgTab = new InstalledPackagesTab(this, this.jupyterInstallation);
		this.addNewPkgTab = new AddNewPackageTab(this, this.jupyterInstallation);

		this.dialog.okButton.hidden = true;
		this.dialog.cancelButton.label = localize('managePackages.cancelButtonText', "Close");

		this.dialog.content = [this.installedPkgTab.tab, this.addNewPkgTab.tab];

		azdata.window.openDialog(this.dialog);
	}

	public refreshInstalledPackages(): Promise<void> {
		return this.installedPkgTab.loadInstalledPackagesInfo();
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