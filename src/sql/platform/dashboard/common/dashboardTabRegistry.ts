/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { GenerateDashboardWidgetSchema } from 'sql/parts/dashboard/pages/dashboardPageContribution';

const tabContributionSchema: IJSONSchema = {
	type: 'object',
	properties: {
		title: {
			type: 'string'
		},
		widgets: {
			type: 'array',
			items:  GenerateDashboardWidgetSchema()
		}
	}
};

export interface IDashboardTabContrib {
	title: string;
	widgets: WidgetConfig[];
}

ExtensionsRegistry.registerExtensionPoint<IDashboardTabContrib | IDashboardTabContrib[]>('dashboard.tabs', [], tabContributionSchema).setHandler(extensions => {

	function handleCommand(insight: IDashboardTabContrib, extension: IExtensionPointUser<any>) {

	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardTabContrib>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
