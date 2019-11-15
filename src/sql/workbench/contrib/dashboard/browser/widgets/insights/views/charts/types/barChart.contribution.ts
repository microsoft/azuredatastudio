/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin, deepClone } from 'vs/base/common/objects';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { registerInsight } from 'sql/platform/dashboard/browser/insightRegistry';
import { chartInsightSchema } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/chartInsight.contribution';

import BarChart from './barChart.component';

const properties: IJSONSchema = {
	properties: {
		yAxisMin: {
			type: 'number',
			description: nls.localize('yAxisMin', "Minimum value of the y axis")
		},
		yAxisMax: {
			type: 'number',
			description: nls.localize('yAxisMax', "Maximum value of the y axis")
		},
		yAxisLabel: {
			type: 'string',
			description: nls.localize('barchart.yAxisLabel', "Label for the y axis")
		},
		xAxisMin: {
			type: 'number',
			description: nls.localize('xAxisMin', "Minimum value of the x axis")
		},
		xAxisMax: {
			type: 'number',
			description: nls.localize('xAxisMax', "Maximum value of the x axis")
		},
		xAxisLabel: {
			type: 'string',
			description: nls.localize('barchart.xAxisLabel', "Label for the x axis")
		}
	}
};

export const barChartSchema = mixin(deepClone(chartInsightSchema), properties) as IJSONSchema;

registerInsight('bar', '', barChartSchema, BarChart);
