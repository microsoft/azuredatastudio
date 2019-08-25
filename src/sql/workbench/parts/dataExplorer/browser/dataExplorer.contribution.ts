/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/actionBarLabel';
import 'vs/css!./media/dataExplorer.contribution';
import { localize } from 'vs/nls';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor } from 'vs/workbench/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { DataExplorerViewlet, DataExplorerViewletViewsContribution, OpenDataExplorerViewletAction, VIEWLET_ID } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerViewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { DataExplorerContainerExtensionHandler } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerExtensionPoint';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { EditServerGroupAction, AddServerAction, DeleteConnectionGroupAction, DisconnectConnectionAction, DeleteConnectionAction } from 'sql/workbench/parts/objectExplorer/browser/connectionTreeAction';
import { isServerGroup, TreeNodeContextKey } from 'sql/workbench/parts/objectExplorer/common/treeNodeContextKey';
import { ConnectionContextKey } from 'sql/workbench/parts/connection/common/connectionContextKey';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { RefreshAction } from 'sql/workbench/parts/objectExplorer/browser/actions';

// Data Explorer Viewlet
const viewletDescriptor = new ViewletDescriptor(
	DataExplorerViewlet,
	VIEWLET_ID,
	localize('workbench.dataExplorer', "Connections"),
	'dataExplorer',
	0
);

Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(viewletDescriptor);
Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).setDefaultViewletId(VIEWLET_ID);
const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(DataExplorerViewletViewsContribution, LifecyclePhase.Starting);
const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	new SyncActionDescriptor(
		OpenDataExplorerViewletAction,
		OpenDataExplorerViewletAction.ID,
		OpenDataExplorerViewletAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_D }),
	'View: Show Data Explorer',
	localize('dataExplorer.view', "View")
);

let configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'databaseConnections',
	'order': 0,
	'title': localize('databaseConnections', "Database Connections"),
	'type': 'object',
	'properties': {
		'datasource.connections': {
			'description': localize('datasource.connections', "data source connections"),
			'type': 'array'
		},
		'datasource.connectionGroups': {
			'description': localize('datasource.connectionGroups', "data source groups"),
			'type': 'array'
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

CommandsRegistry.registerCommand(AddServerAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	return instantiationService.createInstance(AddServerAction, AddServerAction.ID, AddServerAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	command: {
		id: AddServerAction.ID,
		title: AddServerAction.LABEL
	},
	when: isServerGroup,
	group: 'servergroup',
	order: 0
});

CommandsRegistry.registerCommand(EditServerGroupAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	return instantiationService.createInstance(EditServerGroupAction, EditServerGroupAction.ID, EditServerGroupAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	command: {
		id: EditServerGroupAction.ID,
		title: EditServerGroupAction.LABEL
	},
	when: isServerGroup,
	group: 'servergroup',
	order: 1
});

CommandsRegistry.registerCommand(DeleteConnectionGroupAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	return instantiationService.createInstance(DeleteConnectionGroupAction, DeleteConnectionGroupAction.ID, DeleteConnectionGroupAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	command: {
		id: DeleteConnectionGroupAction.ID,
		title: DeleteConnectionGroupAction.LABEL
	},
	when: isServerGroup,
	group: 'servergroup',
	order: 2
});

CommandsRegistry.registerCommand(DisconnectConnectionAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	return instantiationService.createInstance(DisconnectConnectionAction, DisconnectConnectionAction.ID, DisconnectConnectionAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	command: {
		id: DisconnectConnectionAction.ID,
		title: DisconnectConnectionAction.LABEL
	},
	when: ContextKeyExpr.and(ConnectionContextKey.IsConnected, TreeNodeContextKey.NodeLabel.isEqualTo('')), // kind of a hacky way to see if this is a profile
	group: 'connection',
	order: 0
});

CommandsRegistry.registerCommand(DeleteConnectionAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	return instantiationService.createInstance(DeleteConnectionAction, DeleteConnectionAction.ID, DeleteConnectionAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	command: {
		id: DeleteConnectionAction.ID,
		title: DeleteConnectionAction.LABEL
	},
	when: TreeNodeContextKey.NodeLabel.isEqualTo(''), // kind of a hacky way to see if this is a profile
	group: 'connection',
	order: 1
});

CommandsRegistry.registerCommand(RefreshAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	return instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	command: {
		id: RefreshAction.ID,
		title: RefreshAction.LABEL
	},
	when: TreeNodeContextKey.NodeLabel.isEqualTo(''), // kind of a hacky way to see if this is a profile
	group: 'connection',
	order: 1
});
