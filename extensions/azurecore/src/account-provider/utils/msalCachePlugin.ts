/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICachePlugin, TokenCacheContext } from "@azure/msal-node";
import * as lockFile from 'lockfile';
import { constants, promises as fsPromises } from 'fs';
import * as azdata from "azdata";
import * as os from "os";
import { Logger } from '../../utils/Logger';
import { FileEncryptionHelper } from './fileEncryptionHelper';

export class MsalCachePluginProvider {
	constructor(
		private readonly _msalFilePath: string,
		private _credentialService: azdata.CredentialProvider,
		// the more the better - otherwise we can have incomplete tenant list.
		// If users complain they don't see all tenants when expanding multiple nodes together,
		// we can increase this to allow more time to fetch access tokens.
		private _maxRetryCount: number = 200,
		// 10 ms is a good balance between performance and not blocking the thread.
		private _retryWait: number = 10
	) {
		Logger.verbose(`MsalCachePluginProvider: Using cache path ${_msalFilePath} for user
			${os.userInfo({ encoding: "utf-8" }).username}`);
		Logger.verbose(`MsalCachePluginProvider: Using retries ${_maxRetryCount} and retryWait ${_retryWait}`);
		this._fileEncryptionHelper = new FileEncryptionHelper(this._credentialService, _msalFilePath);
	}

	private _fileEncryptionHelper: FileEncryptionHelper;

	private getLockfilePath(): string {
		return this._msalFilePath + '.lock';
	}

	public getCachePlugin(): ICachePlugin {
		const lockFilePath = this.getLockfilePath();
		const lockFileOptions = {
			retries: this._maxRetryCount,
			retryWait: this._retryWait
		}
		const beforeCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			let exists = true;
			lockFile.lock(lockFilePath, lockFileOptions, async (er) => {
				try {
					await fsPromises.access(this._msalFilePath, constants.R_OK | constants.W_OK);
				} catch {
					exists = false;
				}
				if (exists) {
					try {
						const cache = await fsPromises.readFile(this._msalFilePath, "utf-8"); // works with " " not ' '
						cacheContext.tokenCache.deserialize(await this._fileEncryptionHelper.fileOpener(cache));
						Logger.verbose(`MsalCachePlugin: Token read from cache successfully.`);
					} catch (e) {
						Logger.error(`MsalCachePlugin: Failed to read from cache file. ${e}`);
						throw e;
					}
				}
				lockFile.unlock(lockFilePath, function (er) {
					Logger.error(`MsalCachePlugin: Failed to read from cache file: ${er}`);
					throw er;
				})
			});
		};

		const afterCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			if (cacheContext.cacheHasChanged) {
				lockFile.lock(lockFilePath, lockFileOptions, async (er) => {
					try {
						const data = this._fileEncryptionHelper.fileSaver(cacheContext.tokenCache.serialize());
						await fsPromises.writeFile(this._msalFilePath, data);
						Logger.verbose(`MsalCachePlugin: Token written to cache successfully.`);
					} catch (e) {
						Logger.error(`MsalCachePlugin: Failed to write to cache file. ${e}`);
						throw e;
					}
				});
				lockFile.unlock(lockFilePath, function (er) {
					Logger.error(`MsalCachePlugin: Failed to write to cache file: ${er}`);
					throw er;
				});
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
}
