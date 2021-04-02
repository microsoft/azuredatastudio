/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Extensions, IConfigurationRegistry, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import * as nls from 'vs/nls';

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);

const chartsConfiguration: IConfigurationNode = {
	id: 'charts',
	type: 'object',
	title: nls.localize('chartsConfigurationTitle', "Built-in Charts"),
	properties: {
		'charts.maxRowCount': {
			type: 'number',
			default: 300,
			description: nls.localize('charts.maxRowCountDescription', "The maximum number of rows for charts to display. Warning: increasing this may impact performance.")
		}
	}
};

configurationRegistry.registerConfiguration(chartsConfiguration);
