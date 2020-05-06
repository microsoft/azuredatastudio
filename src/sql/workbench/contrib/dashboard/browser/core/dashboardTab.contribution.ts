/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';

import * as Constants from 'sql/platform/connection/common/constants';
import { registerTab, registerTabGroup } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { generateContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { NAV_SECTION, validateNavSectionContributionAndRegisterIcon } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardNavSection.contribution';
import { WIDGETS_CONTAINER, validateWidgetContainerContribution } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER, validateGridContainerContribution } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardGridContainer.contribution';
import { values } from 'vs/base/common/collections';
import { IUserFriendlyIcon } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { isValidIcon, createCSSRuleForIcon } from 'sql/workbench/contrib/dashboard/browser/dashboardIconUtil';
import { IDashboardTabGroup, IDashboardTab } from 'sql/workbench/services/dashboard/browser/common/interfaces';

export interface IDashboardTabContrib {
	id: string;
	title: string;
	container: { [key: string]: any };
	provider: string | string[];
	when?: string;
	description?: string;
	alwaysShow?: boolean;
	isHomeTab?: boolean;
	group?: string;
	icon?: IUserFriendlyIcon;
}

export interface IDashboardTabGroupContrib {
	id: string;
	title: string;
}

const tabSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('azdata.extension.contributes.dashboard.tab.id', "Unique identifier for this tab. Will be passed to the extension for any requests.")
		},
		title: {
			type: 'string',
			description: localize('azdata.extension.contributes.dashboard.tab.title', "Title of the tab to show the user.")
		},
		description: {
			description: localize('azdata.extension.contributes.dashboard.tab.description', "Description of this tab that will be shown to the user."),
			type: 'string'
		},
		when: {
			description: localize('azdata.extension.contributes.tab.when', "Condition which must be true to show this item"),
			type: 'string'
		},
		provider: {
			description: localize('azdata.extension.contributes.tab.provider', "Defines the connection types this tab is compatible with. Defaults to 'MSSQL' if not set"),
			type: ['string', 'array']

		},
		container: {
			description: localize('azdata.extension.contributes.dashboard.tab.container', "The container that will be displayed in this tab."),
			type: 'object',
			properties: generateContainerTypeSchemaProperties()
		},
		alwaysShow: {
			description: localize('azdata.extension.contributes.dashboard.tab.alwaysShow', "Whether or not this tab should always be shown or only when the user adds it."),
			type: 'boolean'
		},
		isHomeTab: {
			description: localize('azdata.extension.contributes.dashboard.tab.isHomeTab', "Whether or not this tab should be used as the Home tab for a connection type."),
			type: 'boolean'
		},
		group: {
			description: localize('azdata.extension.contributes.dashboard.tab.group', "The unique identifier of the group this tab belongs to, value for home group: home."),
			type: 'string'
		},
		icon: {
			description: localize('dazdata.extension.contributes.dashboard.tab.icon', "(Optional) Icon which is used to represent this tab in the UI. Either a file path or a themeable configuration"),
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: localize('azdata.extension.contributes.dashboard.tab.icon.light', "Icon path when a light theme is used"),
						type: 'string'
					},
					dark: {
						description: localize('azdata.extension.contributes.dashboard.tab.icon.dark', "Icon path when a dark theme is used"),
						type: 'string'
					}
				}
			}]
		}
	}
};

