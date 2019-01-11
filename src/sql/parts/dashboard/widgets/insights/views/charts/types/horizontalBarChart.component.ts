/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import BarChart from './barChart.component';
import { ChartType } from 'sql/parts/dashboard/widgets/insights/views/charts/interfaces';

export default class HorizontalBarChart extends BarChart {
	protected readonly chartType: ChartType = ChartType.HorizontalBar;
}
