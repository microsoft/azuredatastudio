/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickInput } from '../quickinput';
import { Dialog } from './dialog';

const MANAGE_PACKAGES_DIALOG_TITLE = 'Manage Packages';

export class ManagePackagesDialog extends Dialog {
	private static readonly dialogPage = '.modal .modal-body .dialogModal-pane';

	constructor(code: Code, private readonly quickInput: QuickInput) {
		super(MANAGE_PACKAGES_DIALOG_TITLE, code);
	}

	async waitForManagePackagesDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	async addNewPackage(packageName: string): Promise<string> {
		const addNewTab = `${ManagePackagesDialog.dialogPage} div[class="tab-header"][aria-controls="dialogPane.Manage Packages.1"]`;
		await this.code.waitAndClick(addNewTab);

		const loadingSpinner = `${ManagePackagesDialog.dialogPage} div.modelview-loadingComponent-spinner`;

		// Wait for "Search Pip packages" placeholder in the input box to know that the tab has finished initializing
		const searchPipPackagesInput = `${ManagePackagesDialog.dialogPage} input[placeholder="Search Pip packages"]`;
		await this.code.waitForElement(searchPipPackagesInput);
		const searchInputBox = `${ManagePackagesDialog.dialogPage} .monaco-inputbox`;
		await this.code.waitAndClick(searchInputBox);

		const searchInputBoxEditor = `${searchInputBox} input.input`;
		await this.code.waitForTypeInEditor(searchInputBoxEditor, packageName);

		const searchButton = `${ManagePackagesDialog.dialogPage} a[class="monaco-button monaco-text-button"][aria-label="Search"][aria-disabled="false"]`;
		await this.code.waitAndClick(searchButton);

		const packageNameSelector = `${ManagePackagesDialog.dialogPage} div[id="textContainer"] span`;
		await this.code.waitForTextContent(packageNameSelector, packageName);

		// Get the latest package version
		const versionSelectBox = `${ManagePackagesDialog.dialogPage} select[aria-label^="Supported Package Versions for Python"] option`;
		let packageVersion = await this.code.waitForTextContent(versionSelectBox);

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

		return packageVersion;
	}

	async removePackage(packageName: string, clickOnTab: boolean = false): Promise<void> {
		// When the dialog is first opened, the Installed Packages tab is already open, which causes
		// clicking on its page tab to fail. So we skip clicking on the page tab by default, but can
		// re-enable it if mixing install and uninstall operations in the same test.
		if (clickOnTab) {
			const installedPkgTab = `${ManagePackagesDialog.dialogPage} div[class="tab-header"][aria-controls="dialogPane.Manage Packages.0"]`;
			await this.code.waitAndClick(installedPkgTab);
		}

		// Wait for initial loading spinner to disappear
		const loadingSpinner = `${ManagePackagesDialog.dialogPage} div.modelview-loadingComponent-spinner`;
		await this.code.waitForElement(loadingSpinner);
		await this.code.waitForElementGone(loadingSpinner);

		// Click on package row in installed packages list to select it for uninstall
		const packageRow = `${ManagePackagesDialog.dialogPage} div[role="gridcell"][aria-label="${packageName}"]`;
		await this.code.waitAndClick(packageRow);

		// Tab over to uninstall button on the right side of the row. Can't select the uninstall button
		// directly since it doesn't have any package name info associated with it.
		await this.code.dispatchKeybinding('tab');
		await this.code.dispatchKeybinding('tab');
		await this.code.dispatchKeybinding('enter');

		// Click Yes on quick select
		const quickInputAccept = 'Yes';
		await this.quickInput.waitForQuickInputOpened();
		await this.quickInput.waitForQuickInputElements(names => names[0] === quickInputAccept);
		await this.quickInput.submit(quickInputAccept);

		// Wait for uninstall loading spinner to disappear
		await this.code.waitForElement(loadingSpinner);
		await this.code.waitForElementGone(loadingSpinner);

		// Close dialog
		const closeButton = '.modal .modal-footer a[class="monaco-button monaco-text-button"][aria-label="Close"][aria-disabled="false"]';
		await this.code.waitAndClick(closeButton);
		await this.waitForDialogGone();
	}
}
