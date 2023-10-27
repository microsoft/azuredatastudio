/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { promises as fsPromises } from 'fs';

import * as lockFile from 'lockfile';
import * as path from 'path';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { AccountsClearTokenCacheCommand, LocalCacheSuffix, LockFileSuffix } from '../../constants';
import { Logger } from '../../utils/Logger';
import { FileEncryptionHelper } from './fileEncryptionHelper';
import { CacheEncryptionKeys } from 'azurecore';
import { Token } from '../auths/azureAuth';

interface CacheConfiguration {
	name: string,
	cacheFilePath: string,
	lockFilePath: string,
	lockTaken: boolean
}

interface LocalAccountCache {
	tokens: Token[];
}

export class MsalCachePluginProvider {
	constructor(
		private readonly _serviceName: string,
		msalFilePath: string,
		private readonly _credentialService: azdata.CredentialProvider,
		private readonly _onEncryptionKeysUpdated: vscode.EventEmitter<CacheEncryptionKeys>
	) {
		this._fileEncryptionHelper = new FileEncryptionHelper(this._credentialService, this._serviceName, this._onEncryptionKeysUpdated);
		this._msalCacheConfiguration = {
			name: 'MSAL',
			cacheFilePath: path.join(msalFilePath, this._serviceName),
			lockFilePath: path.join(msalFilePath, this._serviceName) + LockFileSuffix,
			lockTaken: false
		}
		this._localCacheConfiguration = {
			name: 'Local',
			cacheFilePath: path.join(msalFilePath, this._serviceName) + LocalCacheSuffix,
			lockFilePath: path.join(msalFilePath, this._serviceName) + LocalCacheSuffix + LockFileSuffix,
			lockTaken: false
		}
	}

	private _fileEncryptionHelper: FileEncryptionHelper;
	private _msalCacheConfiguration: CacheConfiguration;
	private _localCacheConfiguration: CacheConfiguration;
	private _emptyLocalCache: LocalAccountCache = { tokens: [] };

	public async init(): Promise<void> {
		await this._fileEncryptionHelper.init();
	}

	public getCacheEncryptionKeys(): CacheEncryptionKeys {
		return this._fileEncryptionHelper.getEncryptionKeys();
	}

	public async refreshCacheEncryptionKeys(): Promise<void> {
		await this._fileEncryptionHelper.refreshEncryptionKeys();
	}

	public getCachePlugin(): ICachePlugin {
		const beforeCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			try {
				const decryptedData = await this.readCache(this._msalCacheConfiguration, this._localCacheConfiguration);
				cacheContext.tokenCache.deserialize(decryptedData);
			} catch (e) {
				// Handle deserialization error in cache file in case file gets corrupted.
				// Clearing cache here will ensure account is marked stale so re-authentication can be triggered.
				Logger.verbose(`MsalCachePlugin: Error occurred when trying to read cache file, file will be deleted: ${e.message}`);
				await this.unlinkCache(this._msalCacheConfiguration);
			}
		}

