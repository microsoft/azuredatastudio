/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ConnectedContext } from 'azdata';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { BackupAction } from 'sql/workbench/parts/backup/browser/backupActions';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ItemContextKey } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerTreeContext';
import { MssqlNodeContext } from 'sql/workbench/parts/dataExplorer/browser/mssqlNodeContext';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { localize } from 'vs/nls';
import { OEAction } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { TreeNodeContextKey } from 'sql/workbench/parts/objectExplorer/common/treeNodeContextKey';
import { ConnectionContextKey } from 'sql/workbench/parts/connection/common/connectionContextKey';
import { ServerInfoContextKey } from 'sql/workbench/parts/connection/common/serverInfoContextKey';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

new BackupAction().registerTask();

// data explorer
const DE_BACKUP_COMMAND_ID = 'dataExplorer.backup';
CommandsRegistry.registerCommand({
	id: DE_BACKUP_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const commandService = accessor.get(ICommandService);
		return commandService.executeCommand(BackupAction.ID, args.$treeItem.payload);
	}
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: DE_BACKUP_COMMAND_ID,
		title: localize('backup', "Backup")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database), MssqlNodeContext.IsCloud.toNegated())
});

// oe
const OE_BACKUP_COMMAND_ID = 'objectExplorer.backup';
CommandsRegistry.registerCommand({
	id: OE_BACKUP_COMMAND_ID,
	handler: (accessor: ServicesAccessor, actionContext: any) => {
		const instantiationService = accessor.get(IInstantiationService);
		return instantiationService.createInstance(OEAction, BackupAction.ID, BackupAction.LABEL).run(actionContext);
	}
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'connection',
	order: 4,
	command: {
		id: OE_BACKUP_COMMAND_ID,
		title: localize('backup', "Backup")
	},
	when: ContextKeyExpr.and(TreeNodeContextKey.NodeType.isEqualTo(NodeType.Database), ConnectionContextKey.Provider.isEqualTo(mssqlProviderName), ServerInfoContextKey.IsCloud.toNegated())
});

// dashboard explorer
const ExplorerBackUpActionID = 'explorer.backup';
CommandsRegistry.registerCommand(ExplorerBackUpActionID, (accessor, context: ManageActionContext) => {
	const commandService = accessor.get(ICommandService);
	return commandService.executeCommand(BackupAction.ID, context.profile);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerBackUpActionID,
		title: BackupAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.isEqualTo('mssql'), ItemContextKey.IsCloud.toNegated()),
	order: 2
});
