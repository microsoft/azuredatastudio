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
		if (!container) {
			extension.collector.warn('No container specified to show.');
		}
		registerContainer({ id, container });
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
