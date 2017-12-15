/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';

import { ProviderProperties } from 'sql/parts/dashboard/widgets/properties/propertiesWidget.component';

export const Extensions = {
	DashboardContributions: 'dashboard.contributions'
};

export interface IDashboardRegistry {
	registerDashboardProvider(id: string, properties: ProviderProperties): void;
	getProperties(id: string): ProviderProperties;
}

class DashboardRegistry implements IDashboardRegistry {
	private _properties = new Map<string, ProviderProperties>();

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
}

const dashboardRegistry = new DashboardRegistry();
Registry.add(Extensions.DashboardContributions, dashboardRegistry);

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
			description: nls.localize('dashboard.properties.flavor.id', 'Id of the flavor'),
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

ExtensionsRegistry.registerExtensionPoint<ProviderProperties | ProviderProperties[]>('dashboard', [], dashboardContrib).setHandler(extensions => {

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