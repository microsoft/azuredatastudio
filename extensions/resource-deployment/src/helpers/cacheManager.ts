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
 * An implementation of Cache Manager which ensures that only one call to populate cache miss is pending at a given time.
 * All remaining calls for retrieval are awaited until the one in progress finishes and then all awaited calls are resolved with the value
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
			// now that we have the state entry initialized, retry to fetch the cacheEntry
			let returnValue: T = await this.getCacheEntry(key, retrieveEntry);
			await state.pendingOperation;
			return returnValue!;
		} else {
			switch (cacheHit.status) {
				case Status.notStarted: {
					cacheHit.status = Status.inProgress;
					// retrieve and populate the missed cache hit.
					try {
						cacheHit.entry = await retrieveEntry(key);
					} catch (error) {
						cacheHit.error = error;
					} finally {
						cacheHit.status = Status.done;
						// we do not reject here even in error case because we do not want our awaits on pendingOperation to throw
						// We track our own error state and when all done we throw if an error had happened. This results
						// in the rejection of the promised returned by this method.
						cacheHit.pendingOperation.resolve();
					}
					return await this.getCacheEntry(key, retrieveEntry);
				}

				case Status.inProgress: {
					await cacheHit.pendingOperation;
					return await this.getCacheEntry(key, retrieveEntry);
				}

				case Status.done: {
					if (cacheHit.error !== undefined) {
						await cacheHit.pendingOperation;
						throw cacheHit.error;
					}
					else {
						await cacheHit.pendingOperation;
						return cacheHit.entry!;
					}
				}
			}
		}
	}
}
