/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as keytarType from 'keytar';
import { join, parse } from 'path';
import { FileDatabase } from './utils/fileDatabase';
import * as azdata from 'azdata';
import * as crypto from 'crypto';

function getSystemKeytar(): Keytar | undefined | null {
	try {
		return require('keytar');
	} catch (err) {
		console.log(err);
	}

	return undefined;
}

export type MultipleAccountsResponse = { account: string, password: string }[];

const separator = '§';

async function getFileKeytar(filePath: string, credentialService: azdata.CredentialProvider): Promise<Keytar | undefined> {
	const fileName = parse(filePath).base;
	const iv = await credentialService.readCredential(`${fileName}-iv`);
	const key = await credentialService.readCredential(`${fileName}-key`);
	let ivBuffer: Buffer;
	let keyBuffer: Buffer;
	if (!iv?.password || !key?.password) {
		ivBuffer = crypto.randomBytes(16);
		keyBuffer = crypto.randomBytes(32);
		try {
			await credentialService.saveCredential(`${fileName}-iv`, ivBuffer.toString('hex'));
			await credentialService.saveCredential(`${fileName}-key`, keyBuffer.toString('hex'));
		} catch (ex) {
			console.log(ex);
		}
	} else {
		ivBuffer = Buffer.from(iv.password, 'hex');
		keyBuffer = Buffer.from(key.password, 'hex');
	}

	const fileSaver = async (content: string): Promise<string> => {
		const cipherIv = crypto.createCipheriv('aes-256-gcm', keyBuffer, ivBuffer);
		return `${cipherIv.update(content, 'utf8', 'hex')}${cipherIv.final('hex')}%${cipherIv.getAuthTag().toString('hex')}`;
	};

	const fileOpener = async (content: string): Promise<string> => {
		const decipherIv = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);

		const split = content.split('%');
		if (split.length !== 2) {
			throw new Error('File didn\'t contain the auth tag.');
		}
		decipherIv.setAuthTag(Buffer.from(split[1], 'hex'));

		return `${decipherIv.update(split[0], 'hex', 'utf8')}${decipherIv.final('utf8')}`;
	};

	const db = new FileDatabase(filePath, fileOpener, fileSaver);
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
	private keytar: Keytar;

	constructor(
		private serviceName: string,
		private readonly userStoragePath: string,
		private readonly forceFileStorage: boolean = false,
		private readonly credentialService: azdata.CredentialProvider,
	) {

	}

	async init(): Promise<void> {
		this.serviceName = this.serviceName.replace(/-/g, '_');
		let keytar: Keytar;
		if (this.forceFileStorage === false) {
			keytar = getSystemKeytar();

			// Add new method to keytar
			if (keytar) {
				keytar.getPasswords = async (service: string): Promise<MultipleAccountsResponse> => {
					const [serviceName, accountPrefix] = service.split(separator);
					if (serviceName === undefined || accountPrefix === undefined) {
						throw new Error('Service did not have seperator: ' + service);
					}

					const results = await keytar.findCredentials(serviceName);
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
			return await this.keytar.setPassword(this.serviceName, id, key);
		} catch (ex) {
			console.log(`Adding key failed: ${ex}`);
		}
	}

	async getCredential(id: string): Promise<string | undefined> {
		try {
			const result = await this.keytar.getPassword(this.serviceName, id);

			if (result === null) {
				return undefined;
			}

			return result;
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

	async findCredentials(prefix: string): Promise<{ account: string, password: string }[]> {
		try {
			return await this.keytar.getPasswords(`${this.serviceName}${separator}${prefix}`);
		} catch (ex) {
			console.log(`Finding credentials failed: ${ex}`);
			return undefined;
		}
	}
}
