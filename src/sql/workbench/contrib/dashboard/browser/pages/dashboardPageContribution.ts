/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Extensions, IDashboardWidgetRegistry } from 'sql/platform/dashboard/browser/widgetRegistry';

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { mixin } from 'vs/base/common/objects';
import { localize } from 'vs/nls';

let widgetRegistry = <IDashboardWidgetRegistry>Registry.as(Extensions.DashboardWidgetContribution);

export function generateDashboardWidgetSchema(type?: 'database' | 'server', extension?: boolean): IJSONSchema {
	let schemas;
	if (extension) {
		const extensionSchemas = type === 'server' ? widgetRegistry.serverWidgetSchema.extensionProperties : type === 'database' ? widgetRegistry.databaseWidgetSchema.extensionProperties : widgetRegistry.allSchema.extensionProperties;
		schemas = type === 'server' ? widgetRegistry.serverWidgetSchema.properties : type === 'database' ? widgetRegistry.databaseWidgetSchema.properties : widgetRegistry.allSchema.properties;
		schemas = mixin(schemas, extensionSchemas, true);
	} else {
		schemas = type === 'server' ? widgetRegistry.serverWidgetSchema.properties : type === 'database' ? widgetRegistry.databaseWidgetSchema.properties : widgetRegistry.allSchema.properties;
	}

	return {
		type: 'object',
		properties: {
			name: {
				type: 'string'
			},
			icon: {
				type: 'string'
			},
			when: {
				description: localize('azdata.extension.contributes.widget.when', "Condition which must be true to show this item"),
				type: 'string'
			},
			gridItemConfig: {
				type: 'object',
				properties: {
					sizex: {
						type: 'number'
					},
					sizey: {
						type: 'number'
					},
					col: {
						type: 'number'
					},
					row: {
						type: 'number'
					}
				}
			},
			widget: {
				type: 'object',
				properties: schemas,
				minItems: 1,
				maxItems: 1
			},
			hideHeader: {
				type: 'boolean',
				description: localize('azdata.extension.contributes.widget.hideHeader', "Whether to hide the header of the widget, default value is false")
			}
		}
	};
}

export function generateDashboardGridLayoutSchema(type?: 'database' | 'server', extension?: boolean): IJSONSchema {
	let schemas;
	if (extension) {
		const extensionSchemas = type === 'server' ? widgetRegistry.serverWidgetSchema.extensionProperties : type === 'database' ? widgetRegistry.databaseWidgetSchema.extensionProperties : widgetRegistry.allSchema.extensionProperties;
		schemas = type === 'server' ? widgetRegistry.serverWidgetSchema.properties : type === 'database' ? widgetRegistry.databaseWidgetSchema.properties : widgetRegistry.allSchema.properties;
		schemas = mixin(schemas, extensionSchemas, true);
	} else {
		schemas = type === 'server' ? widgetRegistry.serverWidgetSchema.properties : type === 'database' ? widgetRegistry.databaseWidgetSchema.properties : widgetRegistry.allSchema.properties;
	}

	return {
		type: 'object',
		properties: {
			name: {
				type: 'string',
				description: localize('dashboardpage.tabName', "The title of the container")
			},
			row: {
				type: 'number',
				description: localize('dashboardpage.rowNumber', "The row of the component in the grid")
			},
			rowspan: {
				type: ['string', 'number'],
				description: localize('dashboardpage.rowSpan', "The rowspan of the component in the grid. Default value is 1. Use '*' to set to number of rows in the grid.")
			},
			col: {
				type: 'number',
				description: localize('dashboardpage.colNumber', "The column of the component in the grid")
			},
			colspan: {
				type: ['string', 'number'],
				description: localize('dashboardpage.colspan', "The colspan of the component in the grid. Default value is 1. Use '*' to set to number of columns in the grid.")
			},
			widget: {
				anyOf: [
					{
						type: 'object',
						properties: schemas,
						minItems: 1,
						maxItems: 1
					}
				]
			},
			webview: {
				anyOf: [
					{
						type: 'object',
						properties: {
							id: {
								type: 'string',
							}
						}
					}
				]
			},
			when: {
				description: localize('azdata.extension.contributes.widget.when', "Condition which must be true to show this item"),
				type: 'string'
			}
		}
	};
}

export function generateDashboardTabSchema(type?: 'database' | 'server'): IJSONSchema {
	return {
		type: 'object',
		properties: {
			tabId: {
				type: 'string',
				description: localize('azdata.extension.contributes.dashboardPage.tab.id', "Unique identifier for this tab. Will be passed to the extension for any requests."),
				enum: [],
				enumDescriptions: [],
				errorMessage: localize('dashboardTabError', "Extension tab is unknown or not installed.")
			},
			isPinned: {
				type: 'boolean'
			}
		}
	};
}

export const DASHBOARD_CONFIG_ID = 'Dashboard';
export const DASHBOARD_TABS_KEY_PROPERTY = 'tabId';
