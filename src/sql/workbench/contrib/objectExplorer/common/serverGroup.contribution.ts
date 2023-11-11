/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationRegistry, Extensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { SERVER_GROUP_CONFIG, SERVER_GROUP_COLORS_CONFIG } from 'sql/workbench/services/serverGroup/common/interfaces';
import { DefaultServerGroupColor } from 'sql/workbench/services/serverGroup/common/serverGroupViewModel';

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);

export const SERVER_GROUP_AUTOEXPAND_CONFIG = 'autoExpand';

const serverGroupConfig: IConfigurationNode = {
	id: 'serverGroup',
	type: 'object',
	title: localize('objectExplorerConfigurationTitle', "Object Explorer"),
	order: 2,
	properties: {
		[`${SERVER_GROUP_CONFIG}.${SERVER_GROUP_AUTOEXPAND_CONFIG}`]: {
			'order': 2,
			'type': 'boolean',
			'description': localize('serverGroup.autoExpand', "Auto-expand Server Groups in the Object Explorer viewlet."),
			'default': 'true'
		},
		[`${SERVER_GROUP_CONFIG}.${SERVER_GROUP_COLORS_CONFIG}`]: <IJSONSchema>{
			type: 'array',
			items: 'string',
			order: 3,
			'description': localize('serverGroup.colors', "Server Group color palette used in the Object Explorer viewlet."),
			default: [
				'#A1634D',
				'#7F0000',
				'#914576',
				'#6E9B59',
				'#5F82A5',
				'#4452A6',
				'#6A6599',
				DefaultServerGroupColor
			]
		},
	}
};

export const USE_ASYNC_SERVER_TREE_CONFIG = 'serverTree.useAsyncServerTree';
const serverTreeConfig: IConfigurationNode = {
	'id': 'serverTree',
	'title': localize('serverTree.configuration.title', "Server Tree"),
	'type': 'object',
	'order': 1,
	'properties': {
		[`serverTree.useAsyncServerTree`]: {
			'type': 'boolean',
			'default': true,
			'description': localize('serverTree.useAsyncServerTree', "Use the new async server tree for the Servers view and Connection Dialog with support for new features such as dynamic node filtering. Requires a restart to take effect.")
		}
	}
};

configurationRegistry.registerConfiguration(serverTreeConfig);
configurationRegistry.registerConfiguration(serverGroupConfig);
