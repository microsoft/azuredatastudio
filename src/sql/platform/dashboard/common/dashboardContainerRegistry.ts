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
	dashboardContainerContributions: 'dashboard.contributions.container'
};

export interface IDashboardContainer {
	id: string;
	title: string;
	hasIcon: boolean;
	container?: object;
}

export interface IDashboardContainerRegistry {
	registerContainer(tab: IDashboardContainer): void;
	registerContainerType(id: string, schema: IJSONSchema): void;
	containers: Array<IDashboardContainer>;
	containerTypeSchemaProperties: IJSONSchemaMap;
}

class DashboardContainerRegistry implements IDashboardContainerRegistry {
	private _containers = new Array<IDashboardContainer>();
	private _dashboardContainerTypeSchemaProperties: IJSONSchemaMap = {};

	public registerContainer(tab: IDashboardContainer): void {
		this._containers.push(tab);
	}

	public get containers(): Array<IDashboardContainer> {
		return this._containers;
	}

	/**
	 * Register a dashboard widget
	 * @param id id of the widget
	 * @param schema config schema of the widget
	 */
	public registerContainerType(id: string, schema: IJSONSchema): void {
		this._dashboardContainerTypeSchemaProperties[id] = schema;
	}

	public get containerTypeSchemaProperties(): IJSONSchemaMap {
		return deepClone(this._dashboardContainerTypeSchemaProperties);
	}
}

const dashboardContainerRegistry = new DashboardContainerRegistry();
Registry.add(Extensions.dashboardContainerContributions, dashboardContainerRegistry);

export function registerContainer(innerTab: IDashboardContainer): void {
	dashboardContainerRegistry.registerContainer(innerTab);
}

export function registerContainerType(id: string, schema: IJSONSchema): void {
	dashboardContainerRegistry.registerContainerType(id, schema);
}

export function generateContainerTypeSchemaProperties(): IJSONSchemaMap {
	return dashboardContainerRegistry.containerTypeSchemaProperties;
}