/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { ClearRecentConnectionsAction, GetCurrentConnectionStringAction } from 'sql/workbench/services/connection/browser/connectionActions';
import * as azdata from 'azdata';
import { Action2, MenuId, MenuRegistry, registerAction2 } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { ConnectionStatusbarItem } from 'sql/workbench/contrib/connection/browser/connectionStatus';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ConnectionType, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { ConnectionViewletPanel } from 'sql/workbench/contrib/dataExplorer/browser/connectionViewletPanel';
import { ContextKeyEqualsExpr } from 'vs/platform/contextkey/common/contextkey';
import { ActiveConnectionsFilterAction, AddServerAction, AddServerGroupAction } from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { CONTEXT_SERVER_TREE_VIEW, CONTEXT_SERVER_TREE_HAS_CONNECTIONS } from 'sql/workbench/contrib/objectExplorer/browser/serverTreeView';
import { SqlIconId } from 'sql/base/common/codicons';
import * as Utils from 'sql/platform/connection/common/utils';

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

workbenchRegistry.registerWorkbenchContribution(ConnectionStatusbarItem, LifecyclePhase.Restored);

import 'sql/workbench/contrib/connection/common/connectionTreeProviderExentionPoint';
import { IObjectExplorerService, ServerTreeViewView } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { AuthenticationType } from 'sql/platform/connection/common/constants';
import { Codicon } from 'vs/base/common/codicons';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';

// Connection Dashboard registration


// Connection Actions

registerAction2(ClearRecentConnectionsAction);

registerAction2(AddServerGroupAction);

registerAction2(ActiveConnectionsFilterAction);

registerAction2(AddServerAction);

MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
	group: 'navigation',
	order: 1,
	command: {
		id: AddServerAction.ID,
		title: AddServerAction.LABEL,
		icon: { id: SqlIconId.addServerAction }
	},
	when: ContextKeyEqualsExpr.create('view', ConnectionViewletPanel.ID),
});

MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
	group: 'navigation',
	order: 2,
	command: {
		id: AddServerGroupAction.ID,
		title: AddServerGroupAction.LABEL,
		icon: { id: SqlIconId.addServerGroupAction }
	},
	when: ContextKeyEqualsExpr.create('view', ConnectionViewletPanel.ID),
});

MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
	group: 'navigation',
	order: 3,
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

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'registeredServers.collapseAll',
			title: localize('registeredServers.collapseAll', "Collapse All Connections"),
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyEqualsExpr.create('view', ConnectionViewletPanel.ID),
				group: 'navigation',
				order: Number.MAX_SAFE_INTEGER - 1,
			},
			icon: Codicon.collapseAll
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const objectExplorerService = accessor.get(IObjectExplorerService);
		await objectExplorerService.getServerTreeView().collapseAllConnections();
	}
});

CommandsRegistry.registerCommand('azdata.connect',
	function (accessor, args: {
		serverName: string,
		providerName: string,
		authenticationType?: AuthenticationType,
		userName?: string,
		password?: string,
		databaseName?: string,
		options?: { [name: string]: any }
	}) {
		const capabilitiesServices = accessor.get(ICapabilitiesService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		if (args && args.serverName && args.providerName
			&& (args.authenticationType === AuthenticationType.Integrated
				|| args.authenticationType === AuthenticationType.AzureMFA
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
				groupId: Utils.defaultGroupId,
				options: args.options
			};
			const connectionProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesServices, profile);
			const root = connectionManagementService.getConnectionGroups().filter(g => g.id === Utils.defaultGroupId)[0];
			connectionProfile.parent = root;
			connectionProfile.groupFullName = root.fullName;
			connectionManagementService.connect(connectionProfile, undefined, {
				saveTheConnection: true,
				showDashboard: true,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true,
				params: {
					connectionType: ConnectionType.default,
				}
			});
		} else {
			connectionManagementService.showConnectionDialog(undefined, {
				saveTheConnection: true,
				showDashboard: true,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true,
				params: {
					connectionType: ConnectionType.default,
				}
			});
		}
	});

registerAction2(GetCurrentConnectionStringAction);

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
			'enum': [AuthenticationType.SqlLogin, AuthenticationType.AzureMFA, AuthenticationType.AzureMFAAndUser, AuthenticationType.Integrated],
			'description': localize('sql.defaultAuthenticationTypeDescription', "Default authentication type to use when connecting to Azure resources. "),
			'enumDescriptions': [
				localize('sql.defaultAuthenticationType.SqlLogin', "Sql Login"),
				localize('sql.defaultAuthenticationType.AzureMFA', "Microsoft Entra ID - Universal with MFA support"),
				localize('sql.defaultAuthenticationType.AzureMFAAndUser', "Microsoft Entra ID - Password"),
				localize('sql.defaultAuthenticationType.Integrated', "Windows Authentication"),
			],
			'default': AuthenticationType.AzureMFA
		},
		'sql.defaultEngine': {
			'type': 'string',
			'description': localize('sql.defaultEngineDescription', "Default SQL Engine to use. This drives default language provider in .sql files and the default to use when creating a new connection."),
			'default': 'MSSQL'
		},
		'connection.showUnsupportedServerVersionWarning': {
			'type': 'boolean',
			'default': true,
			'description': localize('connection.showUnsupportedServerVersionWarning', "Whether to show the warning message when user connects to a server version that is not supported by Azure Data Studio.")
		}
	}
});
