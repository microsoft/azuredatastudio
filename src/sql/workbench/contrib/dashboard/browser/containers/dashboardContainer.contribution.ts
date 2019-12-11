/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';

import { registerContainer, generateContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { NAV_SECTION, validateNavSectionContributionAndRegisterIcon } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardNavSection.contribution';
import { WIDGETS_CONTAINER, validateWidgetContainerContribution } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER, validateGridContainerContribution } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardGridContainer.contribution';
import { WEBVIEW_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWebviewContainer.contribution';
import { values } from 'vs/base/common/collections';
import { find } from 'vs/base/common/arrays';
import { NavSectionConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';

const containerTypes = [
	WIDGETS_CONTAINER,
	GRID_CONTAINER,
	WEBVIEW_CONTAINER,
	NAV_SECTION
];

export type IUserFriendlyIcon = string | { light: string; dark: string; };

export interface IDashboardContainerContrib {
	id: string;
	container: Record<string, NavSectionConfig[]>;
}

const containerSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('azdata.extension.contributes.dashboard.container.id', "Unique identifier for this container.")
		},
		container: {
			description: localize('azdata.extension.contributes.dashboard.container.container', "The container that will be displayed in the tab."),
			type: 'object',
			properties: generateContainerTypeSchemaProperties()
		}
	}
};

const containerContributionSchema: IJSONSchema = {
	description: localize('azdata.extension.contributes.containers', "Contributes a single or multiple dashboard containers for users to add to their dashboard."),
	oneOf: [
		containerSchema,
		{
			type: 'array',
			items: containerSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IDashboardContainerContrib | IDashboardContainerContrib[]>({ extensionPoint: 'dashboard.containers', jsonSchema: containerContributionSchema }).setHandler(extensions => {

	function handleCommand(dashboardContainer: IDashboardContainerContrib, extension: IExtensionPointUser<any>) {
		const { id, container } = dashboardContainer;
		if (!id) {
			extension.collector.error(localize('dashboardContainer.contribution.noIdError', "No id in dashboard container specified for extension."));
			return;
		}

		if (!container) {
			extension.collector.error(localize('dashboardContainer.contribution.noContainerError', "No container in dashboard container specified for extension."));
			return;
		}
		if (Object.keys(container).length !== 1) {
			extension.collector.error(localize('dashboardContainer.contribution.moreThanOneDashboardContainersError', "Exactly 1 dashboard container must be defined per space."));
			return;
		}

		let result = true;
		const containerkey = Object.keys(container)[0];
		const containerValue = values(container)[0];

		const containerTypeFound = find(containerTypes, c => c === containerkey);
		if (!containerTypeFound) {
			extension.collector.error(localize('dashboardTab.contribution.unKnownContainerType', "Unknown container type defines in dashboard container for extension."));
			return;
		}

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
			registerContainer({ id, container });
		}
	}

	for (const extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardContainerContrib>(value)) {
			for (const command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
