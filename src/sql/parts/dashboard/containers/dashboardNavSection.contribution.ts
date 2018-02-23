/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

import { registerContainerType, generateNavSectionContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';

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