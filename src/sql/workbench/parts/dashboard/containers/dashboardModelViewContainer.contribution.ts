/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { registerContainerType, registerNavSectionContainerType } from 'sql/platform/dashboard/common/dashboardContainerRegistry';

export const MODELVIEW_CONTAINER = 'modelview-container';

let modelviewSchema: IJSONSchema = {
	type: 'null',
	description: nls.localize('dashboard.container.modelview', "The model-backed view that will be displayed in this tab."),
	default: null
};

registerContainerType(MODELVIEW_CONTAINER, modelviewSchema);
registerNavSectionContainerType(MODELVIEW_CONTAINER, modelviewSchema);