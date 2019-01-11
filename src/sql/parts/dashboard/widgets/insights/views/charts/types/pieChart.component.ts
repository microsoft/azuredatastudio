/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartInsight } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import { ChartType } from 'sql/parts/dashboard/widgets/insights/views/charts/interfaces';

export default class PieChart extends ChartInsight {
	protected readonly chartType: ChartType = ChartType.Pie;
}
