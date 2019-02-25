/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';

export interface ISplice<T> {
	readonly start: number;
	readonly deleteCount: number;
	readonly toInsert: T[];
}

export interface ISpliceable<T> {
	splice(start: number, deleteCount: number, toInsert: T[]): void;
}

export interface ISequence<T> {
	readonly elements: T[];
	readonly onDidSplice: Event<ISplice<T>>;
}

export class Sequence<T> implements ISequence<T>, ISpliceable<T> {

	readonly elements: T[] = [];

	private _onDidSplice = new Emitter<ISplice<T>>();
	readonly onDidSplice: Event<ISplice<T>> = this._onDidSplice.event;

	splice(start: number, deleteCount: number, toInsert: T[] = []): void {
		this.elements.splice(start, deleteCount, ...toInsert);
		this._onDidSplice.fire({ start, deleteCount, toInsert });
	}
}