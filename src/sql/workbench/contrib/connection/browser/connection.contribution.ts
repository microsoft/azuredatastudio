/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { ClearRecentConnectionsAction, GetCurrentConnectionStringAction } from 'sql/workbench/services/connection/browser/connectionActions';
import * as azdata from 'azdata';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { MenuId, MenuRegistry, SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { ConnectionStatusbarItem } from 'sql/workbench/contrib/connection/browser/connectionStatus';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { integrated, azureMFA } from 'sql/platform/connection/common/constants';
import { AuthenticationType } from 'sql/workbench/services/connection/browser/connectionWidget';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { ConnectionViewletPanel } from 'sql/workbench/contrib/dataExplorer/browser/connectionViewletPanel';
import { ContextKeyEqualsExpr } from 'vs/platform/contextkey/common/contextkey';
import { ActiveConnectionsFilterAction, AddServerAction, AddServerGroupAction } from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { CONTEXT_SERVER_TREE_VIEW, CONTEXT_SERVER_TREE_HAS_CONNECTIONS } from 'sql/workbench/contrib/objectExplorer/browser/serverTreeView';
import { SqlIconId } from 'sql/base/common/codicons';

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

workbenchRegistry.registerWorkbenchContribution(ConnectionStatusbarItem, LifecyclePhase.Restored);

import 'sql/workbench/contrib/connection/common/connectionTreeProviderExentionPoint';
import { ServerTreeViewView } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';

// Connection Dashboard registration

const actionRegistry = <IWorkbenchActionRegistry>Registry.as(Extensions.WorkbenchActions);

// Connection Actions
actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		ClearRecentConnectionsAction,
		ClearRecentConnectionsAction.ID,
		ClearRecentConnectionsAction.LABEL
	),
	ClearRecentConnectionsAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		AddServerGroupAction,
		AddServerGroupAction.ID,
		AddServerGroupAction.LABEL
	),
	AddServerGroupAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		ActiveConnectionsFilterAction,
		ActiveConnectionsFilterAction.ID,
		ActiveConnectionsFilterAction.SHOW_ACTIVE_CONNECTIONS_LABEL
	),
	ActiveConnectionsFilterAction.SHOW_ACTIVE_CONNECTIONS_LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		AddServerAction,
		AddServerAction.ID,
		AddServerAction.LABEL
	),
	AddServerAction.LABEL
);

MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
	group: 'navigation',
	order: 10,
	command: {
		id: AddServerAction.ID,
		title: AddServerAction.LABEL,
		icon: { id: SqlIconId.addServerAction }
	},
	when: ContextKeyEqualsExpr.create('view', ConnectionViewletPanel.ID),
});

MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
	group: 'navigation',
	order: 20,
	command: {
		id: AddServerGroupAction.ID,
		title: AddServerGroupAction.LABEL,
		icon: { id: SqlIconId.addServerGroupAction }
	},
	when: ContextKeyEqualsExpr.create('view', ConnectionViewletPanel.ID),
});

MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
	group: 'navigation',
	order: 30,
	command: {
		id: ActiveConnectionsFilterAction.ID,
		title: ActiveConnectionsFilterAction.SHOW_ACTIVE_CONNECTIONS_LABEL,
		icon: { id: SqlIconId.activeConnectionsAction },
		precondition: CONTEXT_SERVER_TREE_HAS_CONNECTIONS,
		toggled: {
			condition: CONTEXT_SERVER_TREE_VIEW.isEqualTo(ServerTreeViewView.active),
			icon: { id: SqlIconId.serverPage },
			tooltip: ActiveConnectionsFilterAction.SHOW_ALL_CONNECTIONS_LABEL
		}
	},
	when: ContextKeyEqualsExpr.create('view', ConnectionViewletPanel.ID),
});

CommandsRegistry.registerCommand('azdata.connect',
	function (accessor, args: {
		serverName: string,
		providerName: string,
		authenticationType?: AuthenticationType,
		userName?: string,
		password?: string,
		databaseName?: string
	}) {
		const capabilitiesServices = accessor.get(ICapabilitiesService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		if (args && args.serverName && args.providerName
			&& (args.authenticationType === integrated
				|| args.authenticationType === azureMFA
				|| (args.userName && args.password))) {
			const profile: azdata.IConnectionProfile = {
				serverName: args.serverName,
				databaseName: args.databaseName,
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

			connectionManagementService.connect(connectionProfile, undefined, {
				saveTheConnection: true,
				showDashboard: true,
				params: undefined,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			});
		} else {
			connectionManagementService.showConnectionDialog();
		}
	});

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
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
			'description': localize('sql.maxRecentConnectionsDescription', "The maximum number of recently used connections to store in the connection list.")
		},
		'sql.defaultAuthenticationType': {
			'type': 'string',
			'enum': ['SqlAuth', 'AzureMFA', `AzureMFAAndUser`, 'Integrated'],
			'description': localize('sql.defaultAuthenticationTypeDescription', "Default authentication type to use when connecting to Azure resources. "),
			'enumDescriptions': [
				localize('sql.defaultAuthenticationType.SqlAuth', "Sql Login"),
				localize('sql.defaultAuthenticationType.AzureMFA', "Azure Active Directory - Universal with MFA support"),
				localize('sql.defaultAuthenticationType.AzureMFAAndUser', ""),
				localize('sql.defaultAuthenticationType.Integrated', "Windows Authentication"),
			],
			'default': 'SqlLogin'
		},
		'sql.defaultEngine': {
			'type': 'string',
			'description': localize('sql.defaultEngineDescription', "Default SQL Engine to use. This drives default language provider in .sql files and the default to use when creating a new connection."),
			'default': 'MSSQL'
		},
		'connection.parseClipboardForConnectionString': {
			'type': 'boolean',
			'default': true,
			'description': localize('connection.parseClipboardForConnectionStringDescription', "Attempt to parse the contents of the clipboard when the connection dialog is opened or a paste is performed.")
		}
	}
});
