/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/actionBarLabel';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor } from 'vs/workbench/browser/viewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';

import { VIEWLET_ID } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionViewlet } from 'sql/workbench/parts/connection/electron-browser/connectionViewlet';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { ToggleViewletAction } from 'vs/workbench/browser/parts/activitybar/activitybarActions';
import { IPartService } from 'vs/workbench/services/part/common/partService';

// Viewlet Action
export class OpenConnectionsViewletAction extends ToggleViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = 'Show Servers';

	constructor(
		id: string,
		label: string,
		@IViewletService viewletService: IViewletService,
		@IPartService partService: IPartService
	) {
		super(viewletDescriptor, partService, viewletService);
	}
}

// Viewlet
const viewletDescriptor = new ViewletDescriptor(
	ConnectionViewlet,
	VIEWLET_ID,
	'Servers',
	'connectionViewlet',
	0
);

if (process.env.NODE_ENV !== 'development') {
	Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(viewletDescriptor);

	Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).setDefaultViewletId(VIEWLET_ID);

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
}