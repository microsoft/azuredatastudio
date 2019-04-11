/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { DISCONNECT_COMMAND_ID, MANAGE_COMMAND_ID, NEW_QUERY_COMMAND_ID, REFRESH_COMMAND_ID } from './nodeCommands';
import { ContextKeyDefinedExpr, ContextKeyExpr, ContextKeyEqualsExpr } from 'vs/platform/contextkey/common/contextkey';

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', 'Disconnect')
	},
	when: ContextKeyExpr.and(
		new ContextKeyDefinedExpr('isConnected'),
		new ContextKeyEqualsExpr('isConnected', true))
});

// For Database nodes under a Server in the SQL Servers folder
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', 'New Query')
	},
	when: ContextKeyExpr.and(
		new ContextKeyDefinedExpr('isConnectable'),
		new ContextKeyEqualsExpr('isConnectable', true),
		new ContextKeyDefinedExpr('viewItem'),
		new ContextKeyEqualsExpr('viewItem', 'Database'))
});

// For database nodes under the SQL Databases folder
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', 'New Query')
	},
	when: ContextKeyExpr.and(
		new ContextKeyDefinedExpr('isConnectable'),
		new ContextKeyEqualsExpr('isConnectable', true),
		new ContextKeyDefinedExpr('viewItem'),
		new ContextKeyEqualsExpr('viewItem', 'azure.resource.itemType.database'))
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	command: {
		id: NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', 'New Query')
	},
	when: ContextKeyExpr.and(
		new ContextKeyDefinedExpr('isConnectable'),
		new ContextKeyEqualsExpr('isConnectable', true),
		new ContextKeyDefinedExpr('viewItem'),
		new ContextKeyEqualsExpr('viewItem', 'azure.resource.itemType.databaseServer'))
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: MANAGE_COMMAND_ID,
		title: localize('manage', 'Manage')
	},
	when: ContextKeyExpr.and(
		new ContextKeyDefinedExpr('isConnectable'),
		new ContextKeyEqualsExpr('isConnectable', true),
		new ContextKeyDefinedExpr('viewItem'),
		new ContextKeyEqualsExpr('viewItem', 'azure.resource.itemType.databaseServer'))
});

// For database nodes under the SQL Databases folder
// Note that we don't show this for Databases under Server nodes because of an issue there
// where the connection always being master instead of the actual DB
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: MANAGE_COMMAND_ID,
		title: localize('manage', 'Manage')
	},
	when: ContextKeyExpr.and(
		new ContextKeyDefinedExpr('isConnectable'),
		new ContextKeyEqualsExpr('isConnectable', true),
		new ContextKeyDefinedExpr('viewItem'),
		new ContextKeyEqualsExpr('viewItem', 'azure.resource.itemType.database'))
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: REFRESH_COMMAND_ID,
		title: localize('refresh', 'Refresh')
	}
});
