/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';

import * as platform from 'vs/platform/registry/common/platform';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from 'vs/platform/jsonschemas/common/jsonContributionRegistry';
import * as nls from 'vs/nls';

const contributionRegistry = platform.Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);

export type WidgetIdentifier = string;

export const Extensions = {
	DashboardWidgetContribution: 'dashboard.contributions.widgets'
};

export interface IDashboardRegistryOptions {
	extensionOnly: boolean;
}

export interface CustomIJSONSchema extends IJSONSchema {
	extensionProperties: IJSONSchemaMap;
}

export interface IDashboardWidgetRegistry {
	databaseWidgetSchema: CustomIJSONSchema;
	serverWidgetSchema: CustomIJSONSchema;
	allSchema: CustomIJSONSchema;
	registerWidget(id: string, description: string, schema: IJSONSchema, context?: 'database' | 'server'): WidgetIdentifier;
	registerNonCustomDashboardWidget(id: string, description: string, val: IInsightsConfig, context?: 'database' | 'server', options?: IDashboardRegistryOptions): WidgetIdentifier;
}

class DashboardWidgetRegistry implements IDashboardWidgetRegistry {
	private _allSchema: CustomIJSONSchema = { type: 'object', description: nls.localize('schema.dashboardWidgets.all', 'Widget used in the dashboards'), properties: {}, extensionProperties: {}, additionalProperties: false };
	private _dashboardWidgetSchema: CustomIJSONSchema = { type: 'object', description: nls.localize('schema.dashboardWidgets.database', 'Widget used in the dashboards'), properties: {}, extensionProperties: {}, additionalProperties: false };
	private _serverWidgetSchema: CustomIJSONSchema = { type: 'object', description: nls.localize('schema.dashboardWidgets.server', 'Widget used in the dashboards'), properties: {}, extensionProperties: {}, additionalProperties: false };

	/**
	 * Register a dashboard widget
	 * @param id id of the widget
	 * @param description description of the widget
	 * @param schema config schema of the widget
	 * @param context either 'database' or 'server' for what page to register for; if not specified, will register for both
	 */
	public registerWidget(id: string, description: string, schema: IJSONSchema, context?: 'database' | 'server', options?: IDashboardRegistryOptions): WidgetIdentifier {
		if (options && options.extensionOnly) {
			if (context === undefined || context === 'database') {
				this._dashboardWidgetSchema.extensionProperties[id] = schema;
			}

			if (context === undefined || context === 'server') {
				this._serverWidgetSchema.extensionProperties[id] = schema;
			}

			this._allSchema.extensionProperties[id] = schema;
		} else {
			if (context === undefined || context === 'database') {
				this._dashboardWidgetSchema.properties[id] = schema;
			}

			if (context === undefined || context === 'server') {
				this._serverWidgetSchema.properties[id] = schema;
			}

			this._allSchema.properties[id] = schema;
		}

		return id;
	}

	/**
	 * Register a non custom dashboard widget
	 * @param id id of the widget
	 * @param description description of the widget
	 * @param val cal for default
	 * @param context either 'database' or 'server' for what page to register for; if not specified, will register for both
	 */
	public registerNonCustomDashboardWidget(id: string, description: string, val: IInsightsConfig, context?: 'database' | 'server'): WidgetIdentifier {
		if (context === undefined || context === 'database') {
			this._dashboardWidgetSchema.properties[id] = { type: 'null', default: null };
		}

		if (context === undefined || context === 'server') {
			this._serverWidgetSchema.properties[id] = { type: 'null', default: null };
		}

		return id;
	}

	public get databaseWidgetSchema(): CustomIJSONSchema {
		return this._dashboardWidgetSchema;
	}

	public get serverWidgetSchema(): CustomIJSONSchema {
		return this._serverWidgetSchema;
	}

	public get allSchema(): CustomIJSONSchema {
		return this._allSchema;
	}
}

const dashboardWidgetRegistry = new DashboardWidgetRegistry();
platform.Registry.add(Extensions.DashboardWidgetContribution, dashboardWidgetRegistry);

export function registerDashboardWidget(id: string, description: string, schema: IJSONSchema, context?: 'database' | 'server', options?: IDashboardRegistryOptions): WidgetIdentifier {
	return dashboardWidgetRegistry.registerWidget(id, description, schema, context, options);
}

export function registerNonCustomDashboardWidget(id: string, description: string, val: IInsightsConfig): WidgetIdentifier {
	return dashboardWidgetRegistry.registerNonCustomDashboardWidget(id, description, val);
}