/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin } from 'vs/base/common/objects';
import { clone } from 'sql/base/common/objects';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerInsight } from 'sql/platform/dashboard/common/insightRegistry';
import { chartInsightSchema } from 'sql/workbench/parts/dashboard/widgets/insights/views/charts/chartInsight.contribution';

import PieChart from './pieChart.component';

const properties: IJSONSchema = {

};

const pieSchema = mixin(clone(chartInsightSchema), properties) as IJSONSchema;

registerInsight('pie', '', pieSchema, PieChart);
