/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import * as types from 'vs/base/common/types';
import { compare as stringCompare } from 'vs/base/common/strings';

import { IDisposableDataProvider } from 'sql/base/browser/ui/table/interfaces';

export interface IFindPosition {
	col: number;
	row: number;
}

function defaultSort<T extends { [key: string]: any }>(args: Slick.OnSortEventArgs<T>, data: Array<T>): Array<T> {
	if (!args.sortCol || !args.sortCol.field) {
		return data;
	}
	const field = args.sortCol.field;
	const sign = args.sortAsc ? 1 : -1;
	let comparer: (a: T, b: T) => number;
	if (types.isString(data[0][field])) {
		if (!isNaN(Number(data[0][field]))) {
			comparer = (a: T, b: T) => {
				let anum = Number(a[field]);
				let bnum = Number(b[field]);
				return anum === bnum ? 0 : anum > bnum ? 1 : -1;
			};
		} else {
			comparer = (a: T, b: T) => {
				return stringCompare(a[field], b[field]);
			};
		}
	} else {
		comparer = (a: T, b: T) => {
			return a[field] === b[field] ? 0 : (a[field] > b[field] ? 1 : -1);
		};
	}
	return data.sort((a, b) => comparer(a, b) * sign);
}

export class TableDataView<T extends Slick.SlickData> implements IDisposableDataProvider<T> {
	//The data exposed publicly, when filter is enabled, _data holds the filtered data.
	private _data: Array<T>;
	//Used when filtering is enabled, _allData holds the complete set of data.
	private _allData!: Array<T>;
	private _findArray?: Array<IFindPosition>;
	private _findIndex?: number;
	private _filterEnabled: boolean;

	private _onRowCountChange = new Emitter<number>();
	get onRowCountChange(): Event<number> { return this._onRowCountChange.event; }

	private _onFindCountChange = new Emitter<number>();
	get onFindCountChange(): Event<number> { return this._onFindCountChange.event; }

	private _onFilterStateChange = new Emitter<void>();
	get onFilterStateChange(): Event<void> { return this._onFilterStateChange.event; }

	private _filterFn: (data: Array<T>) => Array<T>;
	private _sortFn: (args: Slick.OnSortEventArgs<T>, data: Array<T>) => Array<T>;

	constructor(
		data?: Array<T>,
		private _findFn?: (val: T, exp: string) => Array<number>,
		_sortFn?: (args: Slick.OnSortEventArgs<T>, data: Array<T>) => Array<T>,
		_filterFn?: (data: Array<T>) => Array<T>
	) {
		if (data) {
			this._data = data;
		} else {
			this._data = new Array<T>();
		}

		// @todo @anthonydresser 5/1/19 theres a lot we could do by just accepting a regex as a exp rather than accepting a full find function
		this._sortFn = _sortFn ? _sortFn : defaultSort;

		this._filterFn = _filterFn ? _filterFn : (dataToFilter) => dataToFilter;
		this._filterEnabled = false;
	}

	public get filterEnabled(): boolean {
		return this._filterEnabled;
	}

	public filter() {
		if (!this.filterEnabled) {
			this._allData = new Array(...this._data);
			this._data = this._filterFn(this._allData);
			this._filterEnabled = true;
		}

		this._data = this._filterFn(this._allData);
		this._onFilterStateChange.fire();
	}

	public clearFilter() {
		if (this._filterEnabled) {
			this._data = this._allData;
			this._allData = [];
			this._filterEnabled = false;
			this._onFilterStateChange.fire();
		}
	}

	sort(args: Slick.OnSortEventArgs<T>) {
		this._data = this._sortFn(args, this._data);
	}

	getLength(): number {
		return this._data.length;
	}

	getItem(index: number): T {
		return this._data[index];
	}

	getItems(): T[] {
		return this._data.slice();
	}

	getLengthNonFiltered(): number {
		return this.filterEnabled ? this._allData.length : this._data.length;
	}

	push(items: Array<T>): void;
	push(item: T): void;
	push(input: T | Array<T>): void {
		let inputArray = new Array();
		if (Array.isArray(input)) {
			inputArray.push(...input);
		} else {
			inputArray.push(input);
		}

		if (this._filterEnabled) {
			this._allData.push(...inputArray);
			let filteredArray = this._filterFn(inputArray);
			if (filteredArray.length !== 0) {
				this._data.push(...filteredArray);
			}
		} else {
			this._data.push(...inputArray);
		}

		this._onRowCountChange.fire(this.getLength());
	}

	clear() {
		this._data = new Array<T>();
		if (this._filterEnabled) {
			this._allData = new Array<T>();
		}
		this._onRowCountChange.fire(this.getLength());
	}

	find(exp: string, maxMatches?: number): Promise<IFindPosition> {
		if (!this._findFn) {
			return Promise.reject(new Error('no find function provided'));
		}
		this._findArray = new Array<IFindPosition>();
		this._findIndex = 0;
		this._onFindCountChange.fire(this._findArray.length);
		if (exp) {
			return new Promise<IFindPosition>((resolve) => {
				const disp = this.onFindCountChange(e => {
					resolve(this._findArray![e - 1]);
					disp.dispose();
				});
				this._startSearch(exp, maxMatches);
			});
		} else {
			return Promise.reject(new Error('no expression'));
		}
	}

	private _startSearch(exp: string, maxMatches: number = 0): void {
		for (let i = 0; i < this._data.length; i++) {
			const item = this._data[i];
			const result = this._findFn!(item, exp);
			let breakout = false;
			if (result) {
				for (let j = 0; j < result.length; j++) {
					const pos = result[j];
					const index = { col: pos, row: i };
					this._findArray!.push(index);
					this._onFindCountChange.fire(this._findArray!.length);
					if (maxMatches > 0 && this._findArray!.length === maxMatches) {
						breakout = true;
						break;
					}
				}
			}

			if (breakout) {
				break;
			}
		}
	}

	clearFind() {
		this._findArray = new Array<IFindPosition>();
		this._findIndex = 0;
		this._onFindCountChange.fire(this._findArray.length);
	}

	findNext(): Thenable<IFindPosition> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === this._findArray.length - 1) {
				this._findIndex = 0;
			} else {
				++this._findIndex!;
			}
			return Promise.resolve(this._findArray[this._findIndex!]);
		} else {
			return Promise.reject(new Error('no search running'));
		}
	}

	findPrevious(): Thenable<IFindPosition> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === 0) {
				this._findIndex = this._findArray.length - 1;
			} else {
				--this._findIndex!;
			}
			return Promise.resolve(this._findArray[this._findIndex!]);
		} else {
			return Promise.reject(new Error('no search running'));
		}
	}

	get currentFindPosition(): Thenable<IFindPosition> {
		if (this._findArray && this._findArray.length !== 0) {
			return Promise.resolve(this._findArray[this._findIndex!]);
		} else {
			return Promise.reject(new Error('no search running'));
		}
	}

	/* 1 indexed */
	get findPosition(): number {
		return types.isUndefinedOrNull(this._findIndex) ? 0 : this._findIndex + 1;
	}

	get findCount(): number {
		return types.isUndefinedOrNull(this._findArray) ? 0 : this._findArray.length;
	}

	dispose() {
		this._data = [];
		this._allData = [];
		this._findArray = [];
	}
}
