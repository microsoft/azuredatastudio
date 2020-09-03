/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtension } from 'vs/platform/configuration/common/configurationRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';

import { DATABASE_DASHBOARD_TABS } from 'sql/workbench/contrib/dashboard/browser/pages/databaseDashboardPage.contribution';
import { SERVER_DASHBOARD_TABS } from 'sql/workbench/contrib/dashboard/browser/pages/serverDashboardPage.contribution';
import { DASHBOARD_CONFIG_ID, DASHBOARD_TABS_KEY_PROPERTY } from 'sql/workbench/contrib/dashboard/browser/pages/dashboardPageContribution';
import { find } from 'vs/base/common/arrays';
import { IDashboardTab, IDashboardTabGroup } from 'sql/workbench/services/dashboard/browser/common/interfaces';
import { ILogService } from 'vs/platform/log/common/log';

export const Extensions = {
	DashboardContributions: 'dashboard.contributions'
};

export interface ServerInfo {
	[key: string]: any;
}

export interface PropertiesConfig {
	properties: Array<Property>;
}

export interface FlavorProperties {
	flavor: string;
	condition?: ConditionProperties;
	conditions?: Array<ConditionProperties>;
	databaseProperties: Array<Property>;
	serverProperties: Array<Property>;
	databasesListProperties?: Array<ObjectListViewProperty>;
	databaseListHintText?: string;
	objectsListProperties?: Array<ObjectListViewProperty>;
	objectListHintText?: string;
}

export interface ConditionProperties {
	field: string;
	operator: '==' | '<=' | '>=' | '!=';
	value: string | boolean;
}

export interface ProviderProperties {
	provider: string;
	flavors: Array<FlavorProperties>;
}

export interface Property {
	displayName: string;
	value: string;
	ignore?: Array<string>;
	default?: string;
}

export interface ObjectListViewProperty extends Property {
	widthWeight?: number;
}

export interface IDashboardRegistry {
	registerDashboardProvider(id: string, properties: ProviderProperties): void;
	getProperties(id: string): ProviderProperties;
	registerTab(tab: IDashboardTab): void;
	registerTabGroup(tabGroup: IDashboardTabGroup): void;
	tabs: Array<IDashboardTab>;
	tabGroups: Array<IDashboardTabGroup>;
}

export function getFlavor(serverInfo: ServerInfo, logService: ILogService, provider: string): FlavorProperties | undefined {
	const dashboardRegistry = Registry.as<IDashboardRegistry>(Extensions.DashboardContributions);
	const providerProperties = dashboardRegistry.getProperties(provider);

	if (!providerProperties) {
		logService.error('No property definitions found for provider', provider);
		return undefined;
	}

	let flavor: FlavorProperties;

	// find correct flavor
	if (providerProperties.flavors.length === 1) {
		flavor = providerProperties.flavors[0];
	} else if (providerProperties.flavors.length === 0) {
		logService.error('No flavor definitions found for "', provider,
			'. If there are not multiple flavors of this provider, add one flavor without a condition');
		return undefined;
	} else {
		const flavorArray = providerProperties.flavors.filter((item) => {

			// For backward compatibility we are supporting array of conditions and single condition.
			// If nothing is specified, we return false.
			if (item.conditions) {
				let conditionResult = true;
				for (let i = 0; i < item.conditions.length; i++) {
					conditionResult = conditionResult && getConditionResult(logService, serverInfo, item, item.conditions[i]);
				}

				return conditionResult;
			}
			else if (item.condition) {
				return getConditionResult(logService, serverInfo, item, item.condition);
			}
			else {
				logService.error('No condition was specified.');
				return false;
			}
		});

		if (flavorArray.length === 0) {
			logService.error('Could not determine flavor');
			return undefined;
		} else if (flavorArray.length > 1) {
			logService.error('Multiple flavors matched correctly for this provider', provider);
			return undefined;
		}

		flavor = flavorArray[0];
	}
	return flavor;
}

function getConditionResult(logService: ILogService, serverInfo: ServerInfo, item: FlavorProperties, conditionItem: ConditionProperties): boolean {
	let condition = serverInfo[conditionItem.field];

	// If we need to compare strings, then we should ensure that condition is string
	// Otherwise tripple equals/unequals would return false values
	if (typeof conditionItem.value === 'string') {
		condition = condition.toString();
	}

	switch (conditionItem.operator) {
		case '==':
			return condition === conditionItem.value;
		case '!=':
			return condition !== conditionItem.value;
		case '>=':
			return condition >= conditionItem.value;
		case '<=':
			return condition <= conditionItem.value;
		default:
			logService.error('Could not parse operator: "', conditionItem.operator,
				'" on item "', item, '"');
			return false;
	}
}

