/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';

import { registerTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { generateContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';

export interface IDashboardTabContrib {
	id: string;
	title: string;
	container: object;
	description?: string;
	provider?: string | string[];
	edition?: number | number[];
	alwaysShow?: boolean;
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
		provider: {
			description: localize('sqlops.extension.contributes.dashboard.tab.provider', "Providers for which this tab should be allowed for."),
			anyOf: [
				{
					type: 'string'
				},
				{
					type: 'array',
					items: {
						type: 'string'
					}
				}
			]
		},
		edition: {
			description: localize('sqlops.extension.contributes.dashboard.tab.edition', "Editions for which this tab should be allowed for."),
			anyOf: [
				{
					type: 'number'
				},
				{
					type: 'array',
					items: {
						type: 'number'
					}
				}
			]
		},
		container: {
			description: localize('sqlops.extension.contributes.dashboard.tab.container', "The container that will be displayed in this tab."),
			type: 'object',
			properties: generateContainerTypeSchemaProperties()
		},
		alwaysShow: {
			description: localize('sqlops.extension.contributes.dashboard.tab.alwaysShow', "Whether or not this tab should always be shown or only when the user adds it."),
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
		let { description, container, title, edition, provider, id, alwaysShow } = tab;
		alwaysShow = alwaysShow || false;
		let publisher = extension.description.publisher;
		if (!title) {
			extension.collector.error('No title specified for extension.');
			return;
		}
		if (!description) {
			extension.collector.warn('No description specified to show.');
		}
		if (!container) {
			extension.collector.warn('No container specified to show.');
		}
		registerTab({ description, title, container, edition, provider, id, alwaysShow, publisher });
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
