/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import * as nls from 'vs/nls';

import { registerContainerType } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { find } from 'vs/base/common/arrays';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

export const FULLSIZE_WIDGET_CONTAINER = 'full-size-widget-container';

const FullSizeContainerSchema: IJSONSchema = {
	type: 'object',
	description: nls.localize('dashboard.container.full-size-widget-container', "The full size widget container properties"),
	properties: {
		widget: {
			type: 'object',
		}
	}
};

registerContainerType(FULLSIZE_WIDGET_CONTAINER, FullSizeContainerSchema);

export function validateFullSizeWidgetContainerContribution(extension: IExtensionPointUser<any>, widgetConfig: object): boolean {
	let result = true;
	const allKeys = Object.keys(widgetConfig);
	const widgetKey = find(allKeys, key => key === 'widget');
	if (!widgetKey) {
		result = false;
		extension.collector.error(nls.localize('fullSizeWidgetContainer.invalidInput', "The widget is expected inside full-size-widget-container for extension."));
	}
	return result;
}
