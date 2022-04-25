/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SmokeTestConnection } from '..';
import { Code } from '../code';
import { Dialog } from './dialog';

const CONNECTION_DIALOG_TITLE = 'Connection';

export class ConnectionDialog extends Dialog {

	constructor(code: Code) {
		super(CONNECTION_DIALOG_TITLE, code);
	}

	async waitForConnectionDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	private static readonly PROVIDER_SELECTOR = '.modal .modal-body select[aria-label="Connection type"]';
	async setProvider(provider: string): Promise<void> {
		await this.code.waitForSetValue(ConnectionDialog.PROVIDER_SELECTOR, provider);
	}

	private static readonly TARGET_SELECTOR = '.modal .modal-body input[aria-label="${TARGET}"]';
	async setTarget(target: string, value: string): Promise<void> {
		await this.code.waitForSetValue(ConnectionDialog.TARGET_SELECTOR.replace('${TARGET}', '' + target), value);
	}

	private static readonly CONNECT_BUTTON_SELECTOR = '.modal .modal-footer a[aria-label="Connect"]:not(.disabled)';
	async connect(): Promise<void> {
		await this.code.waitAndClick(ConnectionDialog.CONNECT_BUTTON_SELECTOR);

		await this.waitForDialogGone();
	}

	async fillConnectionDialog(connection: SmokeTestConnection, connectAfterFilling: boolean = true): Promise<void> {
		if (connection) {
			for (let i = 0; i < connection.connectionDialogOptions.length; i++) {
				const param = connection.connectionDialogOptions[i];
				const value = process.env[`${connection.id}_${param.name}`] ?? param.value;
				const selector = param.overrideSelector ?? `.modal .modal-body ${param.visualComponentType}[aria-label="${param.ariaLabel}"]`;
				this.code.waitForSetValue(selector, value);
				if (param.delayAfterSetting) {
					await new Promise((resolve) => setTimeout(resolve, param.delayAfterSetting));
				}
			}
			if (connectAfterFilling) {
				await this.code.waitAndClick(ConnectionDialog.CONNECT_BUTTON_SELECTOR);
				await this.waitForDialogGone();
			}
		}
	}
}
