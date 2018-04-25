/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { Row } from './tableModel';

export interface IViewRow {
	model: Row;
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
}
