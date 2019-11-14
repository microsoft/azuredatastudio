/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin, deepClone } from 'vs/base/common/objects';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

import { registerInsight } from 'sql/platform/dashboard/browser/insightRegistry';
import { barChartSchema } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/types/barChart.contribution';

import HorizontalBarChart from './horizontalBarChart.component';

const properties: IJSONSchema = {

};

const horizontalBarSchema = mixin(deepClone(barChartSchema), properties) as IJSONSchema;

registerInsight('horizontalBar', '', horizontalBarSchema, HorizontalBarChart);
