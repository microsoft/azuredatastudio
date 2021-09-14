/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// keytar depends on a native module shipped in vscode, so this is
// how we load it
import type * as keytarType from 'keytar';
import * as vscode from 'vscode';
import Logger from './logger';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

function getKeytar(): Keytar | undefined {
	try {
		return require('keytar');
	} catch (err) {
		console.log(err);
	}

	return undefined;
}

export type Keytar = {
	getPassword: typeof keytarType['getPassword'];
	setPassword: typeof keytarType['setPassword'];
	deletePassword: typeof keytarType['deletePassword'];
};

export class Keychain {
	constructor(private context: vscode.ExtensionContext, private serviceId: string) { }
	async setToken(token: string): Promise<void> {
		try {
			return await this.context.secrets.store(this.serviceId, token);
		} catch (e) {
			// Ignore
			Logger.error(`Setting token failed: ${e}`);
			const troubleshooting = localize('troubleshooting', "Troubleshooting Guide");
			const result = await vscode.window.showErrorMessage(localize('keychainWriteError', "Writing login information to the keychain failed with error '{0}'.", e.message), troubleshooting);
			if (result === troubleshooting) {
				vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/docs/editor/settings-sync#_troubleshooting-keychain-issues'));
			}
		}
	}

	async getToken(): Promise<string | null | undefined> {
		try {
			return await this.context.secrets.get(this.serviceId);
		} catch (e) {
			// Ignore
			Logger.error(`Getting token failed: ${e}`);
			return Promise.resolve(undefined);
		}
	}

	async deleteToken(): Promise<void> {
		try {
			return await this.context.secrets.delete(this.serviceId);
		} catch (e) {
			// Ignore
			Logger.error(`Deleting token failed: ${e}`);
			return Promise.resolve(undefined);
		}
	}

	async tryMigrate(): Promise<string | null | undefined> {
		try {
			const keytar = getKeytar();
			if (!keytar) {
				throw new Error('keytar unavailable');
			}

			const oldValue = await keytar.getPassword(`${vscode.env.uriScheme}-github.login`, 'account');
			if (oldValue) {
				await this.setToken(oldValue);
				await keytar.deletePassword(`${vscode.env.uriScheme}-github.login`, 'account');
			}

			return oldValue;
		} catch (_) {
			// Ignore
			return Promise.resolve(undefined);
		}
	}
}
