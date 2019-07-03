/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import {
	DISCONNECT_COMMAND_ID, MANAGE_COMMAND_ID, NEW_QUERY_COMMAND_ID, REFRESH_COMMAND_ID
} from './nodeCommands';
import { ContextKeyExpr, ContextKeyRegexExpr } from 'vs/platform/contextkey/common/contextkey';
import { NodeContextKey } from 'sql/workbench/parts/dataExplorer/common/nodeContext';
import { NodeContextUtils } from 'sql/workbench/parts/dataExplorer/common/nodeContextUtils';


// Disconnect
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', 'Disconnect')
	},
	when: NodeContextKey.IsConnected //add for folders
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', 'Disconnect')
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnected,
		NodeContextUtils.NodeProvider.isEqualTo(mssqlProviderName),
		NodeContextUtils.IsDatabaseOrServer)
});

// New Query
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', 'New Query')
	},
	when: NodeContextUtils.IsDatabaseOrServer
});

// Manage
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: MANAGE_COMMAND_ID,
		title: localize('manage', 'Manage')
	},
	when: NodeContextUtils.IsDatabaseOrServer
});


// Refresh
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 6,
	command: {
		id: REFRESH_COMMAND_ID,
		title: localize('refresh', 'Refresh')
	},
	when: NodeContextKey.IsConnectable
});