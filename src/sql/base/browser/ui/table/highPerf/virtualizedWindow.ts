/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancelablePromise, createCancelablePromise } from 'vs/base/common/async';

class DataWindow<T> {
	private _data: T[] | undefined;
	private _length: number = 0;
	private _offsetFromDataSource: number = -1;

	private dataReady?: CancelablePromise<void>;

	constructor(
		private loadFunction: (offset: number, count: number) => Promise<T[]>
	) { }

	dispose() {
		this._data = undefined;
		if (this.dataReady) {
			this.dataReady.cancel();
		}
	}

	get start(): number {
		return this._offsetFromDataSource;
	}

	get end(): number {
		return this._offsetFromDataSource + this._length;
	}

	get length(): number {
		return this._length;
	}

	public contains(dataSourceIndex: number): boolean {
		return dataSourceIndex >= this.start && dataSourceIndex < this.end;
	}

	public getItem(index: number): Promise<T> {
		return this.dataReady!.then(() => this._data![index - this._offsetFromDataSource]);
	}

	public positionWindow(offset: number, length: number): void {
		this._offsetFromDataSource = offset;
		this._length = length;
		this._data = undefined;

		if (this.dataReady) {
			this.dataReady.cancel();
		}

		if (length === 0) {
			return;
		}

		this.dataReady = createCancelablePromise(token => {
			return this.loadFunction(offset, length).then(data => {
				if (!token.isCancellationRequested) {
					this._data = data;
				}
			});
		});
	}
}

export class VirtualizedWindow<T> {
	private _bufferWindowBefore: DataWindow<T>;
	private _window: DataWindow<T>;
	private _bufferWindowAfter: DataWindow<T>;

	constructor(
		private readonly windowSize: number,
		private _length: number,
		loadFn: (offset: number, count: number) => Promise<T[]>
	) {

		this._bufferWindowBefore = new DataWindow(loadFn);
		this._window = new DataWindow(loadFn);
		this._bufferWindowAfter = new DataWindow(loadFn);
	}

	dispose() {
		this._bufferWindowAfter.dispose();
		this._bufferWindowBefore.dispose();
		this._window.dispose();
	}

	get length(): number {
		return this._length;
	}

	set length(length: number) {
		if (this.length !== length) {
			const oldLength = this.length;
			this._length = length;
			if (this._window.length !== this.windowSize) {
				this.resetWindowsAroundIndex(oldLength);
			} else if (this._bufferWindowAfter.length !== this.windowSize) {
				this._bufferWindowAfter.positionWindow(this._bufferWindowAfter.start, Math.min(this._bufferWindowAfter.start + this.windowSize, this.length));
			}
		}
	}

	public getIndex(index: number): Promise<T> {

		if (index < this._bufferWindowBefore.start || index >= this._bufferWindowAfter.end) {
			this.resetWindowsAroundIndex(index);
		}
		// scrolling up
		else if (this._bufferWindowBefore.contains(index)) {
			const beforeWindow = this._bufferWindowAfter;
			this._bufferWindowAfter = this._window;
			this._window = this._bufferWindowBefore;
			this._bufferWindowBefore = beforeWindow;
			// ensure we aren't buffer invalid data
			const beforeStart = Math.max(0, this._window.start - this.windowSize);
			// ensure if we got hinder in our start index that we update out length to not overlap
			const beforeLength = this._window.start - beforeStart;
			this._bufferWindowBefore.positionWindow(beforeStart, beforeLength);
		}
		// scroll down
		else if (this._bufferWindowAfter.contains(index)) {
			const afterWindow = this._bufferWindowBefore;
			this._bufferWindowBefore = this._window;
			this._window = this._bufferWindowAfter;
			this._bufferWindowAfter = afterWindow;
			// ensure we aren't buffer invalid data
			const afterStart = this._window.end;
			// ensure if we got hinder in our start index that we update out length to not overlap
			const afterLength = afterStart + this.windowSize > this.length ? this.length - afterStart : this.windowSize;
			this._bufferWindowAfter.positionWindow(afterStart, afterLength);
		}

		// at this point we know the current window will have the index
		return this._window.getItem(index);
	}

	private resetWindowsAroundIndex(index: number): void {

		let bufferWindowBeforeStart = Math.max(0, index - this.windowSize * 1.5);
		let bufferWindowBeforeEnd = Math.max(0, index - this.windowSize / 2);
		this._bufferWindowBefore.positionWindow(bufferWindowBeforeStart, bufferWindowBeforeEnd - bufferWindowBeforeStart);

		let mainWindowStart = bufferWindowBeforeEnd;
		let mainWindowEnd = Math.min(mainWindowStart + this.windowSize, this.length);
		this._window.positionWindow(mainWindowStart, mainWindowEnd - mainWindowStart);

		let bufferWindowAfterStart = mainWindowEnd;
		let bufferWindowAfterEnd = Math.min(bufferWindowAfterStart + this.windowSize, this.length);
		this._bufferWindowAfter.positionWindow(bufferWindowAfterStart, bufferWindowAfterEnd - bufferWindowAfterStart);
	}
}
