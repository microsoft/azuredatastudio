/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as os from 'os';
import * as vscode from 'vscode';
import { AuthLibrary } from '../../constants';
import * as LocalizedConstants from '../../localizedConstants';
import { Logger } from '../../utils/Logger';

export abstract class FileEncryptionHelper {
	constructor(
		private _credentialService: azdata.CredentialProvider,
		protected _fileName: string,
	) { }

	protected _authLibrary!: AuthLibrary;

	public abstract fileOpener(content: string): Promise<string>;

	public abstract fileSaver(content: string): Promise<string>;

	public abstract init(): Promise<void>;

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
