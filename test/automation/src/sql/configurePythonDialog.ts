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
		const dialog = '.modal .modal-dialog';
		await this.code.waitAndClick(dialog);

		const newPythonInstallation = '.modal .modal-body input[aria-label="New Python installation"]';
		await this.code.waitAndClick(newPythonInstallation);

		const pythonInstallLocationDropdownValue = `${dialog} select[aria-label="Python Install Location"] option`;
		await this.code.waitForElement(pythonInstallLocationDropdownValue);

		const nextButton = '.modal-dialog .modal-content .modal-footer .right-footer .footer-button a[aria-label="Next"][aria-disabled="false"]:not(.disabled)';
		await this.code.waitForElement(nextButton);
		await this.code.dispatchKeybinding('enter');

		const installButton = '.modal-dialog .modal-content .modal-footer .right-footer .footer-button a[aria-label="Install"][aria-disabled="false"]:not(.disabled)';
		await this.code.waitForElement(installButton);
		await this.code.dispatchKeybinding('enter');

		await this.waitForDialogGone();
		return this._waitForInstallationComplete();
	}

	private async _waitForInstallationComplete(): Promise<void> {
		const installationCompleteNotification = '.notifications-toasts div[aria-label="Notebook dependencies installation is complete, source: Notebook Core Extensions (Extension), notification"]';
		await this.code.waitForElement(installationCompleteNotification, undefined, 600); // wait up to 1 minute for python installation
	}

}
