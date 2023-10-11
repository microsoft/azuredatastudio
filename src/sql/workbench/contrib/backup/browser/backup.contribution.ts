/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { BackupAction } from 'sql/workbench/contrib/backup/browser/backupActions';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { localize } from 'vs/nls';
import { OEAction } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { ServerInfoContextKey } from 'sql/workbench/services/connection/common/serverInfoContextKey';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DatabaseEngineEdition } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';

new BackupAction().registerTask();

// data explorer
const DE_BACKUP_COMMAND_ID = 'dataExplorer.backup';
CommandsRegistry.registerCommand({
	id: DE_BACKUP_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem?.payload) {
			const commandService = accessor.get(ICommandService);
			const connectionService = accessor.get(IConnectionManagementService);
			let payload = await connectionService.fixProfile(args.$treeItem.payload);
			return commandService.executeCommand(BackupAction.ID, payload);
		}
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
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database), MssqlNodeContext.IsCloud.toNegated(), MssqlNodeContext.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString()))
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
	when: ContextKeyExpr.and(TreeNodeContextKey.NodeType.isEqualTo(NodeType.Database), ConnectionContextKey.Provider.isEqualTo(mssqlProviderName),
		ServerInfoContextKey.IsCloud.toNegated(), ServerInfoContextKey.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString()))
});

// dashboard explorer
const ExplorerBackUpActionID = 'explorer.backup';
CommandsRegistry.registerCommand(ExplorerBackUpActionID, async (accessor, context: ManageActionContext) => {
	const commandService = accessor.get(ICommandService);
	const connectionService = accessor.get(IConnectionManagementService);
	let profile = await connectionService.fixProfile(context.profile);
	return commandService.executeCommand(BackupAction.ID, profile);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerBackUpActionID,
		title: BackupAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.isEqualTo('mssql'),
		ItemContextKey.IsCloud.toNegated(), ItemContextKey.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString())),
	order: 2
});
