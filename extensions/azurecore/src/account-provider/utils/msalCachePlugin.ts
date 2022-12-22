/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { constants, promises as fsPromises } from 'fs';
import * as lockFile from 'lockfile';
import * as path from 'path';
import { Logger } from '../../utils/Logger';

export class MsalCachePluginProvider {
	constructor(
		private readonly _serviceName: string,
		private readonly _msalFilePath: string
	) {
		this._msalFilePath = path.join(this._msalFilePath, this._serviceName);
		this._serviceName = this._serviceName.replace(/-/, '_');
		Logger.verbose(`MsalCachePluginProvider: Using cache path ${_msalFilePath} and serviceName ${_serviceName}`);
	}

	private getLockfilePath(): string {
		return this._msalFilePath + '.lock';
	}

	public getCachePlugin(): ICachePlugin {
		const lockFilePath = this.getLockfilePath();
		const beforeCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			let isAccessible = true;
			await this.waitAndLock(lockFilePath);
			try {
				try {
					await fsPromises.access(this._msalFilePath, constants.R_OK | constants.W_OK);
				} catch {
					Logger.error(`MsalCachePlugin: Cache file is not accessible.`);
					isAccessible = false;
				}
				if (isAccessible) {
					const cache = await fsPromises.readFile(this._msalFilePath, { encoding: 'utf8' });
					try {
						cacheContext.tokenCache.deserialize(cache);
					} catch (e) { // Handle deserialization error in cache file in case file gets corrupted.
						// Clearing cache here will ensure account is marked stale so re-authentication can be triggered.
						Logger.verbose(`MsalCachePlugin: Cache file contents will be cleeared.`);
						await fsPromises.writeFile(this._msalFilePath, '', { encoding: 'utf8' });
					}
					Logger.verbose(`MsalCachePlugin: Token read from cache successfully.`);
				}
			} catch (e) {
				Logger.error(`MsalCachePlugin: Failed to read from cache file: ${e}`);
				throw e;
			} finally {
				lockFile.unlockSync(lockFilePath);
			}
		}

		const afterCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			if (cacheContext.cacheHasChanged) {
				await this.waitAndLock(lockFilePath);
				try {
					const data = cacheContext.tokenCache.serialize();
					await fsPromises.writeFile(this._msalFilePath, data, { encoding: 'utf8' });
					Logger.verbose(`MsalCachePlugin: Token written to cache successfully.`);
				} catch (e) {
					Logger.error(`MsalCachePlugin: Failed to write to cache file. ${e}`);
					throw e;
				} finally {
					lockFile.unlockSync(lockFilePath);
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

		let retryAttempt = 0;
		while (retryAttempt <= retries) {
			try {
				// Use lockfile.lockSync() to ensure only one process is accessing the cache at a time.
				// lockfile.lock() does not wait for async callback promise to resolve.
				lockFile.lockSync(lockFilePath);
				break;
			} catch (e) {
				if (retryAttempt === retries) {
					Logger.error(`MsalCachePlugin: Failed to acquire lock on cache file after ${retries} attempts.`);
					throw e;
				}
				retryAttempt++;
				Logger.verbose(`MsalCachePlugin: Failed to acquire lock on cache file. Retrying in ${retryWait} ms.`);
				await new Promise(resolve => setTimeout(resolve, retryWait));
			}
		}
	}
}
