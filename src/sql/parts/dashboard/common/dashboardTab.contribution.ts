/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';

import * as Constants from 'sql/platform/connection/common/constants';
import { registerTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { generateContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { NAV_SECTION, validateNavSectionContributionAndRegisterIcon } from 'sql/parts/dashboard/containers/dashboardNavSection.contribution';
import { WIDGETS_CONTAINER, validateWidgetContainerContribution } from 'sql/parts/dashboard/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER, validateGridContainerContribution } from 'sql/parts/dashboard/containers/dashboardGridContainer.contribution';

export interface IDashboardTabContrib {
	id: string;
	title: string;
	container: object;
	provider: string | string[];
	when?: string;
	description?: string;
	alwaysShow?: boolean;
	isHomeTab?: boolean;
}

const tabSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('sqlops.extension.contributes.dashboard.tab.id', "Unique identifier for this tab. Will be passed to the extension for any requests.")
		},
		title: {
			type: 'string',
			description: localize('sqlops.extension.contributes.dashboard.tab.title', "Title of the tab to show the user.")
		},
		description: {
			description: localize('sqlops.extension.contributes.dashboard.tab.description', "Description of this tab that will be shown to the user."),
			type: 'string'
		},
		when: {
			description: localize('sqlops.extension.contributes.tab.when', 'Condition which must be true to show this item'),
			type: 'string'
		},
		provider: {
			description: localize('sqlops.extension.contributes.tab.provider', 'Defines the connection types this tab is compatible with. Defaults to "MSSQL" if not set'),
			type: ['string', 'array']

		},
		container: {
			description: localize('sqlops.extension.contributes.dashboard.tab.container', "The container that will be displayed in this tab."),
			type: 'object',
			properties: generateContainerTypeSchemaProperties()
		},
		alwaysShow: {
			description: localize('sqlops.extension.contributes.dashboard.tab.alwaysShow', "Whether or not this tab should always be shown or only when the user adds it."),
			type: 'boolean'
		},
		isHomeTab: {
			description: localize('sqlops.extension.contributes.dashboard.tab.isHomeTab', "Whether or not this tab should be used as the Home tab for a connection type."),
			type: 'boolean'
		}
	}
};

const tabContributionSchema: IJSONSchema = {
	description: localize('sqlops.extension.contributes.tabs', "Contributes a single or multiple tabs for users to add to their dashboard."),
	oneOf: [
		tabSchema,
		{
			type: 'array',
			items: tabSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IDashboardTabContrib | IDashboardTabContrib[]>('dashboard.tabs', [], tabContributionSchema).setHandler(extensions => {

	function handleCommand(tab: IDashboardTabContrib, extension: IExtensionPointUser<any>) {
		let { description, container, provider, title, when, id, alwaysShow, isHomeTab } = tab;

		// If always show is not specified, set it to true by default.
		if (!types.isBoolean(alwaysShow)) {
			alwaysShow = true;
		}
		let publisher = extension.description.publisher;
		if (!title) {
			extension.collector.error(localize('dashboardTab.contribution.noTitleError', 'No title specified for extension.'));
			return;
		}

		if (!description) {
			extension.collector.warn(localize('dashboardTab.contribution.noDescriptionWarning', 'No description specified to show.'));
		}

		if (!container) {
			extension.collector.error(localize('dashboardTab.contribution.noContainerError', 'No container specified for extension.'));
			return;
		}

		if (!provider) {
			// Use a default. Consider warning extension developers about this in the future if in development mode
			provider = Constants.mssqlProviderName;
			// Cannot be a home tab if it did not specify a provider
			isHomeTab = false;
		}

		if (Object.keys(container).length !== 1) {
			extension.collector.error(localize('dashboardTab.contribution.moreThanOneDashboardContainersError', 'Exactly 1 dashboard container must be defined per space'));
			return;
		}

		let result = true;
		let containerkey = Object.keys(container)[0];
		let containerValue = Object.values(container)[0];

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

		if (result) {
			registerTab({ description, title, container, provider, when, id, alwaysShow, publisher, isHomeTab });
		}
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardTabContrib>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
