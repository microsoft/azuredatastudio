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

	async addNewPackage(packageName: string): Promise<void> {
		const addNewTab = `${ManagePackagesDialog.dialogPage} div[class="tab-header"][aria-controls="dialogPane.Manage Packages.1"]`;
		await this.code.waitAndClick(addNewTab);

		const searchInputBox = `${ManagePackagesDialog.dialogPage} input[class="input"]`;
		await this.code.waitAndClick(searchInputBox);
		await this.code.waitForTypeInEditor(searchInputBox, packageName);

		const searchButton = `${ManagePackagesDialog.dialogPage} a[class="monaco-button monaco-text-button"][aria-label="Search"]`;
		await this.code.waitAndClick(searchButton);

		const installButton = `${ManagePackagesDialog.dialogPage} a[class="monaco-button monaco-text-button"][aria-label="Install"]`;
		await this.code.waitAndClick(installButton);

		const installedTab = `${ManagePackagesDialog.dialogPage} div[class="tab-header"][aria-controls="dialogPane.Manage Packages.0]`;
		await this.code.waitAndClick(installedTab);

		const packageGridCell = `${ManagePackagesDialog.dialogPage} div[role="gridcell"][aria-label=${packageName}]`;
		await this.code.waitForElement(packageGridCell);

		const closeButton = `${ManagePackagesDialog.dialogPage} .modal-footer .right-footer a[aria-label="Close"]`;
		await this.code.waitAndClick(closeButton);
	}
}
