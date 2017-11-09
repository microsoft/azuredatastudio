/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartType } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import PieChart from './pieChart.component';

export default class DoughnutChart extends PieChart {
	protected readonly chartType: ChartType = ChartType.Doughnut;
}
