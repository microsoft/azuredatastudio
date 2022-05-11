/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { Dialog } from './dialog';

const MANAGE_PACKAGES_DIALOG_TITLE = 'Manage Packages';

export class ManagePackagesDialog extends Dialog {
	private static readonly dialogPage = '.modal .modal-body .dialogModal-pane';

	constructor(code: Code) {
		super(MANAGE_PACKAGES_DIALOG_TITLE, code);
	}

	async waitForManagePackagesDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	async addNewPackage(packageName: string, packageVersion: string = ''): Promise<void> {
		const addNewTab = `${ManagePackagesDialog.dialogPage} div[class="tab-header"][aria-controls="dialogPane.Manage Packages.1"]`;
		await this.code.waitAndClick(addNewTab);

		const loadingSpinner = `${ManagePackagesDialog.dialogPage} div.modelview-loadingComponent-spinner`;

		// Wait for "Search Pip packages" placeholder in the input box and N/A for package information to know that the tab has finished initializing
		const searchPipPackagesInput = `${ManagePackagesDialog.dialogPage} input[placeholder="Search Pip packages"]`;
		await this.code.waitForElement(searchPipPackagesInput);
		const packageNameSelector = `${ManagePackagesDialog.dialogPage} div[id="textContainer"] span`;
		await this.code.waitForTextContent(packageNameSelector, 'N/A');
		const versionSelectBox = `${ManagePackagesDialog.dialogPage} select[class="monaco-select-box monaco-select-box-dropdown-padding"][aria-label="Package Version"]`;
		await this.code.waitForTextContent(versionSelectBox, 'N/A');

		const searchInputBox = `${ManagePackagesDialog.dialogPage} .monaco-inputbox`;
		await this.code.waitAndClick(searchInputBox);
		const searchInputBoxEditor = `${searchInputBox} input.input`;
		await this.code.waitForTypeInEditor(searchInputBoxEditor, packageName);

		const searchButton = `${ManagePackagesDialog.dialogPage} a[class="monaco-button monaco-text-button"][aria-label="Search"][aria-disabled="false"]`;
		await this.code.waitAndClick(searchButton);

		await this.code.waitForTextContent(packageNameSelector, packageName);

		if (packageVersion) {
			await this.code.waitForSetValue(versionSelectBox, packageVersion);
		}

		const installButton = `${ManagePackagesDialog.dialogPage} a[class="monaco-button monaco-text-button"][aria-label="Install"][aria-disabled="false"]`;
		await this.code.waitAndClick(installButton);

		const installedTab = `${ManagePackagesDialog.dialogPage} div[class="tab-header"][aria-controls="dialogPane.Manage Packages.0"]`;
		await this.code.waitAndClick(installedTab);

		// The installed packages tab will reload once the package has been installed
		await this.code.waitForElement(loadingSpinner);
		await this.code.waitForElementGone(loadingSpinner);

		const closeButton = '.modal .modal-footer a[class="monaco-button monaco-text-button"][aria-label="Close"][aria-disabled="false"]';
		await this.code.waitAndClick(closeButton);
		await this.waitForDialogGone();
	}
}
