/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as keytarType from 'keytar';

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
			throw new Error('System keychain unavailable');
		}

		this.serviceName = this.serviceName.replace(/-/g, '_');

		this.keytar = keytar;
	}

	async addAccount(id: string, key: string): Promise<void> {
		try {
			console.log(key.length);
			const y = await this.keytar.setPassword(this.serviceName, id, key);
			const x = await this.keytar.findCredentials(this.serviceName);
			console.log(x);
			return y;
		} catch (ex) {
			console.log(`Adding key failed: ${ex}`);
		}
	}

	async getCredential(id: string): Promise<string> {
		try {
			const x = await this.keytar.findCredentials(this.serviceName);
			console.log(x);
			return this.keytar.getPassword(this.serviceName, id);
		} catch (ex) {
			console.log(`Getting key failed: ${ex}`);
			return undefined;
		}
	}

	async clearCredential(id: string): Promise<boolean> {
		try {
			return this.keytar.deletePassword(this.serviceName, id);
		} catch (ex) {
			console.log(`Clearing key failed: ${ex}`);
			return false;
		}
	}

}
