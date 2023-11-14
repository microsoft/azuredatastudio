/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

export enum DataDirection {
	Vertical = 'vertical',
	Horizontal = 'horizontal'
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
}

export class ChartState {
	dataId?: {
		batchId: number;
		resultId: number;
	};
	options: IInsightOptions = {
		type: ChartType.Bar
	};
	dispose() {
	}
}
