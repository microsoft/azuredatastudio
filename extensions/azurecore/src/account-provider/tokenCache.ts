/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as adal from 'adal-node';
import * as azdata from 'azdata';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';

export default class TokenCache implements adal.TokenCache {
	private static CipherAlgorithm = 'aes-256-cbc';
	private static CipherAlgorithmIvLength = 16;
	private static CipherKeyLength = 32;
	private static FsOptions = { encoding: 'ascii' };

	private _activeOperation: Thenable<any>;

	constructor(
		private _credentialProvider: azdata.CredentialProvider,
		private _credentialServiceKey: string,
		private _cacheSerializationPath: string
	) {
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public add(entries: adal.TokenResponse[], callback: (error: Error, result: boolean) => void): void {
		let self = this;

		this.doOperation(() => {
			return self.readCache()
				.then(cache => self.addToCache(cache, entries))
				.then(updatedCache => self.writeCache(updatedCache))
				.then(
					() => callback(null, true),
					(err) => callback(err, false)
				);
		});
	}

	/**
	 * Wrapper to make callback-based add method into a thenable method
	 * @param entries Entries to add into the cache
	 * @returns Promise to return the result of adding the tokens to the cache
	 *     Rejected if an error was sent in the callback
	 */
	public addThenable(entries: adal.TokenResponse[]): Thenable<boolean> {
		let self = this;

		return new Promise<boolean>((resolve, reject) => {
			self.add(entries, (error: Error, results: boolean) => {
				if (error) {
					reject(error);
				} else {
					resolve(results);
				}
			});
		});
	}

	public async clear(): Promise<void> {

		// 1) Delete encrypted serialization file
		//    If we got an 'ENOENT' response, the file doesn't exist, which is fine
		// 3) Delete the encryption key
		try {
			await fs.unlink(this._cacheSerializationPath);
		} catch (err) {
			if (err.code !== 'ENOENT') {
				throw err;
			}
		}
		await this._credentialProvider.deleteCredential(this._credentialServiceKey);
	}

	public find(query: any, callback: (error: Error, results: any[]) => void): void {
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

	/**
	 * Wrapper to make callback-based find method into a thenable method
	 * @param query Partial object to use to look up tokens. Ideally should be partial of adal.TokenResponse
	 * @returns Promise to return the matching adal.TokenResponse objects.
	 *     Rejected if an error was sent in the callback
	 */
	public findThenable(query: any): Thenable<any[]> {
		let self = this;

		return new Promise<any[]>((resolve, reject) => {
			self.find(query, (error: Error, results: any[]) => {
				if (error) {
					reject(error);
				} else {
					resolve(results);
				}
			});
		});
	}

	public remove(entries: adal.TokenResponse[], callback: (error: Error, result: null) => void): void {
		let self = this;

		this.doOperation(() => {
			return this.readCache()
				.then(cache => self.removeFromCache(cache, entries))
				.then(updatedCache => self.writeCache(updatedCache))
				.then(
					() => callback(null, null),
					(err) => callback(err, null)
				);
		});
	}

	/**
	 * Wrapper to make callback-based remove method into a thenable method
	 * @param entries Array of entries to remove from the token cache
	 * @returns Promise to remove the given tokens from the token cache
	 *     Rejected if an error was sent in the callback
	 */
	public removeThenable(entries: adal.TokenResponse[]): Thenable<void> {
		let self = this;

		return new Promise<void>((resolve, reject) => {
			self.remove(entries, (error: Error, result: null) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	// PRIVATE METHODS /////////////////////////////////////////////////////
	private static findByKeyHelper(entry1: adal.TokenResponse, entry2: adal.TokenResponse): boolean {
		return entry1._authority === entry2._authority
			&& entry1._clientId === entry2._clientId
			&& entry1.userId === entry2.userId
			&& entry1.resource === entry2.resource;
	}

	private static findByPartial(entry: adal.TokenResponse, query: { [key: string]: any }): boolean {
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

	private addToCache(cache: adal.TokenResponse[], entries: adal.TokenResponse[]): adal.TokenResponse[] {
		// First remove entries from the db that are being updated
		cache = this.removeFromCache(cache, entries);

		// Then add the new entries to the cache
		entries.forEach((entry: adal.TokenResponse) => {
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
								key: Buffer.from(splitValues[0], 'hex'),
								initializationVector: Buffer.from(splitValues[1], 'hex')
							};
						} catch (e) {
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
						return <EncryptionParams>{
							key: encryptKey,
							initializationVector: initializationVector
						};
					});
			});
	}

	private async readCache(): Promise<adal.TokenResponse[]> {
		let self = this;

		// NOTE: File system operations are performed synchronously to avoid annoying nested callbacks
		// 1) Get the encryption key
		// 2) Read the encrypted token cache file
		// 3) Decrypt the file contents
		// 4) Deserialize and return
		return this.getOrCreateEncryptionParams()
			.then(async encryptionParams => {
				try {
					return self.decryptCache('utf8', encryptionParams);
				} catch (e) {
					try {
						// try to parse using 'binary' encoding and rewrite cache as UTF8
						let response = await self.decryptCache('binary', encryptionParams);
						self.writeCache(response);
						return response;
					} catch (e) {
						throw e;
					}
				}
			})
			.then(null, err => {
				// If reading the token cache fails, we'll just assume the tokens are garbage
				console.warn(`Failed to read token cache: ${err}`);
				return [];
			});
	}

	private async decryptCache(encoding: crypto.Utf8AsciiBinaryEncoding, encryptionParams: EncryptionParams): Promise<adal.TokenResponse[]> {
		let cacheCipher = await fs.readFile(this._cacheSerializationPath, TokenCache.FsOptions);
		let decipher = crypto.createDecipheriv(TokenCache.CipherAlgorithm, encryptionParams.key, encryptionParams.initializationVector);
		let cacheJson = decipher.update(cacheCipher.toString(), 'hex', encoding);
		cacheJson += decipher.final(encoding);

		// Deserialize the JSON into the array of tokens
		let cacheObj = <adal.TokenResponse[]>JSON.parse(cacheJson);
		for (const obj of cacheObj) {
			// Rehydrate Date objects since they will always serialize as a string
			obj.expiresOn = new Date(<string>obj.expiresOn);
		}

		return cacheObj;
	}

	private removeFromCache(cache: adal.TokenResponse[], entries: adal.TokenResponse[]): adal.TokenResponse[] {
		entries.forEach((entry: adal.TokenResponse) => {
			// Check to see if the entry exists
			let match = cache.findIndex(entry2 => TokenCache.findByKeyHelper(entry, entry2));
			if (match >= 0) {
				// Entry exists, remove it from cache
				cache.splice(match, 1);
			}
		});

		return cache;
	}

	private writeCache(cache: adal.TokenResponse[]): Thenable<void> {
		let self = this;
		// NOTE: File system operations are being done synchronously to avoid annoying callback nesting
		// 1) Get (or generate) the encryption key
		// 2) Stringify the token cache entries
		// 4) Encrypt the JSON
		// 3) Write to the file
		return this.getOrCreateEncryptionParams()
			.then(async encryptionParams => {
				try {
					let cacheJson = JSON.stringify(cache);

					let cipher = crypto.createCipheriv(TokenCache.CipherAlgorithm, encryptionParams.key, encryptionParams.initializationVector);
					let cacheCipher = cipher.update(cacheJson, 'utf8', 'hex');
					cacheCipher += cipher.final('hex');

					await fs.writeFile(self._cacheSerializationPath, cacheCipher, TokenCache.FsOptions);
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
