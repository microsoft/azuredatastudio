/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { promises as fsPromises } from 'fs';

import * as lockFile from 'lockfile';
import * as path from 'path';
import * as azdata from 'azdata';
import { AccountsClearTokenCacheCommand } from '../../constants';
import { Logger } from '../../utils/Logger';
import { FileEncryptionHelper } from './fileEncryptionHelper';
import { MSALFileEncryptionHelper } from './msalFileEncryptionHelper';

export class MsalCachePluginProvider {
	constructor(
		private readonly _serviceName: string,
		private readonly _msalFilePath: string,
		private readonly _credentialService: azdata.CredentialProvider
	) {
		this._msalFilePath = path.join(this._msalFilePath, this._serviceName);
		this._fileEncryptionHelper = new MSALFileEncryptionHelper(this._credentialService, this._serviceName);
	}

	private _lockTaken: boolean = false;
	private _fileEncryptionHelper: FileEncryptionHelper;

	private getLockfilePath(): string {
		return this._msalFilePath + '.lockfile';
	}

	public getCachePlugin(): ICachePlugin {
		const lockFilePath = this.getLockfilePath();
		const beforeCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			await this.waitAndLock(lockFilePath);
			try {
				const cache = await fsPromises.readFile(this._msalFilePath, { encoding: 'utf8' });
				const decryptedData = await this._fileEncryptionHelper.fileOpener(cache!);
				try {
					cacheContext.tokenCache.deserialize(decryptedData);
				} catch (e) {
					// Handle deserialization error in cache file in case file gets corrupted.
					// Clearing cache here will ensure account is marked stale so re-authentication can be triggered.
					Logger.verbose(`MsalCachePlugin: Error occurred when trying to read cache file, file contents will be cleared: ${e.message}`);
					await fsPromises.writeFile(this._msalFilePath, '', { encoding: 'utf8' });
				}
				Logger.verbose(`MsalCachePlugin: Token read from cache successfully.`);
			} catch (e) {
				if (e.code === 'ENOENT') {
					// File doesn't exist, log and continue
					Logger.verbose(`MsalCachePlugin: Cache file not found on disk: ${e.code}`);
				}
				else {
					Logger.error(`MsalCachePlugin: Failed to read from cache file: ${e}`);
					Logger.verbose(`MsalCachePlugin: Error occurred when trying to read cache file, file contents will be cleared: ${e.message}`);
					await fsPromises.writeFile(this._msalFilePath, '', { encoding: 'utf8' });
				}
			} finally {
				lockFile.unlockSync(lockFilePath);
				this._lockTaken = false;
			}
		}

		const afterCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			if (cacheContext.cacheHasChanged) {
				await this.waitAndLock(lockFilePath);
				try {
					const data = cacheContext.tokenCache.serialize();
					const encryptedData = await this._fileEncryptionHelper.fileSaver(data!);
					await fsPromises.writeFile(this._msalFilePath, encryptedData, { encoding: 'utf8' });
					Logger.verbose(`MsalCachePlugin: Token written to cache successfully.`);
				} catch (e) {
					Logger.error(`MsalCachePlugin: Failed to write to cache file. ${e}`);
					throw e;
				} finally {
					lockFile.unlockSync(lockFilePath);
					this._lockTaken = false;
				}
			}
		};

		// This is an implementation of ICachePlugin that uses the beforeCacheAccess and afterCacheAccess callbacks to read and write to a file
		// Ref https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-node-migration#enable-token-caching
		// In future we should use msal-node-extensions to provide a secure storage of tokens, instead of implementing our own
		// However - as of now this library does not come with pre-compiled native libraries that causes runtime issues
		// Ref https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/3332
		return {
			beforeCacheAccess,
			afterCacheAccess,
		};
	}

	private async waitAndLock(lockFilePath: string): Promise<void> {
		// Make 500 retry attempts with 100ms wait time between each attempt to allow enough time for the lock to be released.
		const retries = 500;
		const retryWait = 100;

		// We cannot rely on lockfile.lockSync() to clear stale lockfile,
		// so we check if the lockfile exists and if it does, calling unlockSync() will clear it.
		if (lockFile.checkSync(lockFilePath) && !this._lockTaken) {
			lockFile.unlockSync(lockFilePath);
			Logger.verbose(`MsalCachePlugin: Stale lockfile found and has been removed.`);
		}

		let retryAttempt = 0;
		while (retryAttempt <= retries) {
			try {
				// Use lockfile.lockSync() to ensure only one process is accessing the cache at a time.
				// lockfile.lock() does not wait for async callback promise to resolve.
				lockFile.lockSync(lockFilePath);
				this._lockTaken = true;
				break;
			} catch (e) {
				if (retryAttempt === retries) {
					Logger.error(`MsalCachePlugin: Failed to acquire lock on cache file after ${retries} attempts.`);
					throw new Error(`Failed to acquire lock on cache file after ${retries} attempts. Please attempt command: '${AccountsClearTokenCacheCommand}' to clear access token cache.`);
				}
				retryAttempt++;
				Logger.verbose(`MsalCachePlugin: Failed to acquire lock on cache file. Retrying in ${retryWait} ms.`);
				await new Promise(resolve => setTimeout(resolve, retryWait));
			}
		}
	}
}