		const afterCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			if (cacheContext.cacheHasChanged) {
				const data = cacheContext.tokenCache.serialize();
				await this.writeCache(data, this._msalCacheConfiguration);
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

	/**
	 * Fetches access token from local cache, before accessing MSAL Cache.
	 * @param accountId Account Id for token owner.
	 * @param tenantId Tenant Id to which token belongs to.
	 * @param resource Resource Id to which token belongs to.
	 * @returns Access Token.
	 */
	public async getTokenFromLocalCache(accountId: string, tenantId: string, resource: azdata.AzureResource): Promise<Token | undefined> {
		let cache = JSON.parse(await this.readCache(this._localCacheConfiguration, this._msalCacheConfiguration)) as LocalAccountCache;
		let token = cache?.tokens?.find(token => (
			token.key === accountId &&
			token.tenantId === tenantId &&
			token.resource === resource
		));
		return token;
	}

	/**
	 * Updates local cache with newly fetched access token to prevent throttling of AAD requests.
	 * @param token Access token to be written to cache file.
	 */
	public async writeTokenToLocalCache(token: Token): Promise<void> {
		let updateCount = 0;
		let indexToUpdate = -1;
		let cache: LocalAccountCache;
		cache = JSON.parse(await this.readCache(this._localCacheConfiguration, this._msalCacheConfiguration)) as LocalAccountCache;
		if (cache?.tokens) {
			cache.tokens.forEach((t, i) => {
				if (t.key === token.key && t.tenantId === token.tenantId && t.resource === token.resource
				) {
					// Update token
					indexToUpdate = i;
					updateCount++;
				}
			});
		} else {
			// Initialize token cache
			cache = this._emptyLocalCache;
		}

		if (updateCount === 0) {
			// No tokens were updated, add new token.
			cache.tokens.push(token);
			updateCount = 1;
		}

		if (updateCount === 1) {
			if (indexToUpdate !== -1) {
				cache.tokens[indexToUpdate] = token;
			}
			await this.writeCache(JSON.stringify(cache), this._localCacheConfiguration);
		}
		else {
			Logger.info(`Found multiple tokens in local cache, cache will be reset.`);
			// Reset cache as we don't expect multiple tokens to be stored for same combination.
			await this.writeCache(JSON.stringify(this._emptyLocalCache), this._localCacheConfiguration);
		}
	}

	/**
	 * Removes associated tokens for account, to be called when account is deleted.
	 * @param accountId Account ID
	 */
	public async clearAccountFromLocalCache(accountId: string): Promise<void> {
		let cache = JSON.parse(await this.readCache(this._localCacheConfiguration, this._msalCacheConfiguration)) as LocalAccountCache;
		let tokenIndices: number[] = [];
		if (cache?.tokens) {
			cache.tokens.forEach((t, i) => {
				if (t.key === accountId) {
					tokenIndices.push(i);
				}
			});
		}
		tokenIndices.forEach(i => {
			cache.tokens.splice(i);
		})
		Logger.info(`Local Cache cleared for account, ${tokenIndices.length} tokens were cleared.`);
	}

	/**
	 * Deletes both cache files.
	 */
	public async unlinkCacheFiles(): Promise<void> {
		await this.unlinkCache(this._msalCacheConfiguration);
		await this.unlinkCache(this._localCacheConfiguration);
	}

	//#region Private helper methods
	private async writeCache(fileContents: string, config: CacheConfiguration): Promise<void> {
		config.lockTaken = await this.waitAndLock(config.lockFilePath, config.lockTaken);
		try {
			const encryptedCache = await this._fileEncryptionHelper.fileSaver(fileContents);
			await fsPromises.writeFile(config.cacheFilePath, encryptedCache, { encoding: 'utf8' });
		} catch (e) {
			Logger.error(`MsalCachePlugin: Failed to write to '${config.name}' cache file: ${e}`);
			throw e;
		} finally {
			lockFile.unlockSync(config.lockFilePath);
			config.lockTaken = false;
		}
	}

	/**
	 * Reads from an encrypted cache file based on currentConfig provided.
	 * @param currentConfig Currently used cache configuration.
	 * @param alternateConfig Alternate cache configuration for resetting needs.
	 * @returns Decrypted data.
	 */
	private async readCache(currentConfig: CacheConfiguration, alternateConfig: CacheConfiguration): Promise<string> {
		currentConfig.lockTaken = await this.waitAndLock(currentConfig.lockFilePath, currentConfig.lockTaken);
		try {
			const cache = await fsPromises.readFile(currentConfig.cacheFilePath, { encoding: 'utf8' });
			const decryptedData = await this._fileEncryptionHelper.fileOpener(cache!, true);
			return decryptedData;
		} catch (e) {
			if (e.code === 'ENOENT') {
				// File doesn't exist, log and continue
				Logger.verbose(`MsalCachePlugin: Cache file for '${currentConfig.name}' cache not found on disk: ${e.code}`);
			}
			else {
				Logger.error(`MsalCachePlugin: Failed to read from cache file: ${e}`);
				Logger.verbose(`MsalCachePlugin: Error occurred when trying to read cache file ${currentConfig.name}, file will be deleted: ${e.message}`);
				await this.unlinkCache(currentConfig);
				// Ensure both configurations are not same.
				if (currentConfig.name !== alternateConfig.name) {
					// Delete alternate cache file as well.
					alternateConfig.lockTaken = await this.waitAndLock(alternateConfig.lockFilePath, alternateConfig.lockTaken);
					await this.unlinkCache(alternateConfig);
					lockFile.unlockSync(alternateConfig.lockFilePath);
					alternateConfig.lockTaken = false;
					Logger.verbose(`MsalCachePlugin: Cache file for ${alternateConfig.name} cache also deleted.`);
				}
			}
			return '{}'; // Return empty json string if cache not read.
		} finally {
			lockFile.unlockSync(currentConfig.lockFilePath);
			currentConfig.lockTaken = false;
		}
	}

	private async waitAndLock(lockFilePath: string, lockTaken: boolean): Promise<boolean> {
		// Make 500 retry attempts with 100ms wait time between each attempt to allow enough time for the lock to be released.
		const retries = 500;
		const retryWait = 100;

		// We cannot rely on lockfile.lockSync() to clear stale lockfile,
		// so we check if the lockfile exists and if it does, calling unlockSync() will clear it.
		if (lockFile.checkSync(lockFilePath) && !lockTaken) {
			lockFile.unlockSync(lockFilePath);
			Logger.verbose(`MsalCachePlugin: Stale lockfile found and has been removed.`);
		}

		let retryAttempt = 0;
		while (retryAttempt <= retries) {
			try {
				// Use lockfile.lockSync() to ensure only one process is accessing the cache at a time.
				// lockfile.lock() does not wait for async callback promise to resolve.
				lockFile.lockSync(lockFilePath);
				lockTaken = true;
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
		return lockTaken;
	}

	/**
	 * Deletes access token cache file for specified config
	 */
	private async unlinkCache(config: CacheConfiguration): Promise<void> {
		try {
			await fsPromises.unlink(config.cacheFilePath);
		} catch (e) {
			Logger.info(`An error occurred when clearing ${config.name} Cache, safely ignored: ${e}`);
		}
	}
	//#endregion
}
