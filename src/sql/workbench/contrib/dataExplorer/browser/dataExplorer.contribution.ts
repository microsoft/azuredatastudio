/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { DataExplorerContainerExtensionHandler } from 'sql/workbench/contrib/dataExplorer/browser/dataExplorerExtensionPoint';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { DataExplorerViewletViewsContribution } from 'sql/workbench/contrib/dataExplorer/browser/dataExplorerViewlet';
import { GROUPS_CONFIG_KEY, CONNECTIONS_CONFIG_KEY, CONNECTIONS_SORT_BY_CONFIG_KEY, ConnectionsSortOrder } from 'sql/platform/connection/common/connectionConfig';

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
			'description': localize('datasource.connections', "data source connections"),
			'type': 'array'
		},
		[GROUPS_CONFIG_KEY]: {
			'description': localize('datasource.connectionGroups', "data source groups"),
			'type': 'array'
		},
		[CONNECTIONS_SORT_BY_CONFIG_KEY]: {
			'type': 'string',
			'enum': [ConnectionsSortOrder.dateAdded, ConnectionsSortOrder.displayName],
			'enumDescriptions': [
				localize('connectionsSortOrder.dateAdded', 'Saved connections are sorted by the dates they were added.'),
				localize('connectionsSortOrder.displayName', 'Saved connections are sorted by their display names alphabetically.')
			],
			'default': ConnectionsSortOrder.dateAdded,
			'description': localize('datasource.connectionsSortOrder', "Controls sorting order of saved connections and connection groups.")
		}
	}
});
configurationRegistry.registerConfiguration({
	'id': 'startupConfig',
	'title': localize('startupConfig', "Startup Configuration"),
	'type': 'object',
	'order': 0,
	'properties': {
		'startup.alwaysShowServersView': {
			'type': 'boolean',
			'description': localize('startup.alwaysShowServersView', "True for the Servers view to be shown on launch of Azure Data Studio default; false if the last opened view should be shown"),
			'default': true
		}
	}
});

workbenchRegistry.registerWorkbenchContribution(DataExplorerContainerExtensionHandler, LifecyclePhase.Starting);
