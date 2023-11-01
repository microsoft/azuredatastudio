/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Dimension } from 'vs/base/browser/dom';
import { mixin } from 'sql/base/common/objects';
import * as types from 'vs/base/common/types';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';
import { BrandedService } from 'vs/platform/instantiation/common/instantiation';
import * as chartjs from 'chart.js';

export interface IPointDataSet {
	data: Array<{ x: number | string, y: number }>;
	label?: string;
	fill: boolean;
	backgroundColor?: string;
}

export function customMixin(destination: any, source: any, overwrite?: boolean): any {
	if (types.isObject(source)) {
		mixin(destination, source, overwrite, customMixin);
	} else if (Array.isArray(source)) {
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

export interface IInsight {
	options: IInsightOptions;
	data: IInsightData;
	readonly types: Array<InsightType | ChartType>;
	layout(dim: Dimension): void;
	dispose(): void;
}

export interface IInsightCtor {
	new <Services extends BrandedService[]>(container: HTMLElement, options: IInsightOptions, ...services: Services): IInsight;
	readonly types: Array<InsightType | ChartType>;
}

export interface IChartsConfiguration {
	readonly maxRowCount: number;
}

export interface IInsightOptions {
	type: InsightType | ChartType;
	dataDirection?: DataDirection;
	dataType?: DataType;
	labelFirstColumn?: boolean;
	columnsAsLabels?: boolean;
	legendPosition?: LegendPosition;
	yAxisLabel?: string;
	yAxisMin?: number;
	yAxisMax?: number;
	xAxisLabel?: string;
	xAxisMin?: number;
	xAxisMax?: number;
	encoding?: string;
	imageFormat?: string;
	indexAxis?: string;
}

export enum InsightType {
	Image = 'image',
	Table = 'table',
	Count = 'count'
}

export enum ChartType {
	Bar = 'bar',
	Doughnut = 'doughnut',
	HorizontalBar = 'horizontalBar',
	Line = 'line',
	Pie = 'pie',
	TimeSeries = 'timeSeries',
	Scatter = 'scatter'
}

export const ChartTypeToChartJsType: { [key in ChartType]: chartjs.ChartType } = {
	'bar': 'bar',
	'doughnut': 'doughnut',
	'horizontalBar': 'bar',
	'line': 'line',
	'pie': 'pie',
	'timeSeries': 'line',
	'scatter': 'scatter'
}

export enum LegendPosition {
	Top = 'top',
	Bottom = 'bottom',
	Left = 'left',
	Right = 'right',
	None = 'none'
}

export const LegendPositionToChartJsPosition: { [key in LegendPosition]: chartjs.LayoutPosition } = {
	'top': 'top',
	'bottom': 'bottom',
	'left': 'left',
	'right': 'right',
	'none': 'left' // chart.js doesn't have a 'none' option, so we use 'left' and then hide the legend
}

export enum DataType {
	Number = 'number',
	Point = 'point'
}

export enum DataDirection {
	Vertical = 'vertical',
	Horizontal = 'horizontal'
}
