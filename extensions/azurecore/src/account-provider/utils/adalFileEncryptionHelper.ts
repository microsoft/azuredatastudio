/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as crypto from 'crypto';
import { AuthLibrary } from '../../constants';
import { Logger } from '../../utils/Logger';
import { FileEncryptionHelper } from './fileEncryptionHelper';

export class ADALFileEncryptionHelper extends FileEncryptionHelper {
	constructor(_credentialService: azdata.CredentialProvider, _fileName: string) {
		super(_credentialService, _fileName);
		this._authLibrary = AuthLibrary.ADAL;
	}

	private _ivBuffer: Buffer | undefined;
	private _keyBuffer: Buffer | undefined;

	public async init(): Promise<void> {
		const ivCredId = `${this._fileName}-iv`;
		const keyCredId = `${this._fileName}-key`;

		const iv = await this.readEncryptionKey(ivCredId);
		const key = await this.readEncryptionKey(keyCredId);

		if (!iv || !key) {
			this._ivBuffer = crypto.randomBytes(16);
			this._keyBuffer = crypto.randomBytes(32);

			if (!await this.saveEncryptionKey(ivCredId, this._ivBuffer.toString('hex'))
				|| !await this.saveEncryptionKey(keyCredId, this._keyBuffer.toString('hex'))) {
				Logger.error(`Encryption keys could not be saved in credential store, this will cause access token persistence issues.`);
				await this.showCredSaveErrorOnWindows();
			}
		} else {
			this._ivBuffer = Buffer.from(iv, 'hex');
			this._keyBuffer = Buffer.from(key, 'hex');
		}
	}

	fileSaver = async (content: string): Promise<string> => {
		if (!this._keyBuffer || !this._ivBuffer) {
			await this.init();
		}
		const cipherIv = crypto.createCipheriv('aes-256-gcm', this._keyBuffer!, this._ivBuffer!);
		return `${cipherIv.update(content, 'utf8', 'hex')}${cipherIv.final('hex')}%${cipherIv.getAuthTag().toString('hex')}`;
	}

	fileOpener = async (content: string): Promise<string> => {
		if (!this._keyBuffer || !this._ivBuffer) {
			await this.init();
		}
		const decipherIv = crypto.createDecipheriv('aes-256-gcm', this._keyBuffer!, this._ivBuffer!);
		const split = content.split('%');
		if (split.length !== 2) {
			throw new Error('File didn\'t contain the auth tag.');
		}
		decipherIv.setAuthTag(Buffer.from(split[1], 'hex'));
		return `${decipherIv.update(split[0], 'hex', 'utf8')}${decipherIv.final('utf8')}`;
	}
}