const tabContributionSchema: IJSONSchema = {
	description: localize('azdata.extension.contributes.tabs', "Contributes a single or multiple tabs for users to add to their dashboard."),
	oneOf: [
		tabSchema,
		{
			type: 'array',
			items: tabSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IDashboardTabContrib | IDashboardTabContrib[]>({ extensionPoint: 'dashboard.tabs', jsonSchema: tabContributionSchema }).setHandler(extensions => {

	function handleTab(tab: IDashboardTabContrib, extension: IExtensionPointUser<any>) {
		let { description, container, provider, title, when, id, alwaysShow, isHomeTab, group, icon } = tab;

		// If always show is not specified, set it to true by default.
		if (!types.isBoolean(alwaysShow)) {
			alwaysShow = true;
		}
		const publisher = extension.description.publisher;
		if (!title) {
			extension.collector.error(localize('dashboardTab.contribution.noTitleError', "No title specified for extension."));
			return;
		}

		if (!description) {
			extension.collector.warn(localize('dashboardTab.contribution.noDescriptionWarning', "No description specified to show."));
		}

		if (!container) {
			extension.collector.error(localize('dashboardTab.contribution.noContainerError', "No container specified for extension."));
			return;
		}

		if (!provider) {
			// Use a default. Consider warning extension developers about this in the future if in development mode
			provider = Constants.mssqlProviderName;
			// Cannot be a home tab if it did not specify a provider
			isHomeTab = false;
		}

		if (Object.keys(container).length !== 1) {
			extension.collector.error(localize('dashboardTab.contribution.moreThanOneDashboardContainersError', "Exactly 1 dashboard container must be defined per space"));
			return;
		}

		let result = true;
		const containerkey = Object.keys(container)[0];
		const containerValue = values(container)[0];

		switch (containerkey) {
			case WIDGETS_CONTAINER:
				result = validateWidgetContainerContribution(extension, containerValue);
				break;
			case GRID_CONTAINER:
				result = validateGridContainerContribution(extension, containerValue);
				break;
			case NAV_SECTION:
				result = validateNavSectionContributionAndRegisterIcon(extension, containerValue);
				break;
		}

		let iconClass = undefined;
		if (isValidIcon(icon, extension)) {
			iconClass = createCSSRuleForIcon(icon, extension);
		}
		if (result) {
			registerTab({ description, title, container, provider, when, id, alwaysShow, publisher, isHomeTab, group, iconClass });
		}
	}

	for (const extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardTabContrib>(value)) {
			for (const command of value) {
				handleTab(command, extension);
			}
		} else {
			handleTab(value, extension);
		}
	}
});

const tabGroupSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('azdata.extension.contributes.dashboard.tabGroup.id', "Unique identifier for this tab group.")
		},
		title: {
			type: 'string',
			description: localize('azdata.extension.contributes.dashboard.tabGroup.title', "Title of the tab group.")
		}
	}
};

const tabGroupContributionSchema: IJSONSchema = {
	description: localize('azdata.extension.contributes.tabGroups', "Contributes a single or multiple tab groups for users to add to their dashboard."),
	oneOf: [
		tabGroupSchema,
		{
			type: 'array',
			items: tabGroupSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IDashboardTabContrib | IDashboardTabContrib[]>({ extensionPoint: 'dashboard.tabGroups', jsonSchema: tabGroupContributionSchema }).setHandler(extensions => {

	function handleTabGroup(tabgroup: IDashboardTabGroupContrib, extension: IExtensionPointUser<any>) {
		let { id, title } = tabgroup;

		if (!id) {
			extension.collector.error(localize('dashboardTabGroup.contribution.noIdError', "No id specified for tab group."));
			return;
		}

		if (!title) {
			extension.collector.error(localize('dashboardTabGroup.contribution.noTitleError', "No title specified for tab group."));
			return;
		}
		registerTabGroup({ id, title });
	}

	for (const extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardTabGroupContrib>(value)) {
			for (const command of value) {
				handleTabGroup(command, extension);
			}
		} else {
			handleTabGroup(value, extension);
		}
	}
});

/**
 * Predefined tab groups
 */
const PredefinedTabGroups: IDashboardTabGroup[] = [
	{
		id: 'administration',
		title: localize('administrationTabGroup', "Administration")
	}, {
		id: 'monitoring',
		title: localize('monitoringTabGroup', "Monitoring")
	}, {
		id: 'performance',
		title: localize('performanceTabGroup', "Performance")
	}, {
		id: 'security',
		title: localize('securityTabGroup', "Security")
	}, {
		id: 'troubleshooting',
		title: localize('troubleshootingTabGroup', "Troubleshooting")
	}, {
		id: 'settings',
		title: localize('settingsTabGroup', "Settings")
	}
];

PredefinedTabGroups.forEach(tabGroup => registerTabGroup(tabGroup));

/**
 * Common Tabs
 */
const CommonTabs: IDashboardTab[] = [
	{
		id: 'databasesTab',
		description: localize('databasesTabDescription', "databases tab"),
		provider: 'MSSQL',
		title: localize('databasesTabTitle', "Databases"),
		when: 'dashboardContext == \'server\' && !mssql:iscloud && mssql:engineedition != 11',
		group: 'home',
		iconClass: 'database-colored',
		publisher: undefined,
		container: {
			'widgets-container': [
				{
					gridItemConfig: {
						sizex: 3,
						sizey: 2
					},
					widget: {
						'explorer-widget': {}
					},
					hideHeader: true
				}
			]
		}
	}
];

CommonTabs.forEach(tab => registerTab(tab));
