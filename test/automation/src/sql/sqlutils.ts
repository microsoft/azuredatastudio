/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';

export async function waitForNewDialog(code: Code, title: string) {
	await code.waitForElement(`div[aria-label="${title}"][class="modal fade flyout-dialog"]`);
}

export async function clickDialogButton(code: Code, title: string) {
	await code.waitAndClick(`.modal-dialog .modal-content .modal-footer .right-footer .footer-button a[aria-label="${title}"][aria-disabled="false"]`);
}
