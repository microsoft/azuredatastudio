/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { Row, Cell } from './tableModel';

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

export class HeightMap {
	private heightMap: IViewRow[];
	private indexes: { [item: string]: number; };

	constructor() {
		this.heightMap = [];
		this.indexes = {};
	}

	public getTotalHeight(): number {
		var last = this.heightMap[this.heightMap.length - 1];
		return !last ? 0 : last.top + last.height;
	}

	public indexAt(position: number): number {
		var left = 0;
		var right = this.heightMap.length;
		var center: number;
		var item: IViewRow;

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

	public itemAtIndex(index: number): IViewRow {
		return this.heightMap[index];
	}

	public itemAfter(item: IViewRow): IViewRow {
		return this.heightMap[this.indexes[item.model.id] + 1] || null;
	}

}
