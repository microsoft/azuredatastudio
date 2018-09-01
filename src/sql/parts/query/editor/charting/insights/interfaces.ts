/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IInsightData } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { ChartType, LegendPosition, DataDirection } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import { Dimension } from 'vs/base/browser/dom';
import { DataType } from 'sql/parts/dashboard/widgets/insights/views/charts/types/lineChart.component';

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

export interface IInsight {
	options: IInsightOptions;
	data: IInsightData;
	readonly types: Array<InsightType | ChartType>;
	layout(dim: Dimension);
	dispose();
}

export interface IInsightCtor {
	new (container: HTMLElement, options: IInsightOptions, ...services: { _serviceBrand: any; }[]): IInsight;
	readonly types: Array<InsightType | ChartType>;
}

export enum InsightType {
	Image = 'image',
	Table = 'table',
	Count = 'count'
}
