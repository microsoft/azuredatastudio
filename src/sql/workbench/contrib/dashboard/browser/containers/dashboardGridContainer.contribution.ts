/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { generateDashboardGridLayoutSchema } from 'sql/workbench/contrib/dashboard/browser/pages/dashboardPageContribution';
import { registerContainerType, registerNavSectionContainerType } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { find } from 'vs/base/common/arrays';

export const GRID_CONTAINER = 'grid-container';

let gridContainersSchema: IJSONSchema = {
	type: 'array',
	description: nls.localize('dashboard.container.gridtab.items', "The list of widgets or webviews that will be displayed in this tab."),
	items: generateDashboardGridLayoutSchema(undefined, true)
};

registerContainerType(GRID_CONTAINER, gridContainersSchema);
registerNavSectionContainerType(GRID_CONTAINER, gridContainersSchema);

export function validateGridContainerContribution(extension: IExtensionPointUser<any>, gridConfigs: object[]): boolean {
	let result = true;
	gridConfigs.forEach(widgetConfig => {
		const allKeys = Object.keys(widgetConfig);
		const widgetOrWebviewKey = find(allKeys, key => key === 'widget' || key === 'webview');
		if (!widgetOrWebviewKey) {
			result = false;
			extension.collector.error(nls.localize('gridContainer.invalidInputs', "widgets or webviews are expected inside widgets-container for extension."));
			return;
		}
	});
	return result;
}
