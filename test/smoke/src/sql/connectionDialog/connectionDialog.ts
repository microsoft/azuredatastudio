/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../../vscode/code';
import { waitForNewDialog, clickDialogButton } from '../sqlutils';
import { TestServerProfile, AuthenticationType } from '../testConfig';

const CONNECTION_DIALOG_TITLE = 'Connection';
const CONNECTION_DIALOG_SELECTOR: string = '.modal-dialog .modal-content .modal-body .connection-dialog';
const CONNECTION_DETAIL_CONTROL_SELECTOR: string = '.connection-type .connection-table .connection-input';

const SERVER_INPUT_ARIA_LABEL = 'Server';
const USERNAME_INPUT_ARIA_LABEL = 'User name';
const PASSWORD_INPUT_ARIA_LABEL = 'Password';
const AUTH_TYPE_ARIA_LABEL = 'Authentication type';

const CONNECT_BUTTON_ARIA_LABEL = 'Connect';

export class ConnectionDialog {

	constructor(private code: Code) { }

	async waitForConnectionDialog(): Promise<void> {
		await waitForNewDialog(this.code, CONNECTION_DIALOG_TITLE);
	}

	async connect(profile: TestServerProfile): Promise<void> {
		await this.code.waitForSetValue(this.getInputCssSelector(SERVER_INPUT_ARIA_LABEL), profile.serverName);
		if (profile.authenticationType === AuthenticationType.SqlLogin) {
			await this.code.waitAndClick(this.getSelectCssSelector(AUTH_TYPE_ARIA_LABEL));
			await this.selectAuthType(profile.authenticationTypeDisplayName);
			await this.code.waitForSetValue(this.getInputCssSelector(USERNAME_INPUT_ARIA_LABEL), profile.userName);
			await this.code.waitForSetValue(this.getInputCssSelector(PASSWORD_INPUT_ARIA_LABEL), profile.password);
		}
		await clickDialogButton(this.code, CONNECT_BUTTON_ARIA_LABEL);
	}

	private getInputCssSelector(ariaLabel: string): string {
		return `${CONNECTION_DIALOG_SELECTOR} ${CONNECTION_DETAIL_CONTROL_SELECTOR} .monaco-inputbox input[aria-label="${ariaLabel}"]`;
	}

	private getSelectCssSelector(ariaLabel: string): string {
		return `${CONNECTION_DIALOG_SELECTOR} ${CONNECTION_DETAIL_CONTROL_SELECTOR} select[aria-label="${ariaLabel}"]`;
	}

	private async selectAuthType(authType: string) {
		await this.code.waitAndClick(`.context-view.bottom.left .monaco-select-box-dropdown-container .select-box-dropdown-list-container .monaco-list .monaco-scrollable-element .monaco-list-rows div[aria-label="${authType}"][class*="monaco-list-row"]`);
	}
}