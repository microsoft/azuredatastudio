/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { join } from 'path';
import { createCSSRule } from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';
import { IdGenerator } from 'vs/base/common/idGenerator';

import { NavSectionConfig, IUserFriendlyIcon } from 'sql/parts/dashboard/common/dashboardWidget';
import { registerContainerType, generateNavSectionContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { WIDGETS_CONTAINER, validateWidgetContainerContribution } from 'sql/parts/dashboard/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER, validateGridContainerContribution } from 'sql/parts/dashboard/containers/dashboardGridContainer.contribution';

export const NAV_SECTION = 'nav-section';

const navSectionContainerSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: nls.localize('dashboard.container.left-nav-bar.id', "Unique identifier for this nav section. Will be passed to the extension for any requests.")
		},
		icon: {
			description: nls.localize('dashboard.container.left-nav-bar.icon', '(Optional) Icon which is used to represent this nav section in the UI. Either a file path or a themeable configuration'),
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: nls.localize('dashboard.container.left-nav-bar.icon.light', 'Icon path when a light theme is used'),
						type: 'string'
					},
					dark: {
						description: nls.localize('dashboard.container.left-nav-bar.icon.dark', 'Icon path when a dark theme is used'),
						type: 'string'
					}
				}
			}]
		},
		title: {
			type: 'string',
			description: nls.localize('dashboard.container.left-nav-bar.title', "Title of the nav section to show the user.")
		},
		container: {
			description: nls.localize('dashboard.container.left-nav-bar.container', "The container that will be displayed in this nav section."),
			type: 'object',
			properties: generateNavSectionContainerTypeSchemaProperties()
		}
	}
};

let NavSectionSchema: IJSONSchema = {
	type: 'array',
	description: nls.localize('dashboard.container.left-nav-bar', "The list of dashboard containers that will be displayed in this navigation section."),
	items: navSectionContainerSchema
};

registerContainerType(NAV_SECTION, NavSectionSchema);

function isValidIcon(icon: IUserFriendlyIcon, extension: IExtensionPointUser<any>): boolean {
	if (typeof icon === 'undefined') {
		return false;
	}
	if (typeof icon === 'string') {
		return true;
	} else if (typeof icon.dark === 'string' && typeof icon.light === 'string') {
		return true;
	}
	extension.collector.error(nls.localize('opticon', "property `icon` can be omitted or must be either a string or a literal like `{dark, light}`"));
	return false;
}

const ids = new IdGenerator('contrib-dashboardNavSection-icon-');

function createCSSRuleForIcon(icon: IUserFriendlyIcon, extension: IExtensionPointUser<any>): string {
	let iconClass: string;
	if (icon) {
		iconClass = ids.nextId();
		if (typeof icon === 'string') {
			const path = join(extension.description.extensionLocation.fsPath, icon);
			createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(path).toString()}")`);
		} else {
			const light = join(extension.description.extensionLocation.fsPath, icon.light);
			const dark = join(extension.description.extensionLocation.fsPath, icon.dark);
			createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(light).toString()}")`);
			createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${URI.file(dark).toString()}")`);
		}
	}
	return iconClass;
}

export function validateNavSectionContributionAndRegisterIcon(extension: IExtensionPointUser<any>, navSectionConfigs: NavSectionConfig[]): boolean {
	let result = true;
	navSectionConfigs.forEach(section => {
		if (!section.title) {
			result = false;
			extension.collector.error(nls.localize('navSection.missingTitle_error', 'No title in nav section specified for extension.'));
		}

		if (!section.container) {
			result = false;
			extension.collector.error(nls.localize('navSection.missingContainer_error', 'No container in nav section specified for extension.'));
		}

		if (Object.keys(section.container).length !== 1) {
			result = false;
			extension.collector.error(nls.localize('navSection.moreThanOneDashboardContainersError', 'Exactly 1 dashboard container must be defined per space.'));
		}

		if (isValidIcon(section.icon, extension)) {
			section.iconClass = createCSSRuleForIcon(section.icon, extension);
		}

		let containerKey = Object.keys(section.container)[0];
		let containerValue = Object.values(section.container)[0];

		switch (containerKey) {
			case WIDGETS_CONTAINER:
				result = result && validateWidgetContainerContribution(extension, containerValue);
				break;
			case GRID_CONTAINER:
				result = result && validateGridContainerContribution(extension, containerValue);
				break;
			case NAV_SECTION:
				result = false;
				extension.collector.error(nls.localize('navSection.invalidContainer_error', 'NAV_SECTION within NAV_SECTION is an invalid container for extension.'));
				break;
		}

	});
	return result;
}