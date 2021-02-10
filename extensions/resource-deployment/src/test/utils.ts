/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class Deferred<T> {
	promise: Promise<T> = new Promise<T>((resolve, reject) => {
		this.resolve = <any>resolve;
		this.reject = reject;
	});;
	resolve!: (value?: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;
}
