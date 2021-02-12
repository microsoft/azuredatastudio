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
				'#85AE72',
				'#98AFC7',
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

const serverTreeConfig: IConfigurationNode = {
	'id': 'serverTree',
	'title': 'Server Tree',
	'type': 'object',
	'properties': {
		'serverTree.useAsyncServerTree': {
			'type': 'boolean',
			'default': false,
			'description': localize('serverTree.useAsyncServerTree', "(Preview) Use the new async server tree for the Servers view and Connection Dialog with support for new features such as dynamic node filtering.")
		}
	}
};

configurationRegistry.registerConfiguration(serverGroupConfig);
configurationRegistry.registerConfiguration(serverTreeConfig);
