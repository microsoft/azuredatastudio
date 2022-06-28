/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as events from 'events';
import * as cp from 'promisify-child-process';
import { Readable } from 'stream';

export class TestChildProcessPromise<T> implements cp.ChildProcessPromise {
	private _promise: Promise<T>;
	private _event: events.EventEmitter = new events.EventEmitter();
	readonly exitCode: number | null = null;
	readonly signalCode: NodeJS.Signals | null = null;
	readonly spawnargs: string[] = [];
	readonly spawnfile: string = '';

	constructor() {
		this._promise = new Promise<T>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}
	resolve!: (value: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;


	then<TResult1 = T, TResult2 = never>(onFulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
		return this._promise.then(onFulfilled, onRejected);
	}

	catch<TResult = never>(onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<T | TResult | any> {
		return this._promise.catch(onRejected);
	}
	[Symbol.toStringTag]: string = '';
	finally(onFinally?: (() => void) | null): Promise<T | any> {
		return this._promise.finally(onFinally);
	}
	stdin: any = this._event;
	stdout: Readable | null = <Readable>this._event;
	stderr: Readable | null = <Readable>this._event;
	channel?: any;
	stdio: [any, Readable | null, Readable | null, any, any] = [this.stdin, this.stdout, this.stderr, undefined, undefined];
	killed: boolean = false;
	pid: number = -1;
	connected: boolean = false;
	kill(signal?: NodeJS.Signals | number): boolean {
		throw new Error('Method not implemented.');
	}

	send(message: any, callback?: (error: Error | null) => void): boolean;
	send(message: any, sendHandle?: any, callback?: (error: Error | null) => void): boolean;
	send(message: any, sendHandle?: any, options?: any, callback?: (error: Error | null) => void): boolean;
	send(message: any, sendHandle?: any, options?: any, callback?: any): boolean {
		throw new Error('Method not implemented.');
	}
	disconnect(): void {
		throw new Error('Method not implemented.');
	}
	unref(): void {
		throw new Error('Method not implemented.');
	}
	ref(): void {
		throw new Error('Method not implemented.');
	}
	addListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	on(event: string | symbol, listener: (...args: any[]) => void): this {
		this._event.on(event, listener);
		return this;
	}
	once(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	off(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	removeAllListeners(event?: string | symbol): this {
		throw new Error('Method not implemented.');
	}
	setMaxListeners(n: number): this {
		throw new Error('Method not implemented.');
	}
	getMaxListeners(): number {
		throw new Error('Method not implemented.');
	}
	listeners(event: string | symbol): Function[] {
		throw new Error('Method not implemented.');
	}
	rawListeners(event: string | symbol): Function[] {
		throw new Error('Method not implemented.');
	}
	emit(event: string | symbol, ...args: any[]): boolean {
		return this._event.emit(event, args);
	}
	eventNames(): (string | symbol)[] {
		throw new Error('Method not implemented.');
	}
	listenerCount(type: string | symbol): number {
		throw new Error('Method not implemented.');
	}
}
