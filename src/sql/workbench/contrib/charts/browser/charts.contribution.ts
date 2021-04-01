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
	title: nls.localize('chartsConfigurationTitle', "Charts"),
	properties: {
		'charts.maxRowCount': {
			type: 'number',
			default: 300,
			description: nls.localize('charts.maxRowCountDescription', "Maximum allowed rows for charts to render, this is introduced to prevent the application hang. If exceeded, ADS will only take the first N rows for chart rendering.")
		}
	}
};

configurationRegistry.registerConfiguration(chartsConfiguration);
