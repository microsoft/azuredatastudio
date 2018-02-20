/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { generateDashboardWidgetSchema } from 'sql/parts/dashboard/pages/dashboardPageContribution';
import { registerTabContent } from 'sql/platform/dashboard/common/dashboardRegistry';

export const GRID_TABS = 'grid-tab';

let gridContentsSchema: IJSONSchema = {
	type: 'array',
	description: nls.localize('dashboard.tab.content.widgets', "The list of widgets that will be displayed in this tab."),
	items: generateDashboardWidgetSchema(undefined, true)
};

registerTabContent(GRID_TABS, gridContentsSchema);
