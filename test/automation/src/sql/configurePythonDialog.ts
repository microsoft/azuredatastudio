/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { Dialog } from './dialog';
import { NotificationToast } from './notificationToast';

const CONFIGURE_PYTHON_DIALOG_TITLE = 'Configure Python to run Python 3 kernel';

export class ConfigurePythonDialog extends Dialog {

	constructor(code: Code, private notificationToast: NotificationToast) {
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

		// Wait for the python install location to be loaded before clicking the next button.
		// There may be a timing issue where the smoke test attempts to go to the next page before
		// the contents are loaded, causing the test to fail.
		const pythonInstallLocationDropdownValue = `${dialog} select[aria-label="Python Install Location"] option`;
		await this.code.waitForElement(pythonInstallLocationDropdownValue);

		await this.notificationToast.closeNotificationToasts();

		const nextButton = '.modal-dialog .modal-content .modal-footer .right-footer .footer-button a[aria-label="Next"][aria-disabled="false"]';
		await this.code.waitForElement(nextButton);
		await this.code.dispatchKeybinding('enter');

		await this.notificationToast.closeNotificationToasts();

		const installButton = '.modal-dialog .modal-content .modal-footer .right-footer .footer-button a[aria-label="Install"][aria-disabled="false"]';
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
