/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as os from 'os';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { AuthLibrary } from '../../constants';
import * as LocalizedConstants from '../../localizedConstants';
import { Logger } from '../../utils/Logger';
import { CacheEncryptionKeys } from 'azurecore';

export class FileEncryptionHelper {
	constructor(
		private readonly _authLibrary: AuthLibrary,
		private readonly _credentialService: azdata.CredentialProvider,
		protected readonly _fileName: string,
		private readonly _onEncryptionKeysUpdated?: vscode.EventEmitter<CacheEncryptionKeys>
	) {
		this._algorithm = this._authLibrary === AuthLibrary.MSAL ? 'aes-256-cbc' : 'aes-256-gcm';
		this._bufferEncoding = this._authLibrary === AuthLibrary.MSAL ? 'utf16le' : 'hex';
		this._binaryEncoding = this._authLibrary === AuthLibrary.MSAL ? 'base64' : 'hex';
	}

	private _algorithm: string;
	private _bufferEncoding: BufferEncoding;
	private _binaryEncoding: crypto.HexBase64BinaryEncoding;
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

			if (!await this.saveEncryptionKey(ivCredId, this._ivBuffer.toString(this._bufferEncoding))
				|| !await this.saveEncryptionKey(keyCredId, this._keyBuffer.toString(this._bufferEncoding))) {
				Logger.error(`Encryption keys could not be saved in credential store, this will cause access token persistence issues.`);
				await this.showCredSaveErrorOnWindows();
			}
		} else {
			this._ivBuffer = Buffer.from(iv, this._bufferEncoding);
			this._keyBuffer = Buffer.from(key, this._bufferEncoding);
		}

		// Emit event with cache encryption keys to send notification to provider services.
		if (this._authLibrary === AuthLibrary.MSAL && this._onEncryptionKeysUpdated) {
			this._onEncryptionKeysUpdated.fire({
				iv: this._ivBuffer.toString(this._bufferEncoding),
				key: this._keyBuffer.toString(this._bufferEncoding)
			});
		}
	}

	fileSaver = async (content: string): Promise<string> => {
		if (!this._keyBuffer || !this._ivBuffer) {
			await this.init();
		}
		const cipherIv = crypto.createCipheriv(this._algorithm, this._keyBuffer!, this._ivBuffer!);
		let cipherText = `${cipherIv.update(content, 'utf8', this._binaryEncoding)}${cipherIv.final(this._binaryEncoding)}`;
		if (this._authLibrary === AuthLibrary.ADAL) {
			cipherText += `%${(cipherIv as crypto.CipherGCM).getAuthTag().toString(this._binaryEncoding)}`;
		}
		return cipherText;
	}

	fileOpener = async (content: string): Promise<string> => {
		if (!this._keyBuffer || !this._ivBuffer) {
			await this.init();
		}
		let plaintext = content;
		const decipherIv = crypto.createDecipheriv(this._algorithm, this._keyBuffer!, this._ivBuffer!);
		if (this._authLibrary === AuthLibrary.ADAL) {
			const split = content.split('%');
			if (split.length !== 2) {
				throw new Error('File didn\'t contain the auth tag.');
			}
			(decipherIv as crypto.DecipherGCM).setAuthTag(Buffer.from(split[1], this._binaryEncoding));
			plaintext = split[0];
		}
		return `${decipherIv.update(plaintext, this._binaryEncoding, 'utf8')}${decipherIv.final('utf8')}`;
	}

	protected async readEncryptionKey(credentialId: string): Promise<string | undefined> {
		return (await this._credentialService.readCredential(credentialId))?.password;
	}

	protected async saveEncryptionKey(credentialId: string, password: string): Promise<boolean> {
		let status: boolean = false;
		try {
			await this._credentialService.saveCredential(credentialId, password)
				.then((result) => {
					status = result;
					if (result) {
						Logger.info(`FileEncryptionHelper: Successfully saved encryption key ${credentialId} for ${this._authLibrary} persistent cache encryption in system credential store.`);
					}
				}, (e => {
					throw Error(`FileEncryptionHelper: Could not save encryption key: ${credentialId}: ${e}`);
				}));
		} catch (ex) {
			if (os.platform() === 'win32') {
				Logger.error(`FileEncryptionHelper: Please try cleaning saved credentials from Windows Credential Manager created by Azure Data Studio to allow creating new credentials.`);
			}
			Logger.error(ex);
			throw ex;
		}
		return status;
	}

	protected async showCredSaveErrorOnWindows(): Promise<void> {
		if (os.platform() === 'win32') {
			await vscode.window.showWarningMessage(LocalizedConstants.azureCredStoreSaveFailedError,
				LocalizedConstants.reloadChoice, LocalizedConstants.cancel)
				.then(async (selection) => {
					if (selection === LocalizedConstants.reloadChoice) {
						await vscode.commands.executeCommand('workbench.action.reloadWindow');
					}
				}, error => {
					Logger.error(error);
				});
		}
	}
}
