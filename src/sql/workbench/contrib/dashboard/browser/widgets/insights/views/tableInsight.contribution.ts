/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerInsight } from 'sql/platform/dashboard/browser/insightRegistry';

import TableInsight from './tableInsight.component';

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

const tableInsightSchema: IJSONSchema = {
	type: 'null',
	description: nls.localize('tableInsightDescription', "Displays the results in a simple table")
};

registerInsight('table', '', tableInsightSchema, TableInsight);
