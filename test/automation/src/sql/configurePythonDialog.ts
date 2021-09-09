/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { Dialog } from './dialog';

const CONFIGURE_PYTHON_DIALOG_TITLE = 'Configure Python to run Python 3 kernel';

export class ConfigurePythonDialog extends Dialog {
	private static readonly dialogPageInView = '.modal .modal-body .dialogModal-pane:not(.dialogModal-hidden)';
	private static readonly dialogButtonInView = '.modal .modal-footer .footer-button:not(.dialogModal-hidden)';
	private static readonly nextButton = `${ConfigurePythonDialog.dialogButtonInView} a[aria-label="Next"][aria-disabled="false"]`;
	private static readonly installButton = `${ConfigurePythonDialog.dialogButtonInView} a[aria-label="Install"][aria-disabled="false"]`;

	constructor(code: Code) {
		super(CONFIGURE_PYTHON_DIALOG_TITLE, code);
	}

	async waitForConfigurePythonDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	async waitForPageOneLoaded(): Promise<void> {
		// Wait up to 1 minute for the python install location to be loaded.
		const pythonInstallLocationDropdownValue = `${ConfigurePythonDialog.dialogPageInView} option[value*="/azuredatastudio-python (Default)"]`;
		await this.code.waitForElement(pythonInstallLocationDropdownValue, undefined, 600);

		const loadingSpinner = `${ConfigurePythonDialog.dialogPageInView} .modelview-loadingComponent-content-loading`;
		await this.code.waitForElementGone(loadingSpinner);

		await this.code.waitForElement(ConfigurePythonDialog.nextButton);
	}

	async waitForPageTwoLoaded(): Promise<void> {
		// Wait up to 1 minute for the required kernel dependencies to load before clicking install button
		await this.code.waitForElement(ConfigurePythonDialog.installButton, undefined, 600);
	}

	async next(): Promise<void> {
		await this.code.waitAndClick(ConfigurePythonDialog.nextButton);
	}

	async install(): Promise<void> {
		await this.code.waitAndClick(ConfigurePythonDialog.installButton);

		await this.waitForDialogGone();
		return this._waitForInstallationComplete();
	}

	private async _waitForInstallationComplete(): Promise<void> {
		const installationCompleteNotification = '.notifications-toasts div[aria-label="Notebook dependencies installation is complete, source: Notebook Core Extensions (Extension), notification"]';
		await this.code.waitForElement(installationCompleteNotification, undefined, 6000); // wait up to 5 minutes for python installation
	}

}
