/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { generateDashboardGridLayoutSchema } from 'sql/parts/dashboard/pages/dashboardPageContribution';
import { registerTabContent } from 'sql/platform/dashboard/common/dashboardRegistry';

export const GRID_TAB = 'grid-tab';

let gridContentsSchema: IJSONSchema = {
	type: 'array',
	description: nls.localize('dashboard.gridtab.content.items', "The list of widgets or webviews that will be displayed in this tab."),
	items: generateDashboardGridLayoutSchema(undefined, true)
};

registerTabContent(GRID_TAB, gridContentsSchema);
