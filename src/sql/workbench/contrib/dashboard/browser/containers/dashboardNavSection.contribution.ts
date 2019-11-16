/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { createCSSRule, asCSSUrl } from 'vs/base/browser/dom';
import { IdGenerator } from 'vs/base/common/idGenerator';
import * as resources from 'vs/base/common/resources';

import { NavSectionConfig, IUserFriendlyIcon } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { registerContainerType, generateNavSectionContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { WIDGETS_CONTAINER, validateWidgetContainerContribution } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER, validateGridContainerContribution } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardGridContainer.contribution';
import { values } from 'vs/base/common/collections';

export const NAV_SECTION = 'nav-section';

const navSectionContainerSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: nls.localize('dashboard.container.left-nav-bar.id', "Unique identifier for this nav section. Will be passed to the extension for any requests.")
		},
		icon: {
			description: nls.localize('dashboard.container.left-nav-bar.icon', "(Optional) Icon which is used to represent this nav section in the UI. Either a file path or a themeable configuration"),
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: nls.localize('dashboard.container.left-nav-bar.icon.light', "Icon path when a light theme is used"),
						type: 'string'
					},
					dark: {
						description: nls.localize('dashboard.container.left-nav-bar.icon.dark', "Icon path when a dark theme is used"),
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

const NavSectionSchema: IJSONSchema = {
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
			const path = resources.joinPath(extension.description.extensionLocation, icon);
			createCSSRule(`.codicon.${iconClass}`, `background-image: ${asCSSUrl(path)}`);
		} else {
			const light = resources.joinPath(extension.description.extensionLocation, icon.light);
			const dark = resources.joinPath(extension.description.extensionLocation, icon.dark);
			createCSSRule(`.codicon.${iconClass}`, `background-image: ${asCSSUrl(light)}`);
			createCSSRule(`.vs-dark .codicon.${iconClass}, .hc-black .codicon.${iconClass}`, `background-image: ${asCSSUrl(dark)}`);
		}
	}
	return iconClass;
}

export function validateNavSectionContributionAndRegisterIcon(extension: IExtensionPointUser<any>, navSectionConfigs: NavSectionConfig[]): boolean {
	let result = true;
	navSectionConfigs.forEach(section => {
		if (!section.title) {
			result = false;
			extension.collector.error(nls.localize('navSection.missingTitle.error', "No title in nav section specified for extension."));
		}

		if (!section.container) {
			result = false;
			extension.collector.error(nls.localize('navSection.missingContainer.error', "No container in nav section specified for extension."));
		}

		if (Object.keys(section.container).length !== 1) {
			result = false;
			extension.collector.error(nls.localize('navSection.moreThanOneDashboardContainersError', "Exactly 1 dashboard container must be defined per space."));
		}

		if (isValidIcon(section.icon, extension)) {
			section.iconClass = createCSSRuleForIcon(section.icon, extension);
		}

		const containerKey = Object.keys(section.container)[0];
		const containerValue = values(section.container)[0];

		switch (containerKey) {
			case WIDGETS_CONTAINER:
				result = result && validateWidgetContainerContribution(extension, containerValue);
				break;
			case GRID_CONTAINER:
				result = result && validateGridContainerContribution(extension, containerValue);
				break;
			case NAV_SECTION:
				result = false;
				extension.collector.error(nls.localize('navSection.invalidContainer.error', "NAV_SECTION within NAV_SECTION is an invalid container for extension."));
				break;
		}

	});
	return result;
}
