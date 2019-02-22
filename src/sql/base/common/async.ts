/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ITask, createCancelablePromise, CancelablePromise } from 'vs/base/common/async';
import { Promise, TPromise, ValueCallback } from 'vs/base/common/winjs.base';

/**
 * Bases on vscode Delayer, however, it works by only running the task if it gets
 * a specified number of requests in a specified time
 *
 * Ex. Useful encapsulation of handling double click from click listeners
 */
export class MultipleRequestDelayer<T> {

	private timeout: NodeJS.Timer;
	private completionPromise: CancelablePromise<any>;
	private onSuccess: ValueCallback;
	private requests: number = 0;
	private task: ITask<T>;

	constructor(public delay: number, private maxRequests: number = 2) {
		this.timeout = null;
		this.completionPromise = null;
		this.onSuccess = null;
	}

	trigger(task: ITask<T>): TPromise<T> {
		this.cancelTimeout();
		this.task = task;

		if (++this.requests > this.maxRequests - 1) {
			this.requests = 0;
			this.onSuccess(null);
			return this.completionPromise;
		}

		if (!this.completionPromise) {
			this.completionPromise = createCancelablePromise<T>(() => new Promise(resolve => this.onSuccess = resolve).then(() => {
				this.completionPromise = null;
				this.onSuccess = null;
				const task = this.task;
				this.task = null;

				return task();
			}));
		}

		this.timeout = setTimeout(() => {
			this.timeout = null;
			this.requests = 0;
		}, this.delay);

		return this.completionPromise;
	}

	isTriggered(): boolean {
		return this.timeout !== null;
	}

	cancel(): void {
		this.cancelTimeout();

		if (this.completionPromise) {
			this.completionPromise.cancel();
			this.completionPromise = null;
		}
	}

	private cancelTimeout(): void {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}
}