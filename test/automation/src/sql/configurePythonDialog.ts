/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { Dialog } from './dialog';

const CONFIGURE_PYTHON_DIALOG_TITLE = 'Configure Python to run Python 3 kernel';

export class ConfigurePythonDialog extends Dialog {

	constructor(code: Code) {
		super(CONFIGURE_PYTHON_DIALOG_TITLE, code);
	}

	async waitForConfigurePythonDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	async installPython(): Promise<void> {
		const dialogPageInView = '.modal .modal-body .dialogModal-pane:not(.dialogModal-hidden)';
		const dialogButtonInView = '.modal .modal-footer .footer-button:not(.dialogModal-hidden)';

		const newPythonInstallation = `${dialogPageInView} input[aria-label="New Python installation"]`;
		await this.code.waitAndClick(newPythonInstallation);

		// Wait up to 1 minute for the python install location to be loaded before clicking the next button.
		// There may be a timing issue where the smoke test attempts to go to the next page before
		// the contents are loaded, causing the test to fail.
		const pythonInstallLocationDropdownValue = `${dialogPageInView} option[value*="/azuredatastudio-python (Default)"]`;
		await this.code.waitForElement(pythonInstallLocationDropdownValue, undefined, 600);

		const loadingSpinner = `${dialogPageInView} .modelview-loadingComponent-content-loading`;
		await this.code.waitForElementGone(loadingSpinner);

		const nextButton = `${dialogButtonInView} a[aria-label="Next"][aria-disabled="false"]`;
		await this.code.waitAndClick(nextButton);

		const installButton = `${dialogButtonInView} a[aria-label="Install"][aria-disabled="false"]`;
		// wait up to 1 minute for the required kernel dependencies to load before clicking install button
		await this.code.waitForElement(installButton, undefined, 600);
		await this.code.waitAndClick(installButton);

		await this.waitForDialogGone();
		return this._waitForInstallationComplete();
	}

	private async _waitForInstallationComplete(): Promise<void> {
		const installationCompleteNotification = '.notifications-toasts div[aria-label="Notebook dependencies installation is complete, source: Notebook Core Extensions (Extension), notification"]';
		await this.code.waitForElement(installationCompleteNotification, undefined, 600); // wait up to 1 minute for python installation
	}

}
