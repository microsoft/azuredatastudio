/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as crypto from 'crypto';
import { AuthLibrary } from '../../constants';
import { FileEncryptionHelper } from './fileEncryptionHelper';

/**
 * Designed to work with MSAL.NET cache using the same 'aes-256-cbc' algorithm.
 * Key and IV are shared through credential store.
 */
export class MSALFileEncryptionHelper extends FileEncryptionHelper {
	constructor(_credentialService: azdata.CredentialProvider, _fileName: string) {
		super(_credentialService, _fileName);
		this._authLibrary = AuthLibrary.MSAL;
	}

	private _ivBuffer: Buffer | undefined;
	private _keyBuffer: Buffer | undefined;

	async init(): Promise<void> {
		const iv = await this.readEncryptionKey(`${this._fileName}-iv`);
		const key = await this.readEncryptionKey(`${this._fileName}-key`);
		if (!iv || !key) {
			this._ivBuffer = crypto.randomBytes(16);
			this._keyBuffer = crypto.randomBytes(32);
			await this.saveEncryptionKey(`${this._fileName}-iv`, this._ivBuffer.toString('utf16le'));
			await this.saveEncryptionKey(`${this._fileName}-key`, this._keyBuffer.toString('utf16le'));
		} else {
			this._ivBuffer = Buffer.from(iv, 'utf16le');
			this._keyBuffer = Buffer.from(key, 'utf16le');
		}
	}

	public async fileSaver(content: string): Promise<string> {
		if (!this._keyBuffer || !this._ivBuffer) {
			await this.init();
		}
		const cipherIv = crypto.createCipheriv('aes-256-cbc', this._keyBuffer!, this._ivBuffer!);
		return `${cipherIv.update(content, 'utf8', 'base64')}${cipherIv.final('base64')}`;
	}

	public async fileOpener(content: string): Promise<string> {
		if (!this._keyBuffer || !this._ivBuffer) {
			await this.init();
		}
		const decipherIv = crypto.createDecipheriv('aes-256-cbc', this._keyBuffer!, this._ivBuffer!);
		return `${decipherIv.update(content, 'base64', 'utf8')}${decipherIv.final('utf8')}`;
	}
}
