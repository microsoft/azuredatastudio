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
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { localize } from 'vs/nls';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { ServerInfoContextKey } from 'sql/workbench/services/connection/common/serverInfoContextKey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { DatabaseEngineEdition } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

const backupAction = new BackupAction();

// data explorer
const DE_BACKUP_COMMAND_ID = 'dataExplorer.backup';
CommandsRegistry.registerCommand({
	id: DE_BACKUP_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem?.payload) {
			const connectionService = accessor.get(IConnectionManagementService);
			const capabilitiesService = accessor.get(ICapabilitiesService);
			let profile = await connectionService.fixProfile(args.$treeItem.payload);
			let convertedProfile = new ConnectionProfile(capabilitiesService, profile);
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
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.notEqualsTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database), MssqlNodeContext.IsCloud.toNegated(), MssqlNodeContext.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString()))
});

// oe
const OE_BACKUP_COMMAND_ID = 'objectExplorer.backup';
CommandsRegistry.registerCommand({
	id: OE_BACKUP_COMMAND_ID,
	handler: (accessor: ServicesAccessor, actionContext: any) => {
		backupAction.runTask(accessor);
	}
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'connection',
	order: 4,
	command: {
		id: OE_BACKUP_COMMAND_ID,
		title: localize('backup', "Backup")
	},
	when: ContextKeyExpr.and(TreeNodeContextKey.NodeType.isEqualTo(NodeType.Database), ConnectionContextKey.Provider.notEqualsTo(mssqlProviderName),
		ServerInfoContextKey.IsCloud.toNegated(), ServerInfoContextKey.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString()))
});

// dashboard explorer
const ExplorerBackUpActionID = 'explorer.backup';
CommandsRegistry.registerCommand(ExplorerBackUpActionID, async (accessor, context: ManageActionContext) => {
	const connectionService = accessor.get(IConnectionManagementService);
	const capabilitiesService = accessor.get(ICapabilitiesService);
	let profile = await connectionService.fixProfile(context.profile);
	let convertedProfile = new ConnectionProfile(capabilitiesService, profile);
	backupAction.runTask(accessor, convertedProfile);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerBackUpActionID,
		title: BackupAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.notEqualsTo('mssql'),
		ItemContextKey.IsCloud.toNegated(), ItemContextKey.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString())),
	order: 2
});
