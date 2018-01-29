/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import URI from 'vs/base/common/uri';
import { join } from 'path';
import { createCSSRule } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { IdGenerator } from 'vs/base/common/idGenerator';
import * as types from 'vs/base/common/types';

import { GenerateDashboardWidgetSchema } from 'sql/parts/dashboard/pages/dashboardPageContribution';
import { RegisterTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';

export interface IDashboardTabContrib {
	id: string;
	title: string;
	widgets: WidgetConfig[];
	icon: string | { light: string, dark: string};
	provider: string | string[];
	edition: number | number[];
}

const tabContributionSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string'
		},
		title: {
			type: 'string'
		},
		icon: {
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: localize('sqlops.extension.contributes.dashboard.tab.icon.light', 'Icon path when a light theme is used'),
						type: 'string'
					},
					dark: {
						description: localize('sqlops.extension.contributes.dashboard.tab.icon.dark', 'Icon path when a dark theme is used'),
						type: 'string'
					}
				}
			}]
		},
		provider: {
			anyOf: [
				{
					type: 'string'
				},
				{
					type: 'array',
					items: {
						type: 'string'
					}
				}
			]
		},
		edition: {
			anyOf: [
				{
					type: 'number'
				},
				{
					type: 'array',
					items: {
						type: 'number'
					}
				}
			]
		},
		widgets: {
			type: 'array',
			items: GenerateDashboardWidgetSchema()
		}
	}
};

ExtensionsRegistry.registerExtensionPoint<IDashboardTabContrib | IDashboardTabContrib[]>('dashboard.tabs', [], tabContributionSchema).setHandler(extensions => {

	const ids = new IdGenerator('contrib-dashboard-tab-icon-');

	function handleCommand(tab: IDashboardTabContrib, extension: IExtensionPointUser<any>) {
		let iconClass: string;
		let iconPath: string;
		let { icon, widgets, title, edition, provider, id } = tab;
		if (icon) {
			iconClass = ids.nextId();
			if (types.isString(icon)) {
				iconPath = join(extension.description.extensionFolderPath, icon);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(iconPath).toString()}")`);
			} else {
				const light = join(extension.description.extensionFolderPath, icon.light);
				const dark = join(extension.description.extensionFolderPath, icon.dark);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(light).toString()}")`);
				createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${URI.file(dark).toString()}")`);
				iconPath = join(extension.description.extensionFolderPath, icon.dark);
			}
		}
		RegisterTab({ iconClass, title, widgets, edition, provider, id });
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
