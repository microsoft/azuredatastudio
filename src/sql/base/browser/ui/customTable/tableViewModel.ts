/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Row, Cell } from './tableModel';
import { INextIterator, ArrayIterator } from 'vs/base/common/iterator';

export interface IViewRow {
	model: Row;
	top: number;
	height: number;
}

export interface IViewCell {
	model: Cell;
	top: number;
	height: number;
}

export interface IViewColumn {
	model: Cell;
	left: number;
	width: number;
}

export abstract class HeightMap {
	private heightMap: IViewRow[];
	private indexes: { [item: string]: number; };

	constructor() {
		this.heightMap = [];
		this.indexes = {};
	}

	public getTotalHeight(): number {
		let last = this.heightMap[this.heightMap.length - 1];
		return !last ? 0 : last.top + last.height;
	}

	public onInsertRows(iterator: INextIterator<Row>, afterRowId: string = null): number {
		let row: Row;
		let viewRow: IViewRow;
		let i: number, j: number;
		let totalSize: number;
		let sizeDiff = 0;

		if (afterRowId === null) {
			i = 0;
			totalSize = 0;
		} else {
			i = this.indexes[afterRowId] + 1;
			viewRow = this.heightMap[i - 1];

			if (!viewRow) {
				console.error('view item doesnt exist');
				return undefined;
			}

			totalSize = viewRow.top + viewRow.height;
		}

		let boundSplice = this.heightMap.splice.bind(this.heightMap, i, 0);

		let rowsToInsert: IViewRow[] = [];

		while (row = iterator.next()) {
			viewRow = this.createViewRow(row);
			viewRow.top = totalSize + sizeDiff;

			this.indexes[row.id] = i++;
			rowsToInsert.push(viewRow);
			sizeDiff += viewRow.height;
		}

		boundSplice.apply(this.heightMap, rowsToInsert);

		for (j = i; j < this.heightMap.length; j++) {
			viewRow = this.heightMap[j];
			viewRow.top += sizeDiff;
			this.indexes[viewRow.model.id] = j;
		}

		for (j = rowsToInsert.length - 1; j >= 0; j--) {
			this.onInsertRow(rowsToInsert[j]);
		}

		for (j = this.heightMap.length - 1; j >= i; j--) {
			this.onRefreshRow(this.heightMap[j]);
		}

		return sizeDiff;
	}

	public indexAt(position: number): number {
		let left = 0;
		let right = this.heightMap.length;
		let center: number;
		let item: IViewRow;

		// Binary search
		while (left < right) {
			center = Math.floor((left + right) / 2);
			item = this.heightMap[center];

			if (position < item.top) {
				right = center;
			} else if (position >= item.top + item.height) {
				if (left === center) {
					break;
				}
				left = center;
			} else {
				return center;
			}
		}

		return this.heightMap.length;
	}

	public indexAfter(position: number): number {
		return Math.min(this.indexAt(position) + 1, this.heightMap.length);
	}

	public rowAtIndex(index: number): IViewRow {
		return this.heightMap[index];
	}

	public rowAfter(item: IViewRow): IViewRow {
		return this.heightMap[this.indexes[item.model.id] + 1] || null;
	}

	protected abstract createViewRow(item: Row): IViewRow;

	public abstract onRefreshRow(item: IViewRow, needsRender?: boolean): void;

	public abstract onInsertRow(item: IViewRow): void;
}
