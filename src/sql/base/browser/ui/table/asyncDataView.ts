/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IObservableCollection<T> {
    getLength(): number;
    at(index: number): T;
    getRange(start: number, end: number): T[];
    setCollectionChangedCallback(callback: (change: CollectionChange, startIndex: number, count: number) => void): void;
}

export interface IGridDataRow {
    row?: number;
    values: any[];
}

export enum CollectionChange {
    ItemsReplaced
}

class LoadCancellationToken {
    isCancelled: boolean;
}

class DataWindow<TData> {
    private _dataSourceLength: number;
    private _data: TData[];
    private _length: number = 0;
    private _offsetFromDataSource: number = -1;

    private loadFunction: (offset: number, count: number) => Thenable<TData[]>;
    private lastLoadCancellationToken: LoadCancellationToken;
    private loadCompleteCallback: (start: number, end: number) => void;
    private placeholderItemGenerator: (index: number) => TData;

    constructor(dataSourceLength: number,
                loadFunction: (offset: number, count: number) => Thenable<TData[]>,
                placeholderItemGenerator: (index: number) => TData,
                loadCompleteCallback: (start: number, end: number) => void) {
        this._dataSourceLength = dataSourceLength;
        this.loadFunction = loadFunction;
        this.placeholderItemGenerator = placeholderItemGenerator;
        this.loadCompleteCallback = loadCompleteCallback;
    }

    getStartIndex(): number {
        return this._offsetFromDataSource;
    }

    getEndIndex(): number {
        return this._offsetFromDataSource + this._length;
    }

    contains(dataSourceIndex: number): boolean {
        return dataSourceIndex >= this.getStartIndex() && dataSourceIndex < this.getEndIndex();
    }

    getItem(index: number): TData {
        if (!this._data) {
            return this.placeholderItemGenerator(index);
        }
        return this._data[index - this._offsetFromDataSource];
    }

    positionWindow(offset: number, length: number): void {
        this._offsetFromDataSource = offset;
        this._length = length;
        this._data = undefined;

        if (this.lastLoadCancellationToken) {
            this.lastLoadCancellationToken.isCancelled = true;
        }

        if (length === 0) {
            return;
        }

        let cancellationToken = new LoadCancellationToken();
        this.lastLoadCancellationToken = cancellationToken;
        this.loadFunction(offset, length).then(data => {
            if (!cancellationToken.isCancelled) {
                this._data = data;
                this.loadCompleteCallback(this._offsetFromDataSource, this._offsetFromDataSource + this._length);
            }
        });
    }
}

export class VirtualizedCollection<TData> implements IObservableCollection<TData> {

    private _length: number;
    private _windowSize: number;
    private _bufferWindowBefore: DataWindow<TData>;
    private _window: DataWindow<TData>;
    private _bufferWindowAfter: DataWindow<TData>;

    private collectionChangedCallback: (change: CollectionChange, startIndex: number, count: number) => void;

    constructor(windowSize: number,
                length: number,
                loadFn: (offset: number, count: number) => Thenable<TData[]>,
                private _placeHolderGenerator: (index: number) => TData) {
        this._windowSize = windowSize;
        this._length = length;

        let loadCompleteCallback = (start: number, end: number) => {
            if (this.collectionChangedCallback) {
                this.collectionChangedCallback(CollectionChange.ItemsReplaced, start, end - start);
            }
        };

        this._bufferWindowBefore = new DataWindow(length, loadFn, _placeHolderGenerator, loadCompleteCallback);
        this._window = new DataWindow(length, loadFn, _placeHolderGenerator, loadCompleteCallback);
        this._bufferWindowAfter = new DataWindow(length, loadFn, _placeHolderGenerator, loadCompleteCallback);
    }

    setCollectionChangedCallback(callback: (change: CollectionChange, startIndex: number, count: number) => void): void {
        this.collectionChangedCallback = callback;
    }

    getLength(): number {
        return this._length;
    }

    at(index: number): TData {
        return this.getRange(index, index + 1)[0];
    }

