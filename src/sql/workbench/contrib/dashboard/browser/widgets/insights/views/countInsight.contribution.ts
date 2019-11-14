/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerInsight } from 'sql/platform/dashboard/browser/insightRegistry';

import CountInsight from './countInsight.component';

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

const countInsightSchema: IJSONSchema = {
	type: 'null',
	description: nls.localize('countInsightDescription', "For each column in a resultset, displays the value in row 0 as a count followed by the column name. Supports '1 Healthy', '3 Unhealthy' for example, where 'Healthy' is the column name and 1 is the value in row 1 cell 1")
};

registerInsight('count', '', countInsightSchema, CountInsight);
