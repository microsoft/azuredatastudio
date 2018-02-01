/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartType, defaultChartConfig } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import LineChart, { ILineConfig } from './lineChart.component';

import { mixin } from 'vs/base/common/objects';
import { clone } from 'sql/base/common/objects';

const defaultScatterConfig = mixin(clone(defaultChartConfig), { dataType: 'point', dataDirection: 'horizontal' }) as ILineConfig;

export default class ScatterChart extends LineChart {
	protected readonly chartType: ChartType = ChartType.Scatter;
	protected _defaultConfig = defaultScatterConfig;
}
