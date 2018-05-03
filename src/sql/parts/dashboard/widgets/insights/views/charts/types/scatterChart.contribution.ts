/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mixin } from 'vs/base/common/objects';
import { clone } from 'sql/base/common/objects';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

import { registerInsight } from 'sql/platform/dashboard/common/insightRegistry';
import { barChartSchema } from 'sql/parts/dashboard/widgets/insights/views/charts/types/barChart.contribution';

import ScatterChart from './scatterChart.component';

const properties: IJSONSchema = {
};

const scatterSchema = mixin(clone(barChartSchema), properties) as IJSONSchema;

registerInsight('scatter', '', scatterSchema, ScatterChart);
