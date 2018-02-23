/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { generateDashboardWidgetSchema } from 'sql/parts/dashboard/pages/dashboardPageContribution';
import { registerContainerType, registerNavSectionContainerType } from 'sql/platform/dashboard/common/dashboardContainerRegistry';

export const WIDGETS_CONTAINER = 'widgets-container';

let widgetsSchema: IJSONSchema = {
	type: 'array',
	description: nls.localize('dashboard.container.widgets', "The list of widgets that will be displayed in this tab."),
	items: generateDashboardWidgetSchema(undefined, true)
};

registerContainerType(WIDGETS_CONTAINER, widgetsSchema);
registerNavSectionContainerType(WIDGETS_CONTAINER, widgetsSchema);
