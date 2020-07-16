/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Deferred promise
 */
export class Deferred<T> implements Promise<T> {
	promise: Promise<T>;
	resolve!: (value?: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;
	constructor() {
		this.promise = new Promise<T>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}

	then<TResult1 = T, TResult2 = never>(onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>): Promise<TResult1 | TResult2>;
	then<U>(onFulfilled?: (value: T) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Promise<U>;
	then<U>(onFulfilled?: (value: T) => U | Thenable<U>, onRejected?: (error: any) => void): Promise<U>;
	then(onFulfilled?: any, onRejected?: any) {
		return this.promise.then(onFulfilled, onRejected);
	}

	catch<TResult = never>(onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<T | TResult>;
	catch<U>(onRejected?: (error: any) => U | Thenable<U>): Promise<U>;
	catch(onRejected?: any) {
		return this.promise.catch(onRejected);
	}

	finally(onfinally?: () => void): Promise<T> {
		return this.promise.finally(onfinally);
	}

	get [Symbol.toStringTag](): string {
		return this.promise[Symbol.toStringTag]; // symbol tag same as that of underlying promise object
	}
}
