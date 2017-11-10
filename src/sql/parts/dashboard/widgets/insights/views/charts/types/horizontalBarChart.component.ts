/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartType } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import BarChart from './barChart.component';

export default class HorizontalBarChart extends BarChart {
	protected readonly chartType: ChartType = ChartType.HorizontalBar;
}
