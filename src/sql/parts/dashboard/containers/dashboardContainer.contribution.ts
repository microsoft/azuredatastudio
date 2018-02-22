/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { join } from 'path';
import { createCSSRule } from 'vs/base/browser/dom';
import URI from 'vs/base/common/uri';

import { registerContainer, generateContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';

export type IUserFriendlyIcon = string | { light: string; dark: string; };

export interface IDashboardContainerContrib {
	id: string;
	title: string;
	icon?: IUserFriendlyIcon;
	container: object;
}

const containerSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('sqlops.extension.contributes.dashboard.container.id', "Unique identifier for this inner tab. Will be passed to the extension for any requests.")
		},
		icon: {
			description: localize('sqlops.extension.contributes.dashboard.container.icon', '(Optional) Icon which is used to represent this inner tab in the UI. Either a file path or a themable configuration'),
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: localize('carbon.extension.contributes.account.icon.light', 'Icon path when a light theme is used'),
						type: 'string'
					},
					dark: {
						description: localize('carbon.extension.contributes.account.icon.dark', 'Icon path when a dark theme is used'),
						type: 'string'
					}
				}
			}]
		},
		title: {
			type: 'string',
			description: localize('sqlops.extension.contributes.dashboard.container.title', "Title of the inner tab to show the user.")
		},
		container: {
			description: localize('sqlops.extension.contributes.dashboard.container.container', "The container that will be displayed in this inner tab."),
			type: 'object',
			properties: generateContainerTypeSchemaProperties()
		}
	}
};

const containerContributionSchema: IJSONSchema = {
	description: localize('sqlops.extension.contributes.containers', "Contributes a single or multiple inner tabs for users to add to their dashboard."),
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
		let { title, id, container, icon } = dashboardContainer;
		if (!title) {
			extension.collector.error('No title specified for extension.');
			return;
		}
		if (!container) {
			extension.collector.warn('No container specified to show.');
		}

		let iconClass: string;
		if (icon) {
			iconClass = id;
			if (typeof icon === 'string') {
				const path = join(extension.description.extensionFolderPath, icon);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(path).toString()}")`);
			} else {
				const light = join(extension.description.extensionFolderPath, icon.light);
				const dark = join(extension.description.extensionFolderPath, icon.dark);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(light).toString()}")`);
				createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${URI.file(dark).toString()}")`);
			}
		}

		registerContainer({ title, id, container, hasIcon: !!icon });
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
