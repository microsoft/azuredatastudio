/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICachePlugin, TokenCacheContext } from "@azure/msal-node";
import Cryptr = require('cryptr');
import { constants } from "fs";
import { promises as fsPromises } from 'fs';
import * as os from "os";
import { Logger } from '../../utils/Logger';

export class MsalCachePluginProvider {
	constructor(private _msalCachePath: string) {
		Logger.verbose(`MsalCachePluginProvider: Using cache path ${_msalCachePath}`);
	}

	private getCrypto(): Cryptr {
		return new Cryptr(os.userInfo().username);
	}

	private getMsalCachePath(): string {
		return this._msalCachePath;
	}

	public getCachePlugin(): ICachePlugin {
		const cachePath = this.getMsalCachePath();
		const beforeCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			let exists = true;
			try {
				await fsPromises.access(cachePath, constants.R_OK | constants.W_OK);
			} catch {
				exists = false;
			}
			if (exists) {
				try {
					const cache = await fsPromises.readFile(cachePath, "utf-8"); // works with " " not ' '
					cacheContext.tokenCache.deserialize(this.getCrypto().decrypt(cache));
					Logger.verbose(`MsalCachePlugin: Token read from cache successfully.`);
				} catch (e) {
					Logger.error(`MsalCachePlugin: Failed to read from cache file.`);
					throw e;
				}
			}
		};

		const afterCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			if (cacheContext.cacheHasChanged) {
				try {
					const data = this.getCrypto().encrypt(cacheContext.tokenCache.serialize());
					await fsPromises.writeFile(cachePath, data);
					Logger.verbose(`MsalCachePlugin: Token written to cache successfully.`);
				} catch (e) {
					Logger.error(`MsalCachePlugin: Failed to write to cache file.`);
					throw e;
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
}
