/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import {
	DISCONNECT_COMMAND_ID, REFRESH_COMMAND_ID
} from './nodeCommands.common';
import { ContextKeyExpr, ContextKeyNotEqualsExpr } from 'vs/platform/contextkey/common/contextkey';
import { NodeContextKey } from 'sql/workbench/browser/parts/views/nodeContext';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';


// Disconnect
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', "Disconnect")
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnected,
		ContextKeyNotEqualsExpr.create('nodeProvider', mssqlProviderName),
		ContextKeyNotEqualsExpr.create('nodeType', NodeType.Folder))
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', "Disconnect")
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnected,
		MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.IsDatabaseOrServer)
});

// Refresh
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 6,
	command: {
		id: REFRESH_COMMAND_ID,
		title: localize('refresh', "Refresh")
	},
	when: NodeContextKey.IsConnectable
});
