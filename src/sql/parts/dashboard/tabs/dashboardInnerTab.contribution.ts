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

import { registerInnerTab, generateInnerTabContentSchemaProperties } from 'sql/platform/dashboard/common/innerTabRegistry';

export type IUserFriendlyIcon = string | { light: string; dark: string; };

export interface IDashboardInnerTabContrib {
	id: string;
	title: string;
	icon?: IUserFriendlyIcon;
	content: object;
}

const innerTabSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('sqlops.extension.contributes.dashboard.innertab.id', "Unique identifier for this inner tab. Will be passed to the extension for any requests.")
		},
		icon: {
			description: localize('sqlops.extension.contributes.dashboard.innertab.icon', '(Optional) Icon which is used to represent this inner tab in the UI. Either a file path or a themable configuration'),
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
			description: localize('sqlops.extension.contributes.dashboard.innertab.title', "Title of the inner tab to show the user.")
		},
		content: {
			description: localize('sqlops.extension.contributes.dashboard.innertab.content', "The content that will be displayed in this inner tab."),
			type: 'object',
			properties: generateInnerTabContentSchemaProperties()
		}
	}
};

const innerTabContributionSchema: IJSONSchema = {
	description: localize('sqlops.extension.contributes.innertabs', "Contributes a single or multiple inner tabs for users to add to their dashboard."),
	oneOf: [
		innerTabSchema,
		{
			type: 'array',
			items: innerTabSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IDashboardInnerTabContrib | IDashboardInnerTabContrib[]>('dashboard.innertabs', [], innerTabContributionSchema).setHandler(extensions => {

	function handleCommand(innerTab: IDashboardInnerTabContrib, extension: IExtensionPointUser<any>) {
		let { title, id, content, icon } = innerTab;
		if (!title) {
			extension.collector.error('No title specified for extension.');
			return;
		}
		if (!content) {
			extension.collector.warn('No content specified to show.');
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

		registerInnerTab({ title, id, content, hasIcon: !!icon });
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardInnerTabContrib>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
