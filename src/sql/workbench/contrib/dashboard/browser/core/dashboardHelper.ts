/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from 'vs/base/common/types';
import { generateUuid } from 'vs/base/common/uuid';
import { Registry } from 'vs/platform/registry/common/platform';
import * as nls from 'vs/nls';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import { WidgetConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/browser/insightRegistry';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { WIDGETS_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardGridContainer.contribution';
import { WEBVIEW_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWebviewContainer.contribution';
import { MODELVIEW_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardModelViewContainer.contribution';
import { CONTROLHOST_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardControlHostContainer.contribution';
import { NAV_SECTION } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardNavSection.contribution';
import { IDashboardContainerRegistry, Extensions as DashboardContainerExtensions } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { SingleConnectionManagementService } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import * as Constants from 'sql/platform/connection/common/constants';
import { ILogService } from 'vs/platform/log/common/log';
import { find } from 'vs/base/common/arrays';

const dashboardcontainerRegistry = Registry.as<IDashboardContainerRegistry>(DashboardContainerExtensions.dashboardContainerContributions);
const containerTypes = [
	WIDGETS_CONTAINER,
	GRID_CONTAINER,
	WEBVIEW_CONTAINER,
	MODELVIEW_CONTAINER,
	CONTROLHOST_CONTAINER,
	NAV_SECTION
];

/**
 * Validates configs to make sure nothing will error out and returns the modified widgets
 * @param config Array of widgets to validate
 */
export function removeEmpty(config: WidgetConfig[]): Array<WidgetConfig> {
	return config.filter(widget => {
		return !types.isUndefinedOrNull(widget);
	});
}

/**
 * Validates configs to make sure nothing will error out and returns the modified widgets
 * @param config Array of widgets to validate
 */
export function validateGridConfig(config: WidgetConfig[], originalConfig: WidgetConfig[]): Array<WidgetConfig> {
	return config.map((widget, index) => {
		if (widget.gridItemConfig === undefined) {
			widget.gridItemConfig = {};
		}
		const id = generateUuid();
		widget.gridItemConfig.payload = { id };
		widget.id = id;
		if (originalConfig && originalConfig[index]) {
			originalConfig[index].id = id;
		}
		return widget;
	});
}

export function initExtensionConfigs(configurations: WidgetConfig[]): Array<WidgetConfig> {
	const widgetRegistry = <IInsightRegistry>Registry.as(Extensions.InsightContribution);
	return configurations.map((config) => {
		if (config.widget && Object.keys(config.widget).length === 1) {
			const key = Object.keys(config.widget)[0];
			const insightConfig = widgetRegistry.getRegisteredExtensionInsights(key);
			if (insightConfig !== undefined) {
				// Setup the default properties for this extension if needed
				if (!config.when && insightConfig.when) {
					config.when = insightConfig.when;
				}
				if (!config.gridItemConfig && insightConfig.gridItemConfig) {
					config.gridItemConfig = {
						sizex: insightConfig.gridItemConfig.x,
						sizey: insightConfig.gridItemConfig.y
					};
				}
				if (config.gridItemConfig && !config.gridItemConfig.sizex && insightConfig.gridItemConfig && insightConfig.gridItemConfig.x) {
					config.gridItemConfig.sizex = insightConfig.gridItemConfig.x;
				}
				if (config.gridItemConfig && !config.gridItemConfig.sizey && insightConfig.gridItemConfig && insightConfig.gridItemConfig.y) {
					config.gridItemConfig.sizey = insightConfig.gridItemConfig.y;
				}
			}
		}
		return config;
	});
}

/**
 * Add provider to the passed widgets and returns the new widgets
 * @param widgets Array of widgets to add provider onto
 */
export function addProvider<T extends { connectionManagementService: SingleConnectionManagementService }>(config: WidgetConfig[], collection: T): Array<WidgetConfig> {
	const provider = collection.connectionManagementService.connectionInfo.providerId;
	return config.map((item) => {
		if (item.provider === undefined) {
			item.provider = provider;
		}
		return item;
	});
}

/**
 * Adds the edition to the passed widgets and returns the new widgets
 * @param widgets Array of widgets to add edition onto
 */
export function addEdition<T extends { connectionManagementService: SingleConnectionManagementService }>(config: WidgetConfig[], collection: T): Array<WidgetConfig> {
	const connectionInfo: ConnectionManagementInfo = collection.connectionManagementService.connectionInfo;
	if (connectionInfo.serverInfo) {
		const edition = connectionInfo.serverInfo.engineEditionId;
		return config.map((item) => {
			if (item.edition === undefined) {
				item.edition = edition;
			}
			return item;
		});
	} else {
		return config;
	}
}

/**
 * Adds the context to the passed widgets and returns the new widgets
 * @param widgets Array of widgets to add context to
 */
export function addContext(config: WidgetConfig[], collection: any, context: string): Array<WidgetConfig> {
	return config.map((item) => {
		if (item.context === undefined) {
			item.context = context;
		}
		return item;
	});
}

/**
 * Returns a filtered version of the widgets passed based on edition and provider
 * @param config widgets to filter
 */
export function filterConfigs<T extends { provider?: string | string[], when?: string }, K extends { contextKeyService: IContextKeyService }>(config: T[], collection: K): Array<T> {
	return config.filter((item) => {
		if (!hasCompatibleProvider(item.provider, collection.contextKeyService)) {
			return false;
		} else if (!item.when) {
			return true;
		} else {
			return collection.contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(item.when));
		}
	});
}

/**
 * Check whether the listed providers contain '*' indicating any provider will do, or that they are a match
 * for the currently scoped 'connectionProvider' context key.
 */
function hasCompatibleProvider(provider: string | string[], contextKeyService: IContextKeyService): boolean {
	let isCompatible = true;
	const connectionProvider = contextKeyService.getContextKeyValue<string>(Constants.connectionProviderContextKey);
	if (connectionProvider) {
		const providers = (provider instanceof Array) ? provider : [provider];
		const matchingProvider = find(providers, (p) => p === connectionProvider || p === Constants.anyProviderName);
		isCompatible = (matchingProvider !== undefined);
	}	// Else there's no connection context so skip the check
	return isCompatible;
}

/**
 * Get registered container if it is specified as the key
 * @param container dashboard container
 */
export function getDashboardContainer(container: object, logService: ILogService): { result: boolean, message: string, container: { [key: string]: any } } {
	const key = Object.keys(container)[0];
	const containerTypeFound = find(containerTypes, c => (c === key));
	if (!containerTypeFound) {
		const dashboardContainer = dashboardcontainerRegistry.getRegisteredContainer(key);
		if (!dashboardContainer) {
			const errorMessage = nls.localize('unknownDashboardContainerError', "{0} is an unknown container.", key);
			logService.error(errorMessage);
			return { result: false, message: errorMessage, container: undefined };
		} else {
			container = dashboardContainer.container;
		}
	}
	return { result: true, message: undefined, container: container };
}
