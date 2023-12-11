/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { pgsqlProviderName } from 'sql/platform/connection/common/constants';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { RestoreAction } from 'sql/workbench/contrib/restore/browser/restoreActions';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';

new RestoreAction().registerTask();

const DE_RESTORE_COMMAND_ID = 'dataExplorer.restore';
// Restore
CommandsRegistry.registerCommand({
	id: DE_RESTORE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem?.payload) {
			const commandService = accessor.get(ICommandService);
			const connectionService = accessor.get(IConnectionManagementService);
			let payload = await connectionService.fixProfile(args.$treeItem.payload);
			return commandService.executeCommand(RestoreAction.ID, payload);
		}
	}
});

// Restore Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: DE_RESTORE_COMMAND_ID,
		title: localize('restore', "Restore")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(pgsqlProviderName), MssqlNodeContext.NodeType.isEqualTo(NodeType.Database))
});

// oe
const OE_RESTORE_COMMAND_ID = 'objectExplorer.restore';
CommandsRegistry.registerCommand({
	id: OE_RESTORE_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const commandService = accessor.get(ICommandService);
		const connectionService = accessor.get(IConnectionManagementService);
		let profile = await connectionService.fixProfile(args.connectionProfile);
		return commandService.executeCommand(RestoreAction.ID, profile);
	}
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'connection',
	order: 4,
	command: {
		id: OE_RESTORE_COMMAND_ID,
		title: localize('backup', "Restore")
	},
	when: ContextKeyExpr.and(TreeNodeContextKey.NodeType.isEqualTo(NodeType.Database), ConnectionContextKey.Provider.isEqualTo(pgsqlProviderName))
});

const ExplorerRestoreActionID = 'explorer.restore';
CommandsRegistry.registerCommand(ExplorerRestoreActionID, async (accessor, context: ManageActionContext) => {
	const commandService = accessor.get(ICommandService);
	const connectionService = accessor.get(IConnectionManagementService);
	let profile = await connectionService.fixProfile(context.profile);
	return commandService.executeCommand(RestoreAction.ID, profile);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerRestoreActionID,
		title: RestoreAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.isEqualTo('pgsql')),
	order: 2
});
