/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as keytarType from 'keytar';
import { join, parse } from 'path';
import { FileDatabase } from './fileDatabase';
import * as crypto from 'crypto';
import * as azdata from 'azdata';

function getSystemKeytar(): Keytar | undefined {
	try {
		return require('keytar');
	} catch (err) {
		console.log(err);
	}

	return undefined;
}

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
		decipherIv.setAuthTag(Buffer.from(split[1], 'hex'));

		return `${decipherIv.update(split[0], 'hex', 'utf8')}${decipherIv.final('utf8')}`;
	};

	const db = new FileDatabase(filePath, fileOpener, fileSaver);
	await db.initialize();

	const fileKeytar: Keytar = {
		async getPassword(service: string, account: string): Promise<string> {
			return db.get(`${service}-${account}`);
		},

		async setPassword(service: string, account: string, password: string): Promise<void> {
			await db.set(`${service}-${account}`, password);
		},

		async deletePassword(service: string, account: string): Promise<boolean> {
			await db.delete(`${service}-${account}`);
			return true;
		}
	};
	return fileKeytar;
}

export type Keytar = {
	getPassword: typeof keytarType['getPassword'];
	setPassword: typeof keytarType['setPassword'];
	deletePassword: typeof keytarType['deletePassword'];
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
		}
		if (!keytar) {
			keytar = await getFileKeytar(join(this.userStoragePath, this.serviceName), this.credentialService);
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

}
