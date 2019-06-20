/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { AddServerGroupAction, AddServerAction } from 'sql/workbench/parts/objectExplorer/browser/connectionTreeAction';
import { ClearRecentConnectionsAction, GetCurrentConnectionStringAction } from 'sql/workbench/parts/connection/common/connectionActions';
import * as azdata from 'azdata';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import * as statusbar from 'vs/workbench/browser/parts/statusbar/statusbar';
import { StatusbarAlignment } from 'vs/platform/statusbar/common/statusbar';
import { ConnectionStatusbarItem } from 'sql/workbench/parts/connection/browser/connectionStatus';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { integrated, azureMFA } from 'sql/platform/connection/common/constants';


// Register Statusbar item
(<statusbar.IStatusbarRegistry>Registry.as(statusbar.Extensions.Statusbar)).registerStatusbarItem(new statusbar.StatusbarItemDescriptor(
	ConnectionStatusbarItem,
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

CommandsRegistry.registerCommand('azdata.connect',
	function (accessor, args) {
		const capabilitiesServices = accessor.get(ICapabilitiesService);
		const notificationService = accessor.get(INotificationService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		if (args && args.serverName && args.providerName
			&& (args.authenticationType === integrated
				|| args.authenticationType === azureMFA
				|| (args.userName && args.password))) {
			const profile: azdata.IConnectionProfile = {
				serverName: args.serverName,
				databaseName: args.database,
				authenticationType: args.authenticationType,
				providerName: args.providerName,
				connectionName: '',
				userName: args.userName,
				password: args.password,
				savePassword: true,
				groupFullName: undefined,
				saveProfile: true,
				id: undefined,
				groupId: undefined,
				options: {}
			};
			const connectionProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesServices, profile);

			connectionManagementService.connectAndSaveProfile(connectionProfile, undefined, {
				saveTheConnection: true,
				showDashboard: true,
				params: undefined,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			}).then(result => {
				if (!result.connected) {
					notificationService.error(localize('connectionFailure', 'Failed to connect to the server, error code: {0}, detail: {1}', result.errorCode, result.errorMessage));
				}
			});
		} else {
			connectionManagementService.showConnectionDialog();
		}
	});

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
