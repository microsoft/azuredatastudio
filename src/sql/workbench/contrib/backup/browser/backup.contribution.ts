/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { BackupAction } from 'sql/workbench/contrib/backup/browser/backupActions';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { pgsqlProviderName } from 'sql/platform/connection/common/constants';
import { localize } from 'vs/nls';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';

const backupAction = new BackupAction();
backupAction.registerTask();

// data explorer
const DE_BACKUP_COMMAND_ID = 'dataExplorer.backup';
CommandsRegistry.registerCommand({
	id: DE_BACKUP_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem?.payload) {
			const capabilitiesService = accessor.get(ICapabilitiesService);
			let convertedProfile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
			backupAction.runTask(accessor, convertedProfile);
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
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(pgsqlProviderName), MssqlNodeContext.NodeType.isEqualTo(NodeType.Database))
});

// oe
const OE_BACKUP_COMMAND_ID = 'objectExplorer.backup';
CommandsRegistry.registerCommand({
	id: OE_BACKUP_COMMAND_ID,
	handler: async (accessor, args: ObjectExplorerActionsContext) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		let convertedProfile = new ConnectionProfile(capabilitiesService, args.connectionProfile);
		await backupAction.runTask(accessor, convertedProfile);
	}
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'connection',
	order: 4,
	command: {
		id: OE_BACKUP_COMMAND_ID,
		title: localize('backup', "Backup")
	},
	when: ContextKeyExpr.and(TreeNodeContextKey.NodeType.isEqualTo(NodeType.Database), ConnectionContextKey.Provider.isEqualTo(pgsqlProviderName))
});

// dashboard explorer
const ExplorerBackUpActionID = 'explorer.backup';
CommandsRegistry.registerCommand(ExplorerBackUpActionID, async (accessor, context: ManageActionContext) => {
	const capabilitiesService = accessor.get(ICapabilitiesService);
	let convertedProfile = new ConnectionProfile(capabilitiesService, context.profile);
	await backupAction.runTask(accessor, convertedProfile);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerBackUpActionID,
		title: BackupAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.isEqualTo('pgsql')),
	order: 2
});
