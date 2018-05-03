/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IConfigurationRegistry, Extensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);

export const SERVER_GROUP_CONFIG = 'serverGroup';
export const SERVER_GROUP_COLORS_CONFIG = 'colors';
export const SERVER_GROUP_AUTOEXPAND_CONFIG = 'autoExpand';

const serverGroupConfig: IConfigurationNode = {
	id: 'Server Groups',
	type: 'object',
	properties: {
		[SERVER_GROUP_CONFIG + '.' + SERVER_GROUP_COLORS_CONFIG]: <IJSONSchema>{
			type: 'array',
			items: 'string',
			'description': localize('serverGroup.colors', 'Server Group color palette used in the Object Explorer viewlet.'),
			default: [
				'#A1634D',
				'#7F0000',
				'#914576',
				'#85AE72',
				'#98AFC7',
				'#4452A6',
				'#6A6599',
				'#515151'
			]
		},
		[SERVER_GROUP_CONFIG + '.' + SERVER_GROUP_AUTOEXPAND_CONFIG]: {
			'type': 'boolean',
			'description': localize('serverGroup.autoExpand', 'Auto-expand Server Groups in the Object Explorer viewlet.'),
			'default': 'true'
		},
	}
};

configurationRegistry.registerConfiguration(serverGroupConfig);