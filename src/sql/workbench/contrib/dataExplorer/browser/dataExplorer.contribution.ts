/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dataExplorer.contribution';
import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { DataExplorerContainerExtensionHandler } from 'sql/workbench/contrib/dataExplorer/browser/dataExplorerExtensionPoint';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { DataExplorerViewletViewsContribution } from 'sql/workbench/contrib/dataExplorer/browser/dataExplorerViewlet';
import { GROUPS_CONFIG_KEY, CONNECTIONS_CONFIG_KEY, CONNECTION_SORT_BY_CONFIG_KEY } from 'sql/platform/connection/common/connectionConfig';

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(DataExplorerViewletViewsContribution, LifecyclePhase.Starting);

let configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'databaseConnections',
	'order': 0,
	'title': localize('databaseConnections', "Database Connections"),
	'type': 'object',
	'properties': {
		[CONNECTIONS_CONFIG_KEY]: {
			'description': localize(CONNECTIONS_CONFIG_KEY, "data source connections"),
			'type': 'array'
		},
		[GROUPS_CONFIG_KEY]: {
			'description': localize(GROUPS_CONFIG_KEY, "data source groups"),
			'type': 'array'
		},
		[CONNECTION_SORT_BY_CONFIG_KEY]: {
			'type': 'string',
			'enum': ['DateAdded', 'DisplayName'],
			'enumDescriptions': [
				localize('sortBy.DateAdded', 'Saved connections are sorted by the date they were added.'),
				localize('sortBy.DisplayName', 'Saved connections are sorted by their display name alphabetically.')
			],
			'default': 'byTimeAdded',
			'description': localize(CONNECTION_SORT_BY_CONFIG_KEY, "Order used for sorting saved connections and connection groups")
		}
	}
});
configurationRegistry.registerConfiguration({
	'id': 'startupConfig',
	'title': localize('startupConfig', "Startup Configuration"),
	'type': 'object',
	'properties': {
		'startup.alwaysShowServersView': {
			'type': 'boolean',
			'description': localize('startup.alwaysShowServersView', "True for the Servers view to be shown on launch of Azure Data Studio default; false if the last opened view should be shown"),
			'default': true
		}
	}
});

workbenchRegistry.registerWorkbenchContribution(DataExplorerContainerExtensionHandler, LifecyclePhase.Starting);
