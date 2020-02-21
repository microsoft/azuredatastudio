/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { registerToolbarHomeAction } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';

export interface IDashboardToolbarHomeActionContrib {
	name: string
	when?: string;
}

const toolbarHomeActionSchema: IJSONSchema = {
	type: 'object',
	properties: {
		name: {
			description: localize('azdata.extension.contributes.toolbarHomeAction.name', "Name of task that executes when this item is clicked"),
			type: 'string'
		},
		when: {
			description: localize('azdata.extension.contributes.toolbarHomeAction.when', "Condition which must be true to show this item"),
			type: 'string'
		}
	}
};

const toolbarHomeActionContributionSchema: IJSONSchema = {
	description: localize('azdata.extension.contributes.toolbarHomeAction', "Contributes a single or multiple actions for users to add to their dashboard home toolbar."),
	oneOf: [
		toolbarHomeActionSchema,
		{
			type: 'array',
			items: toolbarHomeActionSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IDashboardToolbarHomeActionContrib | IDashboardToolbarHomeActionContrib[]>({ extensionPoint: 'dashboard.toolbarHomeActions', jsonSchema: toolbarHomeActionContributionSchema }).setHandler(extensions => {

	function handleToolbarHomeAction(toolbarAction: IDashboardToolbarHomeActionContrib, extension: IExtensionPointUser<any>) {
		let { name, when } = toolbarAction;

		if (!name) {
			extension.collector.error(localize('dashboardToolbarHomeAction.contribution.noNameError', "No name specified for extension toolbar action."));
			return;
		}

		registerToolbarHomeAction({ name, when });
	}

	for (const extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IDashboardToolbarHomeActionContrib>(value)) {
			for (const command of value) {
				handleToolbarHomeAction(command, extension);
			}
		} else {
			handleToolbarHomeAction(value, extension);
		}
	}
});
