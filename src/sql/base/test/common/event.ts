/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';

export class EventVerifierSingle<T> {
	private _eventArgument?: T;
	private _eventFired: boolean;

	constructor() {
		this._eventFired = false;
	}

	public get eventArgument(): T | undefined {
		return this._eventArgument;
	}

	public get eventFired(): boolean {
		return this._eventFired;
	}

	public assertFired(expectedArgument?: T) {
		assert.ok(this._eventFired);
		if (expectedArgument) {
			assert.equal(this._eventArgument, expectedArgument);
		}
	}

	public assertFiredWithVerify(argumentVerification: (arg: T | undefined) => void) {
		assert.ok(this._eventFired);
		argumentVerification(this._eventArgument);
	}

	public assertNotFired() {
		assert.equal(this._eventFired, false);
	}

	public get eventHandler(): (arg: T) => void {
		let self = this;
		return (arg: T) => {
			self._eventArgument = arg;
			self._eventFired = true;
		};
	}
}

export class EventVerifierMultiple<T> {
	private _eventArguments: T[];

	constructor() {
		this._eventArguments = [];
	}

	public get eventArguments(): T[] {
		return this._eventArguments;
	}

	public get eventFired(): boolean {
		return this._eventArguments.length > 0;
	}

	public assertFired(expectedArgument?: T) {
		assert.ok(this.eventFired);
		if (expectedArgument) {
			assert.ok(this._eventArguments.some(x => x === expectedArgument));
		}
	}

	public assertNotFired(expectedArgument?: T) {
		if (expectedArgument) {
			assert.ok(!this._eventArguments.some(x => x === expectedArgument));
		} else {
			assert.ok(!this.eventFired);
		}
	}

	public eventHandler(): (arg: T) => void {
		let self = this;
		return (arg: T) => {
			self._eventArguments.push(arg);
		};
	}
}
