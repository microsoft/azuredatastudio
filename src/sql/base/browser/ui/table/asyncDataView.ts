/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposableDataProvider } from 'sql/base/common/dataProvider';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

export interface IObservableCollection<T> {
	getLength(): number;
	at(index: number): T;
	getRange(start: number, end: number): T[];
	setCollectionChangedCallback(callback: (startIndex: number, count: number) => void): void;
	setLength(length: number): void;
	dispose(): void;
}

export interface ISlickColumn<T> extends Slick.Column<T> {
	isEditable?: boolean;
}

class DataWindow<T> {
	private _data: T[] | undefined;
	private _length: number = 0;
	private _offsetFromDataSource: number = -1;

	private cancellationToken = new CancellationTokenSource();

	constructor(
		private loadFunction: (offset: number, count: number) => Thenable<T[]>,
		private placeholderItemGenerator: (index: number) => T,
		private loadCompleteCallback: (start: number, end: number) => void
	) { }

	dispose() {
		this._data = undefined;
		this.cancellationToken.cancel();
	}

	public getStartIndex(): number {
		return this._offsetFromDataSource;
	}

	public getEndIndex(): number {
		return this._offsetFromDataSource + this._length;
	}

	public contains(dataSourceIndex: number): boolean {
		return dataSourceIndex >= this.getStartIndex() && dataSourceIndex < this.getEndIndex();
	}

	public getItem(index: number): T {
		if (!this._data) {
			return this.placeholderItemGenerator(index);
		}
		return this._data[index - this._offsetFromDataSource];
	}

	public positionWindow(offset: number, length: number): void {
		this._offsetFromDataSource = offset;
		this._length = length;
		this._data = undefined;

		this.cancellationToken.cancel();
		this.cancellationToken = new CancellationTokenSource();
		const currentCancellation = this.cancellationToken;

		if (length === 0) {
			return;
		}

		this.loadFunction(offset, length).then(data => {
			if (!currentCancellation.token.isCancellationRequested) {
				this._data = data;
				this.loadCompleteCallback(this._offsetFromDataSource, this._offsetFromDataSource + this._length);
			}
		});
	}
}

export class VirtualizedCollection<T extends Slick.SlickData> extends Disposable implements IObservableCollection<T> {
	private _bufferWindowBefore: DataWindow<T>;
	private _window: DataWindow<T>;
	private _bufferWindowAfter: DataWindow<T>;
	private _lengthChanged = false;

	private collectionChangedCallback?: (startIndex: number, count: number) => void;

	constructor(
		private readonly windowSize: number,
		private placeHolderGenerator: (index: number) => T,
		private length: number,
		loadFn: (offset: number, count: number) => Thenable<T[]>
	) {
		super();
		let loadCompleteCallback = (start: number, end: number) => {
			if (this.collectionChangedCallback) {
				this.collectionChangedCallback(start, end - start);
			}
		};

		this._bufferWindowBefore = this._register(new DataWindow(loadFn, placeHolderGenerator, loadCompleteCallback));
		this._window = this._register(new DataWindow(loadFn, placeHolderGenerator, loadCompleteCallback));
		this._bufferWindowAfter = this._register(new DataWindow(loadFn, placeHolderGenerator, loadCompleteCallback));
	}

	public setCollectionChangedCallback(callback: (startIndex: number, count: number) => void): void {
		this.collectionChangedCallback = callback;
	}

	public getLength(): number {
		return this.length;
	}

	setLength(length: number): void {
		if (this.length !== length) {
			this._lengthChanged = true;
			this.length = length;
		}
	}

	public at(index: number): T {
		return this.getRange(index, index + 1)[0];
	}

	public getRange(start: number, end: number): T[] {

		// current data may contain placeholders
		let currentData = this.getRangeFromCurrent(start, end);

		// only shift window and make promise of refreshed data in following condition:
		if (this._lengthChanged || start < this._bufferWindowBefore.getStartIndex() || end > this._bufferWindowAfter.getEndIndex()) {
			// jump, reset
			this._lengthChanged = false;
			this.resetWindowsAroundIndex(start);
		} else if (end <= this._bufferWindowBefore.getEndIndex()) {
			// scroll up, shift up
			let windowToRecycle = this._bufferWindowAfter;
			this._bufferWindowAfter = this._window;
			this._window = this._bufferWindowBefore;
			this._bufferWindowBefore = windowToRecycle;
			let newWindowOffset = Math.max(0, this._window.getStartIndex() - this.windowSize);

			this._bufferWindowBefore.positionWindow(newWindowOffset, this._window.getStartIndex() - newWindowOffset);
		} else if (start >= this._bufferWindowAfter.getStartIndex()) {
			// scroll down, shift down
			let windowToRecycle = this._bufferWindowBefore;
			this._bufferWindowBefore = this._window;
			this._window = this._bufferWindowAfter;
			this._bufferWindowAfter = windowToRecycle;
			let newWindowOffset = Math.min(this._window.getStartIndex() + this.windowSize, this.length);
			let newWindowLength = Math.min(this.length - newWindowOffset, this.windowSize);

			this._bufferWindowAfter.positionWindow(newWindowOffset, newWindowLength);
		}

		return currentData;
	}

	private getRangeFromCurrent(start: number, end: number): T[] {
		const currentData: Array<T> = [];
		for (let i = 0; i < end - start; i++) {
			currentData.push(this.getDataFromCurrent(start + i));
		}

		return currentData;
	}

	private getDataFromCurrent(index: number): T {
		if (this._bufferWindowBefore.contains(index)) {
			return this._bufferWindowBefore.getItem(index);
		} else if (this._bufferWindowAfter.contains(index)) {
			return this._bufferWindowAfter.getItem(index);
		} else if (this._window.contains(index)) {
			return this._window.getItem(index);
		}

		return this.placeHolderGenerator(index);
	}

	public resetWindowsAroundIndex(index: number): void {

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

export class AsyncDataProvider<T extends Slick.SlickData> extends Disposable implements IDisposableDataProvider<T> {

	private _onFilterStateChange = this._register(new Emitter<void>());
	get onFilterStateChange(): Event<void> { return this._onFilterStateChange.event; }

	private _onSortComplete = this._register(new Emitter<Slick.OnSortEventArgs<T>>());
	get onSortComplete(): Event<Slick.OnSortEventArgs<T>> { return this._onSortComplete.event; }

	constructor(public dataRows: IObservableCollection<T>) {
		super();
		this._register(dataRows);
	}

	public get isDataInMemory(): boolean {
		return false;
	}

	getRangeAsync(startIndex: number, length: number): Promise<T[]> {
		throw new Error('Method not implemented.');
	}

	getColumnValues(column: Slick.Column<T>): Promise<string[]> {
		throw new Error('Method not implemented.');
	}

	sort(options: Slick.OnSortEventArgs<T>): Promise<void> {
		throw new Error('Method not implemented.');
	}

	filter(columns?: Slick.Column<T>[]): Promise<void> {
		throw new Error('Method not implemented.');
	}

	public getLength(): number {
		return this.dataRows.getLength();
	}

	public getItem(index: number): T {
		return this.dataRows.at(index);
	}

	public getRange(start: number, end: number): T[] {
		return this.dataRows.getRange(start, end);
	}

	public set length(length: number) {
		this.dataRows.setLength(length);
	}

	public get length(): number {
		return this.dataRows.getLength();
	}

	getItems(): T[] {
		throw new Error('Method not supported.');
	}
}
