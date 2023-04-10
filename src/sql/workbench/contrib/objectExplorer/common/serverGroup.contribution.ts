/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
	id: 'Server Groups',
	type: 'object',
	properties: {
		[SERVER_GROUP_CONFIG + '.' + SERVER_GROUP_COLORS_CONFIG]: <IJSONSchema>{
			type: 'array',
			items: 'string',
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
		[SERVER_GROUP_CONFIG + '.' + SERVER_GROUP_AUTOEXPAND_CONFIG]: {
			'type': 'boolean',
			'description': localize('serverGroup.autoExpand', "Auto-expand Server Groups in the Object Explorer viewlet."),
			'default': 'true'
		},
	}
};

export const NODE_EXPANSION_CONFIG = 'serverTree.nodeExpansionTimeout';
const serverTreeConfig: IConfigurationNode = {
	'id': 'serverTree',
	'title': localize('serverTree.configuration.title', "Server Tree"),
	'type': 'object',
	'properties': {
		'serverTree.useAsyncServerTree': {
			'type': 'boolean',
			'default': true,
			'description': localize('serverTree.useAsyncServerTree', "Use the new async server tree for the Servers view and Connection Dialog with support for new features such as dynamic node filtering.")
		},
		'serverTree.nodeExpansionTimeout': {
			'type': 'number',
			'default': '45',
			'description': localize('serverTree.nodeExpansionTimeout', "The timeout in seconds for expanding a node in the Servers view"),
			'minimum': 1
		}
	}
};

configurationRegistry.registerConfiguration(serverGroupConfig);
configurationRegistry.registerConfiguration(serverTreeConfig);
