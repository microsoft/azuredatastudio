/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import { Extensions as ConfigurationExtension } from 'vs/platform/configuration/common/configurationRegistry';
import { deepClone } from 'vs/base/common/objects';

import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';

export const Extensions = {
	InnerTabContributions: 'dashboard.contributions.innerTabs'
};

export interface IDashboardInnerTab {
	id: string;
	title: string;
	hasIcon: boolean;
	content?: object;
}

export interface IDashboardInnerTabRegistry {
	registerInnerTab(tab: IDashboardInnerTab): void;
	registerInnerTabContent(id: string, schema: IJSONSchema): void;
	innerTabs: Array<IDashboardInnerTab>;
	innerTabContentSchemaProperties: IJSONSchemaMap;
}

class DashboardInnerTabRegistry implements IDashboardInnerTabRegistry {
	private _innertabs = new Array<IDashboardInnerTab>();
	private _dashboardInnerTabContentSchemaProperties: IJSONSchemaMap = {};

	public registerInnerTab(tab: IDashboardInnerTab): void {
		this._innertabs.push(tab);
	}

	public get innerTabs(): Array<IDashboardInnerTab> {
		return this._innertabs;
	}

	/**
	 * Register a dashboard widget
	 * @param id id of the widget
	 * @param schema config schema of the widget
	 */
	public registerInnerTabContent(id: string, schema: IJSONSchema): void {
		this._dashboardInnerTabContentSchemaProperties[id] = schema;
	}

	public get innerTabContentSchemaProperties(): IJSONSchemaMap {
		return deepClone(this._dashboardInnerTabContentSchemaProperties);
	}
}

const dashboardInnerTabRegistry = new DashboardInnerTabRegistry();
Registry.add(Extensions.InnerTabContributions, dashboardInnerTabRegistry);

export function registerInnerTab(innerTab: IDashboardInnerTab): void {
	dashboardInnerTabRegistry.registerInnerTab(innerTab);
}

export function registerInnerTabContent(id: string, schema: IJSONSchema): void {
	dashboardInnerTabRegistry.registerInnerTabContent(id, schema);
}

export function generateInnerTabContentSchemaProperties(): IJSONSchemaMap {
	return dashboardInnerTabRegistry.innerTabContentSchemaProperties;
}