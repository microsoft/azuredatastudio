/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';

export abstract class Dialog {
	constructor(private readonly title: string, protected readonly code: Code) { }


	protected async waitForNewDialog() {
		await this.code.waitForElement(`div[aria-label="${this.title}"][class="modal fade flyout-dialog"]`);
	}

	protected async waitForDialogGone() {
		await this.code.waitForElementGone(`div[aria-label="${this.title}"][class="modal fade flyout-dialog"]`);
	}

	protected async clickDialogButton(text: string) {
		await this.code.waitAndClick(`.modal-dialog .modal-content .modal-footer .right-footer .footer-button a[aria-label="${text}"][aria-disabled="false"]`);
	}
}