    getRange(start: number, end: number): TData[] {

        // current data may contain placeholders
        let currentData = this.getRangeFromCurrent(start, end);

        // only shift window and make promise of refreshed data in following condition:
        if (start < this._bufferWindowBefore.getStartIndex() || end > this._bufferWindowAfter.getEndIndex()) {
            // jump, reset
            this.resetWindowsAroundIndex(start);
        } else if (end <= this._bufferWindowBefore.getEndIndex()) {
            // scroll up, shift up
            let windowToRecycle = this._bufferWindowAfter;
            this._bufferWindowAfter = this._window;
            this._window = this._bufferWindowBefore;
            this._bufferWindowBefore = windowToRecycle;
            let newWindowOffset = Math.max(0, this._window.getStartIndex() - this._windowSize);

            this._bufferWindowBefore.positionWindow(newWindowOffset, this._window.getStartIndex() - newWindowOffset);
        } else if (start >= this._bufferWindowAfter.getStartIndex()) {
            // scroll down, shift down
            let windowToRecycle = this._bufferWindowBefore;
            this._bufferWindowBefore = this._window;
            this._window = this._bufferWindowAfter;
            this._bufferWindowAfter = windowToRecycle;
            let newWindowOffset = Math.min(this._window.getStartIndex() + this._windowSize, this._length);
            let newWindowLength = Math.min(this._length - newWindowOffset, this._windowSize);

            this._bufferWindowAfter.positionWindow(newWindowOffset, newWindowLength);
        }

        return currentData;
    }

    private getRangeFromCurrent(start: number, end: number): TData[] {
        let currentData = [];
        for (let i = 0; i < end - start; i++) {
            currentData.push(this.getDataFromCurrent(start + i));
        }

        return currentData;
    }

    private getDataFromCurrent(index: number): TData {
        if (this._bufferWindowBefore.contains(index)) {
            return this._bufferWindowBefore.getItem(index);
        } else if (this._bufferWindowAfter.contains(index)) {
            return this._bufferWindowAfter.getItem(index);
        } else if (this._window.contains(index)) {
            return this._window.getItem(index);
        }

        return this._placeHolderGenerator(index);
    }

    private resetWindowsAroundIndex(index: number): void {

        let bufferWindowBeforeStart = Math.max(0, index - this._windowSize * 1.5);
        let bufferWindowBeforeEnd = Math.max(0, index - this._windowSize / 2);
        this._bufferWindowBefore.positionWindow(bufferWindowBeforeStart, bufferWindowBeforeEnd - bufferWindowBeforeStart);

        let mainWindowStart = bufferWindowBeforeEnd;
        let mainWindowEnd = Math.min(mainWindowStart + this._windowSize, this._length);
        this._window.positionWindow(mainWindowStart, mainWindowEnd - mainWindowStart);

        let bufferWindowAfterStart = mainWindowEnd;
        let bufferWindowAfterEnd = Math.min(bufferWindowAfterStart + this._windowSize, this._length);
        this._bufferWindowAfter.positionWindow(bufferWindowAfterStart, bufferWindowAfterEnd - bufferWindowAfterStart);
    }
}

export class AsyncDataProvider<TData extends IGridDataRow> implements Slick.DataProvider<TData> {

	constructor(public dataRows: IObservableCollection<TData>, public columns: Slick.Column<TData>[]) { }

	public getLength(): number {
		return this.dataRows && this.columns ? this.dataRows.getLength() : 0;
	}

	public getItem(index: number): TData {
		return this.getDataWithSchema(this.dataRows.at(index));
	}

	public getRange(start: number, end: number): TData[] {
		return !this.dataRows ? undefined : this.dataRows.getRange(start, end).map(i => {
			return this.getDataWithSchema(i);
		});
	}

    private getDataWithSchema(data: TData): any {
        let dataWithSchema = {};
        for (let i = 0; i < this.columns.length; i++) {
            dataWithSchema[this.columns[i].field] = data.values[i];
        }

        return dataWithSchema;
    }

}
