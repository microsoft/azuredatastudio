/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { constants, promises as fsPromises } from 'fs';
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

	public getCachePlugin(): ICachePlugin {
		const beforeCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			let exists = true;
			try {
				await fsPromises.access(this._msalFilePath, constants.R_OK | constants.W_OK);
			} catch {
				exists = false;
			}
			if (exists) {
				try {
					const cache = await fsPromises.readFile(this._msalFilePath, { encoding: 'utf8' });
					cacheContext.tokenCache.deserialize(cache);
					Logger.verbose(`MsalCachePlugin: Token read from cache successfully.`);
				} catch (e) {
					Logger.error(`MsalCachePlugin: Failed to read from cache file. ${e}`);
					throw e;
				}
			}
		};

		const afterCacheAccess = async (cacheContext: TokenCacheContext): Promise<void> => {
			if (cacheContext.cacheHasChanged) {
				try {
					const data = cacheContext.tokenCache.serialize();
					await fsPromises.writeFile(this._msalFilePath, data, { encoding: 'utf8' });
					Logger.verbose(`MsalCachePlugin: Token written to cache successfully.`);
				} catch (e) {
					Logger.error(`MsalCachePlugin: Failed to write to cache file. ${e}`);
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
