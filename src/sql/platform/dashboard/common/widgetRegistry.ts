/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';

import * as platform from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

export type WidgetIdentifier = string;

export const Extensions = {
	DashboardWidgetContribution: 'dashboard.contributions.widgets'
};

export interface IDashboardWidgetRegistry {
	databaseWidgetSchema: IJSONSchema;
	serverWidgetSchema: IJSONSchema;
	registerWidget(id: string, description: string, schema: IJSONSchema, context?: 'database' | 'server'): WidgetIdentifier;
	registerNonCustomDashboardWidget(id: string, description: string, val: IInsightsConfig, context?: 'database' | 'server'): WidgetIdentifier;
}

class DashboardWidgetRegistry implements IDashboardWidgetRegistry {
	private _dashboardWidgetSchema: IJSONSchema = { type: 'object', description: nls.localize('schema.dashboardWidgets', 'Widget used in the dashboards'), properties: {}, additionalProperties: false };
	private _serverWidgetSchema: IJSONSchema = { type: 'object', description: nls.localize('schema.dashboardWidgets', 'Widget used in the dashboards'), properties: {}, additionalProperties: false };
	/**
	 * Register a dashboard widget
	 * @param id id of the widget
	 * @param description description of the widget
	 * @param schema config schema of the widget
	 * @param context either 'database' or 'server' for what page to register for; if not specified, will register for both
	 */
	public registerWidget(id: string, description: string, schema: IJSONSchema, context?: 'database' | 'server'): WidgetIdentifier {
		if (context === undefined || context === 'database') {
			this._dashboardWidgetSchema.properties[id] = schema;
		}

		if (context === undefined || context === 'server') {
			this._serverWidgetSchema.properties[id] = schema;
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
	registerNonCustomDashboardWidget(id: string, description: string, val: IInsightsConfig, context?: 'database' | 'server'): WidgetIdentifier {
		if (context === undefined || context === 'database') {
			this._dashboardWidgetSchema.properties[id] = { type: 'null', default: null };
		}

		if (context === undefined || context === 'server') {
			this._serverWidgetSchema.properties[id] = { type: 'null', default: null };
		}

		return id;
	}

	public get databaseWidgetSchema(): IJSONSchema {
		return this._dashboardWidgetSchema;
	}

	public get serverWidgetSchema(): IJSONSchema {
		return this._serverWidgetSchema;
	}
}

const dashboardWidgetRegistry = new DashboardWidgetRegistry();
platform.Registry.add(Extensions.DashboardWidgetContribution, dashboardWidgetRegistry);

export function registerDashboardWidget(id: string, description: string, schema: IJSONSchema, context?: 'database' | 'server'): WidgetIdentifier {
	return dashboardWidgetRegistry.registerWidget(id, description, schema, context);
}

export function registerNonCustomDashboardWidget(id: string, description: string, val: IInsightsConfig): WidgetIdentifier {
	return dashboardWidgetRegistry.registerNonCustomDashboardWidget(id, description, val);
}