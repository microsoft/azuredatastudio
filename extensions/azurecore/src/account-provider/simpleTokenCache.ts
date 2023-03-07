/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as keytarType from 'keytar';
import { join, parse } from 'path';
import { FileDatabase } from './utils/fileDatabase';
import * as azdata from 'azdata';
import { FileEncryptionHelper } from './utils/fileEncryptionHelper';

function getSystemKeytar(): Keytar | undefined {
	try {
		return require('keytar');
	} catch (err) {
		console.warn(err);
	}

	return undefined;
}

export type MultipleAccountsResponse = { account: string, password: string }[];

// allow-any-unicode-next-line
const separator = '§';

async function getFileKeytar(filePath: string, credentialService: azdata.CredentialProvider): Promise<Keytar | undefined> {
	const fileName = parse(filePath).base;
	const fileEncryptionHelper: FileEncryptionHelper = new FileEncryptionHelper(credentialService, fileName);
	const db = new FileDatabase(filePath, fileEncryptionHelper.fileOpener, fileEncryptionHelper.fileSaver);
	await db.initialize();

	const fileKeytar: Keytar = {
		async getPassword(service: string, account: string): Promise<string> {
			return db.get(`${service}${separator}${account}`);
		},

		async setPassword(service: string, account: string, password: string): Promise<void> {
			await db.set(`${service}${separator}${account}`, password);
		},

		async deletePassword(service: string, account: string): Promise<boolean> {
			await db.delete(`${service}${separator}${account}`);
			return true;
		},

		async getPasswords(service: string): Promise<MultipleAccountsResponse> {
			const result = db.getPrefix(`${service}`);
			if (!result) {
				return [];
			}

			return result.map(({ key, value }) => {
				return {
					account: key.split(separator)[1],
					password: value
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
	getPasswords: (service: string) => Promise<MultipleAccountsResponse>;
	findCredentials?: typeof keytarType['findCredentials'];
};

export class SimpleTokenCache {
	private keytar: Keytar | undefined;

	constructor(
		private serviceName: string,
		private readonly userStoragePath: string,
		private readonly forceFileStorage: boolean = false,
		private readonly credentialService: azdata.CredentialProvider,
	) { }

	async init(): Promise<void> {
		this.serviceName = this.serviceName.replace(/-/g, '_');
		let keytar: Keytar | undefined;
		if (this.forceFileStorage === false) {
			keytar = getSystemKeytar();

			// Add new method to keytar
			if (keytar) {
				keytar.getPasswords = async (service: string): Promise<MultipleAccountsResponse> => {
					const [serviceName, accountPrefix] = service.split(separator);
					if (serviceName === undefined || accountPrefix === undefined) {
						throw new Error('Service did not have separator: ' + service);
					}

					const results = await keytar!.findCredentials!(serviceName);
					return results.filter(({ account }) => {
						return account.startsWith(accountPrefix);
					});
				};
			}
		}
		if (!keytar) {
			keytar = await getFileKeytar(join(this.userStoragePath, this.serviceName), this.credentialService);
		}
		this.keytar = keytar;
	}

	async saveCredential(id: string, key: string): Promise<void> {
		if (!this.forceFileStorage && key.length > 2500) { // Windows limitation
			throw new Error('Key length is longer than 2500 chars');
		}

		if (id.includes(separator)) {
			throw new Error('Separator included in ID');
		}

		try {
			const keytar = this.getKeytar();
			return await keytar.setPassword(this.serviceName, id, key);
		} catch (ex) {
			console.warn(`Adding key failed: ${ex}`);
		}
	}

	async getCredential(id: string): Promise<string | undefined> {
		try {
			const keytar = this.getKeytar();
			const result = await keytar.getPassword(this.serviceName, id);

			if (result === null) {
				return undefined;
			}

			return result;
		} catch (ex) {
			console.warn(`Getting key failed: ${ex}`);
			return undefined;
		}
	}

	async clearCredential(id: string): Promise<boolean> {
		try {
			const keytar = this.getKeytar();
			return await keytar.deletePassword(this.serviceName, id);
		} catch (ex) {
			console.warn(`Clearing key failed: ${ex}`);
			return false;
		}
	}

	async findCredentials(prefix: string): Promise<{ account: string, password: string }[]> {
		try {
			const keytar = this.getKeytar();
			return await keytar.getPasswords(`${this.serviceName}${separator}${prefix}`);
		} catch (ex) {
			console.warn(`Finding credentials failed: ${ex}`);
			return [];
		}
	}

	private getKeytar(): Keytar {
		if (!this.keytar) {
			throw new Error('Keytar not initialized');
		}
		return this.keytar;
	}
}
