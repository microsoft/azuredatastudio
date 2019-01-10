/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';

import { Event, Emitter } from 'vs/base/common/event';
import { TPromise } from 'vs/base/common/winjs.base';
import * as types from 'vs/base/common/types';
import { compare as stringCompare } from 'vs/base/common/strings';

import { IDisposableDataProvider } from 'sql/base/browser/ui/table/interfaces';

export interface IFindPosition {
	col: number;
	row: number;
}

function defaultSort<T>(args: Slick.OnSortEventArgs<T>, data: Array<T>): Array<T> {
	let field = args.sortCol.field;
	let sign = args.sortAsc ? 1 : -1;
	let comparer: (a, b) => number;
	if (types.isString(data[0][field])) {
		if (Number(data[0][field]) !== NaN) {
			comparer = (a: number, b: number) => {
				let anum = Number(a[field]);
				let bnum = Number(b[field]);
				return anum === bnum ? 0 : anum > bnum ? 1 : -1;
			};
		} else {
			comparer = stringCompare;
		}
	} else {
		comparer = (a: number, b: number) => {
			return a[field] === b[field] ? 0 : (a[field] > b[field] ? 1 : -1);
		};
	}
	return data.sort((a, b) => comparer(a, b) * sign);
}

export class TableDataView<T extends Slick.SlickData> implements IDisposableDataProvider<T> {
	private _data: Array<T>;
	private _findArray: Array<IFindPosition>;
	private _findObs: Observable<IFindPosition>;
	private _findIndex: number;

	private _onRowCountChange = new Emitter<number>();
	get onRowCountChange(): Event<number> { return this._onRowCountChange.event; }

	private _onFindCountChange = new Emitter<number>();
	get onFindCountChange(): Event<number> { return this._onFindCountChange.event; }

	constructor(
		data?: Array<T>,
		private _findFn?: (val: T, exp: string) => Array<number>,
		private _sortFn?: (args: Slick.OnSortEventArgs<T>, data: Array<T>) => Array<T>
	) {
		if (data) {
			this._data = data;
		} else {
			this._data = new Array<T>();
		}

		if (!_sortFn) {
			this._sortFn = defaultSort;
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

	push(items: Array<T>);
	push(item: T);
	push(input: T | Array<T>) {
		if (Array.isArray(input)) {
			this._data.push(...input);
		} else {
			this._data.push(input);
		}
		this._onRowCountChange.fire();
	}

	clear() {
		this._data = new Array<T>();
		this._onRowCountChange.fire();
	}

	find(exp: string, maxMatches: number = 0): Thenable<IFindPosition> {
		if (!this._findFn) {
			return TPromise.wrapError(new Error('no find function provided'));
		}
		this._findArray = new Array<IFindPosition>();
		this._findIndex = 0;
		this._onFindCountChange.fire(this._findArray.length);
		if (exp) {
			this._findObs = Observable.create((observer: Observer<IFindPosition>) => {
				for (let i = 0; i < this._data.length; i++) {
					let item = this._data[i];
					let result = this._findFn(item, exp);
					if (result) {
						result.forEach(pos => {
							let index = { col: pos, row: i };
							this._findArray.push(index);
							observer.next(index);
							this._onFindCountChange.fire(this._findArray.length);
						});
						if (maxMatches > 0 && this._findArray.length > maxMatches) {
							break;
						}
					}
				}
			});
			return this._findObs.take(1).toPromise().then(() => {
				return this._findArray[this._findIndex];
			});
		} else {
			return TPromise.wrapError(new Error('no expression'));
		}
	}

	clearFind() {
		this._findArray = new Array<IFindPosition>();
		this._findIndex = 0;
		this._findObs = undefined;
		this._onFindCountChange.fire(this._findArray.length);
	}

	findNext(): Thenable<IFindPosition> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === this._findArray.length - 1) {
				this._findIndex = 0;
			} else {
				++this._findIndex;
			}
			return TPromise.as(this._findArray[this._findIndex]);
		} else {
			return TPromise.wrapError(new Error('no search running'));
		}
	}

	findPrevious(): Thenable<IFindPosition> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === 0) {
				this._findIndex = this._findArray.length - 1;
			} else {
				--this._findIndex;
			}
			return TPromise.as(this._findArray[this._findIndex]);
		} else {
			return TPromise.wrapError(new Error('no search running'));
		}
	}

	get currentFindPosition(): Thenable<IFindPosition> {
		if (this._findArray && this._findArray.length !== 0) {
			return TPromise.as(this._findArray[this._findIndex]);
		} else {
			return TPromise.wrapError(new Error('no search running'));
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
		this._data = undefined;
		this._findArray = undefined;
		this._findObs = undefined;
	}
}
