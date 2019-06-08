/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { AddServerGroupAction, AddServerAction } from 'sql/workbench/parts/objectExplorer/browser/connectionTreeAction';
import { ClearRecentConnectionsAction, GetCurrentConnectionStringAction } from 'sql/workbench/parts/connection/common/connectionActions';

import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import * as statusbar from 'vs/workbench/browser/parts/statusbar/statusbar';
import { StatusbarAlignment } from 'vs/platform/statusbar/common/statusbar';
import { ConnectionStatusbarItem } from 'sql/workbench/parts/connection/browser/connectionStatus';


// Register Statusbar item
(<statusbar.IStatusbarRegistry>Registry.as(statusbar.Extensions.Statusbar)).registerStatusbarItem(new statusbar.StatusbarItemDescriptor(
	ConnectionStatusbarItem,
	{ id: 'status.connection', label: localize('status.connection', "Connection") },
	StatusbarAlignment.RIGHT,
	100 /* High Priority */
));

// Connection Dashboard registration

const actionRegistry = <IWorkbenchActionRegistry>Registry.as(Extensions.WorkbenchActions);

// Connection Actions
actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		ClearRecentConnectionsAction,
		ClearRecentConnectionsAction.ID,
		ClearRecentConnectionsAction.LABEL
	),
	ClearRecentConnectionsAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		AddServerGroupAction,
		AddServerGroupAction.ID,
		AddServerGroupAction.LABEL
	),
	AddServerGroupAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		AddServerAction,
		AddServerAction.ID,
		AddServerAction.LABEL
	),
	AddServerAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		GetCurrentConnectionStringAction,
		GetCurrentConnectionStringAction.ID,
		GetCurrentConnectionStringAction.LABEL
	),
	GetCurrentConnectionStringAction.LABEL
);

const configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'connection',
	'title': 'Connection',
	'type': 'object',
	'properties': {
		'sql.maxRecentConnections': {
			'type': 'number',
			'default': 25,
			'description': localize('sql.maxRecentConnectionsDescription', 'The maximum number of recently used connections to store in the connection list.')
		},
		'sql.defaultEngine': {
			'type': 'string',
			'description': localize('sql.defaultEngineDescription', 'Default SQL Engine to use. This drives default language provider in .sql files and the default to use when creating a new connection. Valid option is currently MSSQL'),
			'default': 'MSSQL'
		},
		'connection.parseClipboardForConnectionString': {
			'type': 'boolean',
			'default': true,
			'description': localize('connection.parseClipboardForConnectionStringDescription', 'Attempt to parse the contents of the clipboard when the connection dialog is opened or a paste is performed.')
		}
	}
});
