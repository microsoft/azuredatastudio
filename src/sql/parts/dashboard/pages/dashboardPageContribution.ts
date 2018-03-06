/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Extensions, IDashboardWidgetRegistry } from 'sql/platform/dashboard/common/widgetRegistry';

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { mixin } from 'vs/base/common/objects';
import { localize } from 'vs/nls';

let widgetRegistry = <IDashboardWidgetRegistry>Registry.as(Extensions.DashboardWidgetContribution);

export function generateDashboardWidgetSchema(type?: 'database' | 'server', extension?: boolean): IJSONSchema {
	let schemas;
	if (extension) {
		let extensionSchemas = type === 'server' ? widgetRegistry.serverWidgetSchema.extensionProperties : type === 'database' ? widgetRegistry.databaseWidgetSchema.extensionProperties : widgetRegistry.allSchema.extensionProperties;
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
			}
		}
	};
}

export function generateDashboardGridLayoutSchema(type?: 'database' | 'server', extension?: boolean): IJSONSchema {
	let schemas;
	if (extension) {
		let extensionSchemas = type === 'server' ? widgetRegistry.serverWidgetSchema.extensionProperties : type === 'database' ? widgetRegistry.databaseWidgetSchema.extensionProperties : widgetRegistry.allSchema.extensionProperties;
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
				description: localize('tabName', "The title of the container")
			},
			row: {
				type: 'number',
				description: localize('rowNumber', "The row of the component in the grid")
			},
			rowspan: {
				type: 'string',
				description: localize('rowSpan', "The rowspan of the component in the grid. Default value is 1. Use '*' to set to number of rows in teh grid.")
			},
			col: {
				type: 'number',
				description: localize('colNumber', "The column of the component in the grid")
			},
			colspan: {
				type: 'string',
				description: localize('colspan', "The colspan of the component in the grid. Default value is 1. Use '*' to set to number of columns in teh grid.")
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
				description: localize('sqlops.extension.contributes.dashboardPage.tab.id', "Unique identifier for this tab. Will be passed to the extension for any requests."),
				enum: [],
				enumDescriptions: [],
				errorMessage: localize('dashboardTabError', "Extension tab is unknown or not installed.")
			}
		}
	};
}

export const DASHBOARD_CONFIG_ID = 'Dashboard';
export const DASHBOARD_TABS_KEY_PROPERTY = 'tabId';