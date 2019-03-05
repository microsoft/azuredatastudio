/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/actionBarLabel';
import { localize } from 'vs/nls';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor } from 'vs/workbench/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { VIEWLET_ID } from 'sql/parts/dataExplorer/common/dataExplorerExtensionPoint';
import { DataExplorerViewlet, DataExplorerViewletViewsContribution } from 'sql/parts/dataExplorer/viewlet/dataExplorerViewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { OpenConnectionsViewletAction } from 'sql/parts/objectExplorer/common/registeredServer.contribution';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';

// Data Explorer Viewlet
const viewletDescriptor = new ViewletDescriptor(
	DataExplorerViewlet,
	VIEWLET_ID,
	localize('workbench.dataExplorer', 'Data Explorer'),
	'dataExplorer',
	0
);

if (process.env.NODE_ENV === 'development') {
	Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(viewletDescriptor);
	Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).setDefaultViewletId(VIEWLET_ID);
	const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
	workbenchRegistry.registerWorkbenchContribution(DataExplorerViewletViewsContribution, LifecyclePhase.Starting);
	const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
	registry.registerWorkbenchAction(
		new SyncActionDescriptor(
			OpenConnectionsViewletAction,
			OpenConnectionsViewletAction.ID,
			OpenConnectionsViewletAction.LABEL,
			{ primary: KeyMod.CtrlCmd | KeyCode.Shift | KeyCode.KEY_C }),
		'View: Show Servers',
		localize('registeredServers.view', "View")
	);

	let configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);

	// Server explorer connections
	configurationRegistry.registerConfiguration({
		'id': 'databaseConnections',
		'order': 0,
		'title': localize('databaseConnections', 'Database Connections'),
		'type': 'object',
		'properties': {
			'datasource.connections': {
				'description': localize('datasource.connections', 'data source connections'),
				'type': 'array'
			},
			'datasource.connectionGroups': {
				'description': localize('datasource.connectionGroups', 'data source groups'),
				'type': 'array'
			}
		}
	});
	configurationRegistry.registerConfiguration({
		'id': 'startupConfig',
		'title': localize('startupConfig', 'Startup Configuration'),
		'type': 'object',
		'properties': {
			'startup.alwaysShowServersView': {
				'type': 'boolean',
				'description': localize('startup.alwaysShowServersView', 'True for the Servers view to be shown on launch of Azure Data Studio default; false if the last opened view should be shown'),
				'default': true
			}
		}
	});

	// CMS connections
	configurationRegistry.registerConfiguration({
		'id': 'cmsServers',
		'order': 1,
		'title': localize('cmsServers', 'cms servers'),
		'type': 'object',
		'properties': {
			'cms.cmsServers': {
				'description': localize('cms.cmsServers', 'Central Management Servers'),
				'type': 'object'
			}
		}
	});
}