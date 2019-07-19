/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';

export const Extensions = {
	dashboardContainerContributions: 'dashboard.contributions.container'
};

export interface IDashboardContainer {
	id: string;
	container?: object;
}

export interface IDashboardContainerRegistry {
	registerContainer(container: IDashboardContainer): void;
	registerContainerType(id: string, schema: IJSONSchema): void;
	registerNavSectionContainerType(id: string, schema: IJSONSchema): void;
	getRegisteredContainer(id: string): IDashboardContainer;
	containerTypeSchemaProperties: IJSONSchemaMap;
	navSectionContainerTypeSchemaProperties: IJSONSchemaMap;
}

class DashboardContainerRegistry implements IDashboardContainerRegistry {
	private _containers: { [x: string]: IDashboardContainer } = {};
	private _dashboardContainerTypeSchemaProperties: IJSONSchemaMap = {};
	private _dashboardNavSectionContainerTypeSchemaProperties: IJSONSchemaMap = {};

	public registerContainer(container: IDashboardContainer): void {
		this._containers[container.id] = container;
	}

	public getRegisteredContainer(id: string): IDashboardContainer {
		return this._containers[id];
	}

	/**
	 * Register a dashboard container
	 * @param id id of the container
	 * @param schema config schema of the container
	 */
	public registerContainerType(id: string, schema: IJSONSchema): void {
		this._dashboardContainerTypeSchemaProperties[id] = schema;
	}

	public get containerTypeSchemaProperties(): IJSONSchemaMap {
		return this._dashboardContainerTypeSchemaProperties;
	}

	/**
	 * Register a dashboard nav section container
	 * @param id id of the container
	 * @param schema config schema of the container
	 */
	public registerNavSectionContainerType(id: string, schema: IJSONSchema): void {
		this._dashboardNavSectionContainerTypeSchemaProperties[id] = schema;
	}

	public get navSectionContainerTypeSchemaProperties(): IJSONSchemaMap {
		return this._dashboardNavSectionContainerTypeSchemaProperties;
	}
}

const dashboardContainerRegistry = new DashboardContainerRegistry();
Registry.add(Extensions.dashboardContainerContributions, dashboardContainerRegistry);

export function registerContainer(container: IDashboardContainer): void {
	dashboardContainerRegistry.registerContainer(container);
}

export function registerContainerType(id: string, schema: IJSONSchema): void {
	dashboardContainerRegistry.registerContainerType(id, schema);
}

export function generateContainerTypeSchemaProperties(): IJSONSchemaMap {
	return dashboardContainerRegistry.containerTypeSchemaProperties;
}

export function registerNavSectionContainerType(id: string, schema: IJSONSchema): void {
	dashboardContainerRegistry.registerNavSectionContainerType(id, schema);
}

export function generateNavSectionContainerTypeSchemaProperties(): IJSONSchemaMap {
	return dashboardContainerRegistry.navSectionContainerTypeSchemaProperties;
}
