/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { registerContainerType, registerNavSectionContainerType } from 'sql/platform/dashboard/common/dashboardContainerRegistry';

export const CONTROLHOST_CONTAINER = 'controlhost-container';

let webviewSchema: IJSONSchema = {
	type: 'null',
	description: nls.localize('dashboard.container.controlhost', "The controlhost that will be displayed in this tab."),
	default: null
};

registerContainerType(CONTROLHOST_CONTAINER, webviewSchema);
registerNavSectionContainerType(CONTROLHOST_CONTAINER, webviewSchema);