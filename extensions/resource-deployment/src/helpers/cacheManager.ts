/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deferred } from './promise';

const enum Status {
	notStarted,
	inProgress,
	done
}

interface State<T> {
	entry?: T,
	error?: Error,
	status: Status,
	id: number,
	pendingOperation: Deferred<void>
}

/**
 * An implementation of Cache Manager which ensure that only one call to populate cache miss is pending at a given time.
 * All remaining calls for retrieval are await until the one in progress finishes and then they are resolved with the value
 * from the cache.
 */
export class CacheManager<K, T> {
	private _cache = new Map<K, State<T>>();
	private _id = 0;

	public async getCacheEntry(key: K, retrieveEntry: (key: K) => Promise<T>): Promise<T> {
		const cacheHit: State<T> | undefined = this._cache.get(key);
		// each branch either throws or returns the password.
		if (cacheHit === undefined) {
			// populate a new state entry and add it to the cache
			const state: State<T> = {
				status: Status.notStarted,
				id: this._id++,
				pendingOperation: new Deferred<void>()
			};
			this._cache.set(key, state);
			// now that we have the state entry initialized, retry in a different scheduling batch
			let returnValue: T;
			setTimeout(async () => {
				returnValue = await this.getCacheEntry(key, retrieveEntry);
			}, 0);
			return returnValue!;

		} else {
			switch (cacheHit.status) {
				case Status.notStarted: {
					cacheHit.status = Status.inProgress;
					// retrieve and populate the missed cache hit in a different scheduling batch.
					setTimeout(async () => {
						try {
							cacheHit.entry = await retrieveEntry(key);
							cacheHit.status = Status.done;
							cacheHit.pendingOperation.resolve();
						} catch (error) {
							cacheHit.error = error;
							cacheHit.pendingOperation.reject(error);
							cacheHit.status = Status.done;
						}
					}, 0);
					return await this.getCacheEntry(key, retrieveEntry);
				}

				case Status.inProgress: {
					await cacheHit.pendingOperation;
					return await this.getCacheEntry(key, retrieveEntry);
				}

				case Status.done: {
					if (cacheHit.error !== undefined) {
						throw cacheHit.error;
					}
					else {
						return cacheHit.entry!;
					}
				}
			}
		}
	}
}
