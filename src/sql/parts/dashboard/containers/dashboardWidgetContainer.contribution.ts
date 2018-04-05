/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { generateDashboardWidgetSchema } from 'sql/parts/dashboard/pages/dashboardPageContribution';
import { registerContainerType, registerNavSectionContainerType } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';

export const WIDGETS_CONTAINER = 'widgets-container';

const widgetsSchema: IJSONSchema = {
	type: 'array',
	description: nls.localize('dashboard.container.widgets', "The list of widgets that will be displayed in this tab."),
	items: generateDashboardWidgetSchema(undefined, true)
};

registerContainerType(WIDGETS_CONTAINER, widgetsSchema);
registerNavSectionContainerType(WIDGETS_CONTAINER, widgetsSchema);

export function validateWidgetContainerContribution(extension: IExtensionPointUser<any>, WidgetConfigs: object[]): boolean {
	let result = true;
	WidgetConfigs.forEach(widgetConfig => {
		let allKeys = Object.keys(widgetConfig);
		let widgetKey = allKeys.find(key => key === 'widget');
		if (!widgetKey) {
			result = false;
			extension.collector.error(nls.localize('widgetContainer.invalidInputs', 'The list of widgets is expected inside widgets-container for extension.'));
		}
	});
	return result;
}