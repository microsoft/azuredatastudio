/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { MssqlNodeContext } from 'sql/workbench/parts/dataExplorer/browser/mssqlNodeContext';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';
import { RestoreAction } from 'sql/workbench/parts/restore/browser/restoreActions';
import { TreeNodeContextKey } from 'sql/workbench/parts/objectExplorer/common/treeNodeContextKey';
import { ObjectExplorerActionsContext } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { ConnectionContextKey } from 'sql/workbench/parts/connection/common/connectionContextKey';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { ItemContextKey } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerTreeContext';
import { ServerInfoContextKey } from 'sql/workbench/parts/connection/common/serverInfoContextKey';

new RestoreAction().registerTask();

const DE_RESTORE_COMMAND_ID = 'dataExplorer.restore';
// Restore
CommandsRegistry.registerCommand({
	id: DE_RESTORE_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand(RestoreAction.ID, args.$treeItem.payload);
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
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database), MssqlNodeContext.IsCloud.toNegated())
});

// oe
const OE_RESTORE_COMMAND_ID = 'objectExplorer.restore';
CommandsRegistry.registerCommand({
	id: OE_RESTORE_COMMAND_ID,
	handler: (accessor, args: ObjectExplorerActionsContext) => {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand(RestoreAction.ID, args.connectionProfile);
	}
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'connection',
	order: 4,
	command: {
		id: OE_RESTORE_COMMAND_ID,
		title: localize('backup', "Restore")
	},
	when: ContextKeyExpr.and(TreeNodeContextKey.NodeType.isEqualTo(NodeType.Database), ConnectionContextKey.Provider.isEqualTo(mssqlProviderName), ServerInfoContextKey.IsCloud.toNegated())
});

const ExplorerRestoreActionID = 'explorer.restore';
CommandsRegistry.registerCommand(ExplorerRestoreActionID, (accessor, context: ManageActionContext) => {
	const commandService = accessor.get(ICommandService);
	return commandService.executeCommand(RestoreAction.ID, context.profile);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerRestoreActionID,
		title: RestoreAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.isEqualTo('mssql'), ItemContextKey.IsCloud.toNegated()),
	order: 2
});
