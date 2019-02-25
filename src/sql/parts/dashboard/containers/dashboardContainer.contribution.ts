/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { join } from 'path';
import { createCSSRule } from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';

import { registerContainer, generateContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { NAV_SECTION, validateNavSectionContributionAndRegisterIcon } from 'sql/parts/dashboard/containers/dashboardNavSection.contribution';
import { WIDGETS_CONTAINER, validateWidgetContainerContribution } from 'sql/parts/dashboard/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER, validateGridContainerContribution } from 'sql/parts/dashboard/containers/dashboardGridContainer.contribution';
import { WEBVIEW_CONTAINER } from 'sql/parts/dashboard/containers/dashboardWebviewContainer.contribution';

const containerTypes = [
	WIDGETS_CONTAINER,
	GRID_CONTAINER,
	WEBVIEW_CONTAINER,
	NAV_SECTION
];

export type IUserFriendlyIcon = string | { light: string; dark: string; };

export interface IDashboardContainerContrib {
	id: string;
	container: object;
}

const containerSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('sqlops.extension.contributes.dashboard.container.id', "Unique identifier for this container.")
		},
		container: {
			description: localize('sqlops.extension.contributes.dashboard.container.container', "The container that will be displayed in the tab."),
			type: 'object',
			properties: generateContainerTypeSchemaProperties()
		}
	}
};

const containerContributionSchema: IJSONSchema = {
	description: localize('sqlops.extension.contributes.containers', "Contributes a single or multiple dashboard containers for users to add to their dashboard."),
	oneOf: [
		containerSchema,
		{
			type: 'array',
			items: containerSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IDashboardContainerContrib | IDashboardContainerContrib[]>('dashboard.containers', [], containerContributionSchema).setHandler(extensions => {

	function handleCommand(dashboardContainer: IDashboardContainerContrib, extension: IExtensionPointUser<any>) {
		let { id, container } = dashboardContainer;
		if (!id) {
			extension.collector.error(localize('dashboardContainer.contribution.noIdError', 'No id in dashboard container specified for extension.'));
			return;
		}

		if (!container) {
			extension.collector.error(localize('dashboardContainer.contribution.noContainerError', 'No container in dashboard container specified for extension.'));
			return;
		}
		if (Object.keys(container).length !== 1) {
			extension.collector.error(localize('dashboardContainer.contribution.moreThanOneDashboardContainersError', 'Exactly 1 dashboard container must be defined per space.'));
			return;
		}

		let result = true;
		let containerkey = Object.keys(container)[0];
		let containerValue = Object.values(container)[0];

		let containerTypeFound = containerTypes.find(c => (c === containerkey));
		if (!containerTypeFound) {
			extension.collector.error(localize('dashboardTab.contribution.unKnownContainerType', 'Unknown container type defines in dashboard container for extension.'));
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

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardContainerContrib>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
