/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { DISCONNECT_COMMAND_ID, MANAGE_COMMAND_ID, NEW_QUERY_COMMAND_ID, REFRESH_COMMAND_ID } from './nodeCommands';
import { ContextKeyExpr, ContextKeyRegexExpr } from 'vs/platform/contextkey/common/contextkey';
import { NodeContextKey } from 'sql/workbench/parts/dataExplorer/common/nodeContext';

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', 'Disconnect')
	},
	when: NodeContextKey.IsConnected
});

// The weird regex is because we want this to generically apply to Database and Server nodes but right now
// there isn't a consistent standard for the values there. We can't just search for database or server being
// in the string at all because there's lots of node types which have those values (such as ServerLevelLogin)
// that we don't want these menu items showing up on.
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', 'New Query')
	},
	when: NodeContextKey.IsDatabaseOrServer
});

// Note that we don't show this for Databases under Server nodes (viewItem == Database) because
// of an issue there where the connection always being master instead of the actual DB
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: MANAGE_COMMAND_ID,
		title: localize('manage', 'Manage')
	},
	when: NodeContextKey.IsDatabaseOrServer
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: REFRESH_COMMAND_ID,
		title: localize('refresh', 'Refresh')
	},
	when: NodeContextKey.IsConnected
});
