/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../../vscode/code';
import { waitForNewDialog, clickDialogButton } from '../Utils'
export interface ConnectionProfile {
	ServerName: string;
}

const CONNECTION_DIALOG_TITLE = 'Connection';
const CONNECTION_DIALOG_SELECTOR: string = '.modal-dialog .modal-content .modal-body .connection-dialog';
const CONNECTION_DETAIL_CONTROL_SELECTOR: string = '.connection-type .connection-table .connection-input';

const SERVER_INPUT_ARIA_LABEL = 'Server';
//const AUTH_TYPE_ARIA_LABEL = 'Authentication type';

const CONNECT_BUTTON_ARIA_LABEL = 'Connect';

export class ConnectionDialog {

	constructor(private code: Code) { }

	async waitForConnectionDialog(): Promise<void> {
		await waitForNewDialog(this.code, CONNECTION_DIALOG_TITLE);
	}

	async connect(profile: ConnectionProfile): Promise<void> {
		await this.code.waitForSetValue(this.getInputCssSelector(SERVER_INPUT_ARIA_LABEL), profile.ServerName);
		//await this.code.waitAndClick(this.getSelectSelector(AUTH_TYPE_ARIA_LABEL));
		await clickDialogButton(this.code, CONNECT_BUTTON_ARIA_LABEL);
	}

	private getInputCssSelector(ariaLabel: string): string {
		return `${CONNECTION_DIALOG_SELECTOR} ${CONNECTION_DETAIL_CONTROL_SELECTOR} .monaco-inputbox input[aria-label="${ariaLabel}"]`;
	}

	// private getSelectCssSelector(ariaLabel: string): string {
	// 	return `${CONNECTION_DIALOG_SELECTOR} ${CONNECTION_DETAIL_CONTROL_SELECTOR} select[aria-label="${ariaLabel}"]`;
	// }
}