/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin, deepClone } from 'vs/base/common/objects';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

import { registerInsight } from 'sql/platform/dashboard/browser/insightRegistry';
import { barChartSchema } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/types/barChart.contribution';

import TimeSeriesChart from './timeSeriesChart.component';

const properties: IJSONSchema = {
};

const timeSeriesSchema = mixin(deepClone(barChartSchema), properties) as IJSONSchema;

registerInsight('timeSeries', '', timeSeriesSchema, TimeSeriesChart);
