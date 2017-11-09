/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as adal from 'adal-node';
import * as data from 'data';
import * as crypto from 'crypto';
import * as fs from 'fs';

export default class TokenCache implements adal.TokenCache {
	private static CipherAlgorithm = 'aes256';
	private static CipherAlgorithmIvLength = 16;
	private static CipherKeyLength = 32;
	private static FsOptions = { encoding: 'ascii' };

	private _activeOperation: Thenable<any>;

	constructor(
		private _credentialProvider: data.CredentialProvider,
		private _credentialServiceKey: string,
		private _cacheSerializationPath: string
	) {
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public add(entries: adal.TokenCacheEntry[], callback: (error?: Error) => void): void {
		let self = this;

		this.doOperation(() => {
			return self.readCache()
				.then(cache => self.addToCache(cache, entries))
				.then(updatedCache => self.writeCache(updatedCache))
				.then(
					() => callback(null),
					(err) => callback(err)
				);
		});
	}

	public clear(): Thenable<void> {
		let self = this;

		// 1) Delete encrypted serialization file
		//    If we got an 'ENOENT' response, the file doesn't exist, which is fine
		// 3) Delete the encryption key
		return new Promise<void>((resolve, reject) => {
			fs.unlink(self._cacheSerializationPath, err => {
				if (err && err.code !== 'ENOENT') {
					reject(err);
				} else {
					resolve();
				}
			});
		})
		.then(() => { return self._credentialProvider.deleteCredential(self._credentialServiceKey); })
		.then(() => {});
	}

	public find(query: adal.TokenCacheQuery, callback: (error: Error, results: adal.TokenCacheEntry[]) => void): void {
		let self = this;

		this.doOperation(() => {
			return self.readCache()
				.then(cache => {
					return cache.filter(
						entry => TokenCache.findByPartial(entry, query)
					);
				})
				.then(
					results => callback(null, results),
					(err) => callback(err, null)
				);
		});
	}

	public remove(entries: adal.TokenCacheEntry[], callback: (error?: Error) => void): void {
		let self = this;

		this.doOperation(() => {
			return this.readCache()
				.then(cache => self.removeFromCache(cache, entries))
				.then(updatedCache => self.writeCache(updatedCache))
				.then(
					() => callback(null),
					(err) => callback(err)
				);
		});
	}

	// PRIVATE METHODS /////////////////////////////////////////////////////
	private static findByKeyHelper(entry1: adal.TokenCacheEntry, entry2: adal.TokenCacheEntry): boolean {
		return entry1._authority === entry2._authority
			&& entry1._clientId === entry2._clientId
			&& entry1.userId === entry2.userId
			&& entry1.resource === entry2.resource;
	}

	private static findByPartial(entry: adal.TokenCacheEntry, query: object): boolean {
		for (let key in query) {
			if (entry[key] === undefined || entry[key] !== query[key]) {
				return false;
			}
		}
		return true;
	}

	private doOperation<T>(op: () => Thenable<T>): void {
		// Initialize the active operation to an empty promise if necessary
		let activeOperation = this._activeOperation || Promise.resolve<any>(null);

		// Chain the operation to perform to the end of the existing promise
		activeOperation = activeOperation.then(op);

		// Add a catch at the end to make sure we can continue after any errors
		activeOperation = activeOperation.then(null, err => {
			console.error(`Failed to perform token cache operation: ${err}`);
		});

		// Point the current active operation to this one
		this._activeOperation = activeOperation;
	}

	private addToCache(cache: adal.TokenCacheEntry[], entries: adal.TokenCacheEntry[]): adal.TokenCacheEntry[] {
		// First remove entries from the db that are being updated
		cache = this.removeFromCache(cache, entries);

		// Then add the new entries to the cache
		entries.forEach((entry: adal.TokenCacheEntry) => {
			cache.push(entry);
		});

		return cache;
	}

	private getOrCreateEncryptionParams(): Thenable<EncryptionParams> {
		let self = this;

		return this._credentialProvider.readCredential(this._credentialServiceKey)
			.then(credential => {
				if (credential.password) {
					// We already have encryption params, deserialize them
					let splitValues = credential.password.split('|');
					if (splitValues.length === 2 && splitValues[0] && splitValues[1]) {
						try {
							return <EncryptionParams>{
								key: new Buffer(splitValues[0], 'hex'),
								initializationVector: new Buffer(splitValues[1], 'hex')
							};
						} catch(e) {
							// Swallow the error and fall through to generate new params
							console.warn('Failed to deserialize encryption params, new ones will be generated.');
						}
					}
				}

				// We haven't stored encryption values, so generate them
				let encryptKey = crypto.randomBytes(TokenCache.CipherKeyLength);
				let initializationVector = crypto.randomBytes(TokenCache.CipherAlgorithmIvLength);

				// Serialize the values
				let serializedValues = `${encryptKey.toString('hex')}|${initializationVector.toString('hex')}`;
				return self._credentialProvider.saveCredential(self._credentialServiceKey, serializedValues)
					.then(() => {
						return <EncryptionParams> {
							key: encryptKey,
							initializationVector: initializationVector
						};
					});
			});
	}

	private readCache(): Thenable<adal.TokenCacheEntry[]> {
		let self = this;

		// NOTE: File system operations are performed synchronously to avoid annoying nested callbacks
		// 1) Get the encryption key
		// 2) Read the encrypted token cache file
		// 3) Decrypt the file contents
		// 4) Deserialize and return
		return this.getOrCreateEncryptionParams()
			.then(encryptionParams => {
				try {
					let cacheCipher = fs.readFileSync(self._cacheSerializationPath, TokenCache.FsOptions);

					let decipher = crypto.createDecipheriv(TokenCache.CipherAlgorithm, encryptionParams.key, encryptionParams.initializationVector);
					let cacheJson = decipher.update(cacheCipher, 'hex', 'binary');
					cacheJson += decipher.final('binary');

					return JSON.parse(cacheJson);
				} catch(e) {
					throw e;
				}
			})
			.then(null, err => {
				// If reading the token cache fails, we'll just assume the tokens are garbage
				console.warn(`Failed to read token cache: ${err}`);
				return [];
			});
	}

	private removeFromCache(cache: adal.TokenCacheEntry[], entries: adal.TokenCacheEntry[]): adal.TokenCacheEntry[] {
		entries.forEach((entry: adal.TokenCacheEntry) => {
			// Check to see if the entry exists
			let match = cache.findIndex(entry2 => TokenCache.findByKeyHelper(entry, entry2));
			if (match >= 0) {
				// Entry exists, remove it from cache
				cache.splice(match, 1);
			}
		});

		return cache;
	}

	private writeCache(cache: adal.TokenCacheEntry[]): Thenable<void> {
		let self = this;
		// NOTE: File system operations are being done synchronously to avoid annoying callback nesting
		// 1) Get (or generate) the encryption key
		// 2) Stringify the token cache entries
		// 4) Encrypt the JSON
		// 3) Write to the file
		return this.getOrCreateEncryptionParams()
			.then(encryptionParams => {
				try {
					let cacheJson = JSON.stringify(cache);

					let cipher = crypto.createCipheriv(TokenCache.CipherAlgorithm, encryptionParams.key, encryptionParams.initializationVector);
					let cacheCipher = cipher.update(cacheJson, 'binary', 'hex');
					cacheCipher += cipher.final('hex');

					fs.writeFileSync(self._cacheSerializationPath, cacheCipher, TokenCache.FsOptions);
				} catch (e) {
					throw e;
				}
			});
	}
}

interface EncryptionParams {
	key: Buffer;
	initializationVector: Buffer;
}
