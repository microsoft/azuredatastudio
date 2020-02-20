/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as keytarType from 'keytar';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { promises as fs } from 'fs';
import { join } from 'path';

const localize = nls.loadMessageBundle();

function getSystemKeytar(): Keytar | undefined {
	try {
		return require('keytar');
	} catch (err) {
		console.log(err);
	}

	return undefined;
}

interface PasswordFile {
	[serviceName: string]: { [accountName: string]: string };
}

function getFileKeytar(filePath: string): Keytar | undefined {
	const readFile = async (): Promise<PasswordFile> => {
		const fileString = await fs.readFile(filePath, { encoding: 'utf8' });
		const passwordFile: PasswordFile = JSON.parse(fileString);
		return passwordFile;
	};

	const saveFile = async (passwordFile: PasswordFile): Promise<void> => {
		return fs.writeFile(filePath, JSON.stringify(passwordFile), { encoding: 'utf8' });
	};

	const fileKeytar: Keytar = {
		async getPassword(service: string, account: string): Promise<string> {
			try {
				const passwordFile = await readFile();
				return passwordFile[service][account];
			} catch (ex) {
				console.log(ex);
				return undefined;
			}
		},

		async setPassword(service: string, account: string, password: string): Promise<void> {
			let passwordFile: PasswordFile;
			try {
				passwordFile = await readFile();
			} catch (ex) {
				passwordFile = {};
			}

			if (!passwordFile[service]) {
				passwordFile[service] = {};
			}
			passwordFile[service][account] = password;
			return await saveFile(passwordFile);
		},

		async deletePassword(service: string, account: string): Promise<boolean> {
			const passwordFile = await readFile();
			if (!passwordFile[service]) {
				return true;
			}
			delete passwordFile[service][account];
			await saveFile(passwordFile);

			return true;
		},

		async findCredentials(service: string): Promise<{ account: string, password: string }[]> {
			const passwordFile = await readFile();
			const serviceSection = passwordFile[service];
			if (!serviceSection) {
				return [];
			}

			return Object.keys(serviceSection).map((account) => {
				return {
					account,
					password: serviceSection[account]
				};
			});
		}
	};
	return fileKeytar;
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
		private serviceName: string,
		userStoragePath: string,
		forceFileStorage: boolean = false,
	) {
		this.serviceName = this.serviceName.replace(/-/g, '_');
		let keytar: Keytar;
		if (forceFileStorage === false) {
			keytar = getSystemKeytar();
		}
		if (!keytar) {
			const message = localize('azure.noSystemKeychain', "System keychain is unavailable. Falling back to less secure filebased keychain.");
			vscode.window.showErrorMessage(message);
			keytar = getFileKeytar(join(userStoragePath, serviceName));
		}
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
