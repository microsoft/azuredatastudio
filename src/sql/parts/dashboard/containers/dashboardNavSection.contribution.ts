/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { registerTabContent } from 'sql/platform/dashboard/common/dashboardRegistry';

export const NAV_SECTION = 'nav-section';

let NavSectionSchema: IJSONSchema = {
	type: 'array',
	description: nls.localize('dashboard.tab.content.left-nav-bar', "The list of inner tabs IDs that will be displayed in this vertical navigation bar."),
	items: {
		type: 'string'
	}
};

registerTabContent(NAV_SECTION, NavSectionSchema);