/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { registerContainerType, registerNavSectionContainerType } from 'sql/platform/dashboard/common/dashboardContainerRegistry';

export const WEBVIEW_CONTAINER = 'webview-container';

let webviewSchema: IJSONSchema = {
	type: 'null',
	description: nls.localize('dashboard.container.webview', "The webview that will be displayed in this tab."),
	default: null
};

registerContainerType(WEBVIEW_CONTAINER, webviewSchema);
registerNavSectionContainerType(WEBVIEW_CONTAINER, webviewSchema);