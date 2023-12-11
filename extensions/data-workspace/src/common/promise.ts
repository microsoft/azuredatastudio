/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Deferred promise
 */
export class Deferred<T = void> {
	promise: Promise<T>;
	resolve!: (value: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;
	constructor() {
		this.promise = new Promise<T>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}

	then<TResult>(onFulfilled?: (value: T) => TResult | Thenable<TResult>, onRejected?: (reason: any) => TResult | Thenable<TResult>): Thenable<TResult>;
	then<TResult>(onFulfilled?: (value: T) => TResult | Thenable<TResult>, onRejected?: (reason: any) => void): Thenable<TResult>;
	then<TResult>(onFulfilled?: (value: T) => TResult | Thenable<TResult>, onRejected?: (reason: any) => TResult | Thenable<TResult>): Thenable<TResult> {
		return this.promise.then(onFulfilled, onRejected);
	}
}