class DashboardRegistry implements IDashboardRegistry {
	private _properties = new Map<string, ProviderProperties>();
	private _tabs = new Array<IDashboardTab>();
	private _tabGroups = new Array<IDashboardTabGroup>();
	private _configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtension.Configuration);

	/**
	 * Register a dashboard widget
	 * @param id id of the widget
	*/
	public registerDashboardProvider(id: string, properties: ProviderProperties): void {
		this._properties.set(id, properties);
	}

	public getProperties(id: string): ProviderProperties {
		return this._properties.get(id);
	}

	public registerTab(tab: IDashboardTab): void {
		this._tabs.push(tab);
		let dashboardConfig = find(this._configurationRegistry.getConfigurations(), c => c.id === DASHBOARD_CONFIG_ID);

		if (dashboardConfig) {
			let dashboardDatabaseTabProperty = (<IJSONSchema>dashboardConfig.properties[DATABASE_DASHBOARD_TABS].items).properties[DASHBOARD_TABS_KEY_PROPERTY];
			dashboardDatabaseTabProperty.enum.push(tab.id);
			dashboardDatabaseTabProperty.enumDescriptions.push(tab.description || '');

			let dashboardServerTabProperty = (<IJSONSchema>dashboardConfig.properties[SERVER_DASHBOARD_TABS].items).properties[DASHBOARD_TABS_KEY_PROPERTY];
			dashboardServerTabProperty.enum.push(tab.id);
			dashboardServerTabProperty.enumDescriptions.push(tab.description || '');

			this._configurationRegistry.notifyConfigurationSchemaUpdated(dashboardConfig);
		}
	}

	registerTabGroup(tabGroup: IDashboardTabGroup): void {
		if (this.tabGroups.findIndex(group => group.id === tabGroup.id) === -1) {
			this.tabGroups.push(tabGroup);
		}
	}

	public get tabs(): Array<IDashboardTab> {
		return this._tabs;
	}

	public get tabGroups(): Array<IDashboardTabGroup> {
		return this._tabGroups;
	}
}

const dashboardRegistry = new DashboardRegistry();
Registry.add(Extensions.DashboardContributions, dashboardRegistry);

export function registerTab(tab: IDashboardTab): void {
	dashboardRegistry.registerTab(tab);
}

export function registerTabGroup(tabGroup: IDashboardTabGroup): void {
	dashboardRegistry.registerTabGroup(tabGroup);
}

const dashboardPropertiesPropertyContrib: IJSONSchema = {
	description: nls.localize('dashboard.properties.property', "Defines a property to show on the dashboard"),
	type: 'object',
	properties: {
		displayName: {
			description: nls.localize('dashboard.properties.property.displayName', "What value to use as a label for the property"),
			type: 'string'
		},
		value: {
			description: nls.localize('dashboard.properties.property.value', "What value in the object to access for the value"),
			type: 'string'
		},
		ignore: {
			description: nls.localize('dashboard.properties.property.ignore', "Specify values to be ignored"),
			type: 'array',
			items: { type: 'string' }
		},
		default: {
			description: nls.localize('dashboard.properties.property.default', "Default value to show if ignored or no value"),
			type: 'string'
		}
	}
};

const dashboardPropertyFlavorContrib: IJSONSchema = {
	description: nls.localize('dashboard.properties.flavor', "A flavor for defining dashboard properties"),
	type: 'object',
	properties: {
		id: {
			description: nls.localize('dashboard.properties.flavor.id', "Id of the flavor"),
			type: 'string'
		},
		condition: {
			description: nls.localize('dashboard.properties.flavor.condition', "Condition to use this flavor"),
			type: 'object',
			properties: {
				field: {
					description: nls.localize('dashboard.properties.flavor.condition.field', "Field to compare to"),
					type: 'string'
				},
				operator: {
					description: nls.localize('dashboard.properties.flavor.condition.operator', "Which operator to use for comparison"),
					type: 'string',
					enum: ['==', '<=', '>=', '!=']
				},
				value: {
					description: nls.localize('dashboard.properties.flavor.condition.value', "Value to compare the field to"),
					type: ['string', 'boolean']
				}
			}
		},
		databaseProperties: {
			description: nls.localize('dashboard.properties.databaseProperties', "Properties to show for database page"),
			type: 'array',
			items: dashboardPropertiesPropertyContrib
		},
		serverProperties: {
			description: nls.localize('dashboard.properties.serverProperties', "Properties to show for server page"),
			type: 'array',
			items: dashboardPropertiesPropertyContrib
		}
	}
};

const dashboardContrib: IJSONSchema = {
	description: nls.localize('carbon.extension.dashboard', "Defines that this provider supports the dashboard"),
	type: 'object',
	properties: {
		provider: {
			description: nls.localize('dashboard.id', "Provider id (ex. MSSQL)"),
			type: 'string'
		},
		flavors: {
			description: nls.localize('dashboard.properties', "Property values to show on dashboard"),
			type: 'array',
			items: dashboardPropertyFlavorContrib
		}
	}
};

ExtensionsRegistry.registerExtensionPoint<ProviderProperties | ProviderProperties[]>({ extensionPoint: 'dashboard', jsonSchema: dashboardContrib }).setHandler(extensions => {

	function handleCommand(contrib: ProviderProperties, extension: IExtensionPointUser<any>) {
		dashboardRegistry.registerDashboardProvider(contrib.provider, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<ProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
