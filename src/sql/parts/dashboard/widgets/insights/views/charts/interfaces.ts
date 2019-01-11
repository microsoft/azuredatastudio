/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from 'vs/base/common/color';
import * as types from 'vs/base/common/types';

import { mixin } from 'sql/base/common/objects';

export enum ChartType {
	Bar = 'bar',
	Doughnut = 'doughnut',
	HorizontalBar = 'horizontalBar',
	Line = 'line',
	Pie = 'pie',
	TimeSeries = 'timeSeries',
	Scatter = 'scatter'
}

export enum DataDirection {
	Vertical = 'vertical',
	Horizontal = 'horizontal'
}

export enum LegendPosition {
	Top = 'top',
	Bottom = 'bottom',
	Left = 'left',
	Right = 'right',
	None = 'none'
}

export enum DataType {
	Number = 'number',
	Point = 'point'
}

export function customMixin(destination: any, source: any, overwrite?: boolean): any {
	if (types.isObject(source)) {
		mixin(destination, source, overwrite, customMixin);
	} else if (types.isArray(source)) {
		for (let i = 0; i < source.length; i++) {
			if (destination[i]) {
				mixin(destination[i], source[i], overwrite, customMixin);
			} else {
				destination[i] = source[i];
			}
		}
	} else {
		destination = source;
	}
	return destination;
}

export interface IDataSet {
	data: Array<number>;
	label?: string;
}

export interface IPointDataSet {
	data: Array<{ x: number | string, y: number }>;
	label?: string;
	fill: boolean;
	backgroundColor?: Color;
}

export interface IChartConfig {
	colorMap?: { [column: string]: string };
	labelFirstColumn?: boolean;
	legendPosition?: LegendPosition;
	dataDirection?: DataDirection;
	columnsAsLabels?: boolean;
	showTopNData?: number;
}

export const defaultChartConfig: IChartConfig = {
	labelFirstColumn: true,
	columnsAsLabels: true,
	legendPosition: LegendPosition.Top,
	dataDirection: DataDirection.Vertical
};
