/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as os from 'os';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as LocalizedConstants from '../../localizedConstants';
import { Logger } from '../../utils/Logger';
import { CacheEncryptionKeys } from 'azurecore';

export class FileEncryptionHelper {
	constructor(
		private readonly _credentialService: azdata.CredentialProvider,
		protected readonly _fileName: string,
		private readonly _onEncryptionKeysUpdated?: vscode.EventEmitter<CacheEncryptionKeys>
	) {
		this._algorithm = 'aes-256-cbc';
		this._bufferEncoding = 'utf16le';
		this._binaryEncoding = 'base64';
	}

	private _algorithm: string;
	private _bufferEncoding: BufferEncoding;
	private _binaryEncoding: crypto.HexBase64BinaryEncoding;
	private _ivCredId = `${this._fileName}-iv`;
	private _keyCredId = `${this._fileName}-key`;
	private _ivBuffer: Buffer | undefined;
	private _keyBuffer: Buffer | undefined;

	public async init(): Promise<void> {

		const iv = await this.readEncryptionKey(this._ivCredId);
		const key = await this.readEncryptionKey(this._keyCredId);

		if (!iv || !key) {
			this._ivBuffer = crypto.randomBytes(16);
			this._keyBuffer = crypto.randomBytes(32);

			if (!await this.saveEncryptionKey(this._ivCredId, this._ivBuffer.toString(this._bufferEncoding))
				|| !await this.saveEncryptionKey(this._keyCredId, this._keyBuffer.toString(this._bufferEncoding))) {
				Logger.error(`Encryption keys could not be saved in credential store, this will cause access token persistence issues.`);
				await this.showCredSaveErrorOnWindows();
			}
		} else {
			this._ivBuffer = Buffer.from(iv, this._bufferEncoding);
			this._keyBuffer = Buffer.from(key, this._bufferEncoding);
		}

		// Emit event with cache encryption keys to send notification to provider services.
		if (this._onEncryptionKeysUpdated) {
			this._onEncryptionKeysUpdated.fire(this.getEncryptionKeys());
			Logger.verbose('FileEncryptionHelper: Fired encryption keys updated event.');
		}
	}

	/**
	 * Provides encryption keys in use for instant access.
	 */
	public getEncryptionKeys(): CacheEncryptionKeys {
		return {
			iv: this._ivBuffer!.toString(this._bufferEncoding),
			key: this._keyBuffer!.toString(this._bufferEncoding)
		}
	}

	fileSaver = async (content: string): Promise<string> => {
		if (!this._keyBuffer || !this._ivBuffer) {
			await this.init();
		}
		const cipherIv = crypto.createCipheriv(this._algorithm, this._keyBuffer!, this._ivBuffer!);
		let cipherText = `${cipherIv.update(content, 'utf8', this._binaryEncoding)}${cipherIv.final(this._binaryEncoding)}`;
		return cipherText;
	}

	fileOpener = async (content: string, resetOnError?: boolean): Promise<string> => {
		try {
			if (!this._keyBuffer || !this._ivBuffer) {
				await this.init();
			}
			let plaintext = content;
			const decipherIv = crypto.createDecipheriv(this._algorithm, this._keyBuffer!, this._ivBuffer!);
			return `${decipherIv.update(plaintext, this._binaryEncoding, 'utf8')}${decipherIv.final('utf8')}`;
		} catch (ex) {
			Logger.error(`FileEncryptionHelper: Error occurred when decrypting data, IV/KEY will be reset: ${ex}`);
			if (resetOnError) {
				// Reset IV/Keys if crypto cannot encrypt/decrypt data.
				// This could be a possible case of corruption of expected iv/key combination
				await this.refreshEncryptionKeys();
			}
			// Throw error so cache file can be reset to empty.
			throw new Error(`Decryption failed with error: ${ex}`);
		}
	}

	public async refreshEncryptionKeys(): Promise<void> {
		await this.deleteEncryptionKey(this._ivCredId);
		await this.deleteEncryptionKey(this._keyCredId);
		this._ivBuffer = undefined;
		this._keyBuffer = undefined;
		await this.init();
	}

	protected async readEncryptionKey(credentialId: string): Promise<string | undefined> {
		return (await this._credentialService.readCredential(credentialId))?.password;
	}

	protected async deleteEncryptionKey(credentialId: string): Promise<boolean> {
		return (await this._credentialService.deleteCredential(credentialId));
	}

	protected async saveEncryptionKey(credentialId: string, password: string): Promise<boolean> {
		let status: boolean = false;
		try {
			await this._credentialService.saveCredential(credentialId, password)
				.then((result) => {
					status = result;
					if (result) {
						Logger.info(`FileEncryptionHelper: Successfully saved encryption key ${credentialId} persistent cache encryption in system credential store.`);
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
