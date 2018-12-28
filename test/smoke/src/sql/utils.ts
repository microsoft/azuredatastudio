import { Code } from '../vscode/code';

export async function waitForNewDialog(code: Code, title: string) {
	await code.waitForElement(`div[aria-label="${title}"][class="modal fade flyout-dialog"]`);
}

export async function clickDialogButton(code: Code, title: string) {
	await code.waitAndClick(`.modal-dialog .modal-content .modal-footer .right-footer .footer-button a[aria-label="${title}"][aria-disabled="false"]`);
}