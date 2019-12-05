/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { InstalledPackagesTab } from './installedPackagesTab';
import { AddNewPackageTab } from './addNewPackageTab';
import { ManagePackagesDialogModel } from './managePackagesDialogModel';

const localize = nls.loadMessageBundle();

export class ManagePackagesDialog {
	private dialog: azdata.window.Dialog;
	private installedPkgTab: InstalledPackagesTab;
	private addNewPkgTab: AddNewPackageTab;

	constructor(
		private _managePackageDialogModel: ManagePackagesDialogModel) {
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

	/**
	 * Dialog model instance
	 */
	public get model(): ManagePackagesDialogModel {
		return this._managePackageDialogModel;
	}

	/**
	 * Changes the current provider id
	 * @param providerId Provider Id
	 */
	public changeProvider(providerId: string): void {
		this.model.changeProvider(providerId);
	}

	/**
	 * Resets the tabs for given provider Id
	 * @param providerId Package Management Provider Id
	 */
	public async resetPages(providerId: string): Promise<void> {

		// Change the provider in the model
		//
		this.changeProvider(providerId);

		// Load packages for given provider
		//
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
