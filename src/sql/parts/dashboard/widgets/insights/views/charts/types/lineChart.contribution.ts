/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mixin, clone } from 'vs/base/common/objects';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerInsight } from 'sql/platform/dashboard/common/insightRegistry';
import { chartInsightSchema } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.contribution';

import LineChart from './lineChart.component';

import * as nls from 'vs/nls';

const properties: IJSONSchema = {
	properties: {
		dataType: {
			type: 'string',
			description: nls.localize('dataTypeDescription', 'Indicates data property of a data set for a chart.'),
			default: 'number',
			enum: ['number', 'point'],
			enumDescriptions: ['Set "number" if the data values are contained in 1 column.', 'Set "point" if the data is an {x,y} combination requiring 2 columns for each value.']
		},
	}
};

export const lineSchema = mixin(clone(chartInsightSchema), properties) as IJSONSchema;

registerInsight('line', '', lineSchema, LineChart);
