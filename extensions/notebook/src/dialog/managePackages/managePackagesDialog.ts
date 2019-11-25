/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { InstalledPackagesTab } from './installedPackagesTab';
import { AddNewPackageTab } from './addNewPackageTab';
import { ManagePackageDialogModel } from './managePackagesDialogModel';

const localize = nls.loadMessageBundle();

export class ManagePackagesDialog {
	private dialog: azdata.window.Dialog;
	private installedPkgTab: InstalledPackagesTab;
	private addNewPkgTab: AddNewPackageTab;

	public currentPkgType: string;

	constructor(
		private _managePackageDialogModel: ManagePackageDialogModel) {
	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public showDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(localize('managePackages.dialogName', "Manage Packages"));

		this.installedPkgTab = new InstalledPackagesTab(this, this.jupyterInstallation);
		this.addNewPkgTab = new AddNewPackageTab(this, this.jupyterInstallation);

		this.dialog.okButton.hidden = true;
		this.dialog.cancelButton.label = localize('managePackages.cancelButtonText', "Close");

		this.dialog.content = [this.installedPkgTab.tab, this.addNewPkgTab.tab];

		this.dialog.registerCloseValidator(() => {
			return false; // Blocks Enter key from closing dialog.
		});

		azdata.window.openDialog(this.dialog);
	}

	public refreshInstalledPackages(): Promise<void> {
		return this.installedPkgTab.loadInstalledPackagesInfo();
	}

	public get jupyterInstallation(): JupyterServerInstallation {
		return this._managePackageDialogModel.jupyterInstallation;
	}

	public get model(): ManagePackageDialogModel {
		return this._managePackageDialogModel;
	}

	public changePackageType(newPkgType: string): void {
		this.model.changeProvider(newPkgType);
		this.currentPkgType = newPkgType;
	}

	public async resetPages(providerId: string): Promise<void> {
		this.changePackageType(providerId);
		await this.installedPkgTab.loadInstalledPackagesInfo();
		await this.addNewPkgTab.resetPageFields();
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
