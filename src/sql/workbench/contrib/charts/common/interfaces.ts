/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chartjs from 'chart.js';

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
