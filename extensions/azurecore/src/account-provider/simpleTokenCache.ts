/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as keytarType from 'keytar';
import * as vscode from 'vscode';
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
	findCredentials: typeof keytarType['findCredentials'];
};
export class SimpleTokenCache {
	private keytar: Keytar;

	constructor(
		private serviceName: string
	) {
		const keytar = getKeytar();
		if (!keytar) {
			const message = localize('azure.noSystemKeychain', "System keychain is unavailable.");
			vscode.window.showErrorMessage(message);
			throw new Error('System keychain unavailable');
		}

		this.serviceName = this.serviceName.replace(/-/g, '_');

		this.keytar = keytar;
	}

	async saveCredential(id: string, key: string): Promise<void> {
		try {
			if (key.length > 2500) { // Windows limitation
				throw new Error('Key length is longer than 2500 chars');
			}
			return await this.keytar.setPassword(this.serviceName, id, key);
		} catch (ex) {
			console.log(`Adding key failed: ${ex}`);
		}
	}

	async getCredential(id: string): Promise<string | null> {
		try {
			return await this.keytar.getPassword(this.serviceName, id);
		} catch (ex) {
			console.log(`Getting key failed: ${ex}`);
			return undefined;
		}
	}

	async clearCredential(id: string): Promise<boolean> {
		try {
			return await this.keytar.deletePassword(this.serviceName, id);
		} catch (ex) {
			console.log(`Clearing key failed: ${ex}`);
			return false;
		}
	}

}
