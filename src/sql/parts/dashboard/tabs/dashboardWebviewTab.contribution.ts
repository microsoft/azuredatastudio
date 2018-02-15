/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { registerTabContent } from 'sql/platform/dashboard/common/dashboardRegistry';

export const WEBVIEW_TABS = 'webview-tab';

let webviewSchema: IJSONSchema = {
	type: 'null',
	description: nls.localize('dashboard.tab.widgets', "The list of widgets that will be displayed in this tab."),
	default: null
};

registerTabContent(WEBVIEW_TABS, webviewSchema);