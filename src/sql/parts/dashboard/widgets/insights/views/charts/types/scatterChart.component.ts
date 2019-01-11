/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import LineChart, { ILineConfig } from './lineChart.component';
import { clone } from 'sql/base/common/objects';
import { ChartType, defaultChartConfig } from 'sql/parts/dashboard/widgets/insights/views/charts/interfaces';

import { mixin } from 'vs/base/common/objects';

const defaultScatterConfig = mixin(clone(defaultChartConfig), { dataType: 'point', dataDirection: 'horizontal' }) as ILineConfig;

export default class ScatterChart extends LineChart {
	protected readonly chartType: ChartType = ChartType.Scatter;
	protected _defaultConfig = defaultScatterConfig;
}
