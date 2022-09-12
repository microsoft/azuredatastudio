/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import * as commands from 'sql/workbench/contrib/scripting/browser/scriptingActions';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { localize } from 'vs/nls';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { EditDataAction } from 'sql/workbench/browser/scriptingActions';
import { DatabaseEngineEdition } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ServerInfoContextKey } from 'sql/workbench/services/connection/common/serverInfoContextKey';

//#region -- Data Explorer
// Script as Create
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: commands.SCRIPT_AS_CREATE_COMMAND_ID,
		title: localize('scriptAsCreate', "Script as Create")
	},
	when: MssqlNodeContext.CanScriptAsCreateOrDelete
});

// Script as Delete
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: commands.SCRIPT_AS_DELETE_COMMAND_ID,
		title: localize('scriptAsDelete', "Script as Drop")
	},
	when: MssqlNodeContext.CanScriptAsCreateOrDelete
});

// Script as Select
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: commands.SCRIPT_AS_SELECT_COMMAND_ID,
		title: localize('scriptAsSelect', "Select Top 1000")
	},
	when: MssqlNodeContext.CanScriptAsSelect
});

// Script as Execute
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: commands.SCRIPT_AS_EXECUTE_COMMAND_ID,
		title: localize('scriptAsExecute', "Script as Execute")
	},
	when: MssqlNodeContext.CanScriptAsExecute
});

// Script as Alter
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: commands.SCRIPT_AS_ALTER_COMMAND_ID,
		title: localize('scriptAsAlter', "Script as Alter")
	},
	when: MssqlNodeContext.CanScriptAsAlter
});

// Edit Data
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: commands.EDIT_DATA_COMMAND_ID,
		title: localize('editData', "Edit Data")
	},
	when:
		ContextKeyExpr.and(
			MssqlNodeContext.CanEditData,
			MssqlNodeContext.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString()),
			MssqlNodeContext.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlDataWarehouse.toString())
		)
});
//#endregion

//#region -- Object Explorer

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 1,
	command: {
		id: commands.OE_SCRIPT_AS_SELECT_COMMAND_ID,
		title: localize('scriptSelect', "Select Top 1000")
	},
	when: ContextKeyExpr.and(
		ConnectionContextKey.Provider.notEqualsTo('KUSTO'),
		ConnectionContextKey.Provider.notEqualsTo('LOGANALYTICS'),
		ContextKeyExpr.or(
			TreeNodeContextKey.NodeType.isEqualTo(NodeType.Table),
			TreeNodeContextKey.NodeType.isEqualTo(NodeType.View)
		)
	)
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 1,
	command: {
		id: commands.OE_SCRIPT_AS_SELECT_COMMAND_ID,
		title: localize('scriptKustoSelect', "Take 10")
	},
	when: ContextKeyExpr.or(
		ContextKeyExpr.and(ConnectionContextKey.Provider.isEqualTo('KUSTO'), TreeNodeContextKey.NodeType.isEqualTo(NodeType.Table)),
		ContextKeyExpr.and(ConnectionContextKey.Provider.isEqualTo('LOGANALYTICS'), TreeNodeContextKey.NodeType.isEqualTo(NodeType.Table)))
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 2,
	command: {
		id: commands.OE_EDIT_DATA_COMMAND_ID,
		title: localize('editData', "Edit Data")
	},
	when:
		ContextKeyExpr.and(
			TreeNodeContextKey.NodeType.isEqualTo(NodeType.Table),
			TreeNodeContextKey.SubType.notEqualsTo('LedgerAppendOnly'),
			TreeNodeContextKey.SubType.notEqualsTo('LedgerDropped'),
			ConnectionContextKey.Provider.notEqualsTo('KUSTO'),
			ConnectionContextKey.Provider.notEqualsTo('LOGANALYTICS'),
			ServerInfoContextKey.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString()),
			ServerInfoContextKey.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlDataWarehouse.toString())
		)
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 3,
	command: {
		id: commands.OE_SCRIPT_AS_CREATE_COMMAND_ID,
		title: localize('scriptCreate', "Script as Create")
	},
	when:
		ContextKeyExpr.and(
			ConnectionContextKey.Provider.notEqualsTo('KUSTO'),
			ConnectionContextKey.Provider.notEqualsTo('LOGANALYTICS'),
			ContextKeyExpr.or(
				ContextKeyExpr.and(
					TreeNodeContextKey.NodeType.isEqualTo(NodeType.Table),
					TreeNodeContextKey.SubType.notEqualsTo('LedgerDropped')
				),
				ContextKeyExpr.and(
					TreeNodeContextKey.NodeType.isEqualTo(NodeType.View),
					TreeNodeContextKey.SubType.notEqualsTo('Ledger'),
				),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Schema),
				ContextKeyExpr.and(TreeNodeContextKey.NodeType.isEqualTo(NodeType.User), ServerInfoContextKey.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString())),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.User),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.UserDefinedTableType),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.StoredProcedure),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.AggregateFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.PartitionFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.ScalarValuedFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.TableValuedFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Trigger),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.DatabaseTrigger),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Index),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Key),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.User),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.DatabaseRole),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.ApplicationRole)
			)
		)
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 6,
	command: {
		id: commands.OE_SCRIPT_AS_EXECUTE_COMMAND_ID,
		title: localize('scriptExecute', "Script as Execute")
	},
	when: ContextKeyExpr.or(
		ContextKeyExpr.and(ConnectionContextKey.Provider.isEqualTo('MSSQL'), TreeNodeContextKey.NodeType.isEqualTo(NodeType.StoredProcedure)),
		ContextKeyExpr.and(ConnectionContextKey.Provider.isEqualTo('KUSTO'), TreeNodeContextKey.NodeType.isEqualTo(NodeType.Function)))
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 5,
	command: {
		id: commands.OE_SCRIPT_AS_ALTER_COMMAND_ID,
		title: localize('scriptAlter', "Script as Alter")
	},
	when:
		ContextKeyExpr.or(
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.StoredProcedure)),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.View),
				TreeNodeContextKey.SubType.notEqualsTo('Ledger')),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.AggregateFunction)),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.PartitionFunction)),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.ScalarValuedFunction)),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.TableValuedFunction)),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('KUSTO'),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Function)
			)
		)
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 4,
	command: {
		id: commands.OE_SCRIPT_AS_DELETE_COMMAND_ID,
		title: localize('scriptDelete', "Script as Drop")
	},
	when:
		ContextKeyExpr.and(
			ConnectionContextKey.Provider.notEqualsTo('KUSTO'),
			ConnectionContextKey.Provider.notEqualsTo('LOGANALYTICS'),
			ContextKeyExpr.or(
				ContextKeyExpr.and(
					TreeNodeContextKey.NodeType.isEqualTo(NodeType.Table),
					TreeNodeContextKey.SubType.notEqualsTo('LedgerDropped')
				),
				ContextKeyExpr.and(
					TreeNodeContextKey.NodeType.isEqualTo(NodeType.View),
					TreeNodeContextKey.SubType.notEqualsTo('Ledger'),
				),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Schema),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.User),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.UserDefinedTableType),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.StoredProcedure),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.AggregateFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.PartitionFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.ScalarValuedFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.TableValuedFunction),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Trigger),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.DatabaseTrigger),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Index),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.Key),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.User),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.DatabaseRole),
				TreeNodeContextKey.NodeType.isEqualTo(NodeType.ApplicationRole)
			)
		)
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 7,
	command: {
		id: commands.OE_REFRESH_COMMAND_ID,
		title: localize('refreshNode', "Refresh")
	},
	when: ContextKeyExpr.or(
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.Table),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.View),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.Schema),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.User),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.UserDefinedTableType),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.StoredProcedure),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.AggregateFunction),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.PartitionFunction),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.ScalarValuedFunction),
		TreeNodeContextKey.NodeType.isEqualTo(NodeType.TableValuedFunction))
});

//#endregion

//#region -- explorer widget

CommandsRegistry.registerCommand(commands.ExplorerScriptSelectAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(commands.ExplorerScriptSelectAction, commands.ExplorerScriptSelectAction.ID, commands.ExplorerScriptSelectAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: commands.ExplorerScriptSelectAction.ID,
		title: commands.ExplorerScriptSelectAction.LABEL
	},
	when:
		ContextKeyExpr.and(
			ItemContextKey.ConnectionProvider.notEqualsTo('kusto'),
			ItemContextKey.ConnectionProvider.notEqualsTo('loganalytics'),
			ContextKeyExpr.or(
				ItemContextKey.ItemType.isEqualTo('view'),
				ItemContextKey.ItemType.isEqualTo('table')
			)
		),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: commands.ExplorerScriptSelectAction.ID,
		title: commands.ExplorerScriptSelectAction.KUSTOLABEL
	},
	when:
		ContextKeyExpr.and(
			ContextKeyExpr.or(
				ItemContextKey.ConnectionProvider.isEqualTo('kusto'),
				ItemContextKey.ConnectionProvider.isEqualTo('loganalytics')
			),
			ItemContextKey.ItemType.isEqualTo('table')
		),
	order: 2
});

const ExplorerEditDataActionID = 'explorer.editData';
CommandsRegistry.registerCommand(ExplorerEditDataActionID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(EditDataAction, EditDataAction.ID, EditDataAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerEditDataActionID,
		title: EditDataAction.LABEL
	},
	when:
		ContextKeyExpr.and(
			ItemContextKey.ItemType.isEqualTo('table'),
			MssqlNodeContext.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlOnDemand.toString()),
			ItemContextKey.ConnectionProvider.notEqualsTo('kusto'),
			ItemContextKey.ConnectionProvider.notEqualsTo('loganalytics'),
			MssqlNodeContext.EngineEdition.notEqualsTo(DatabaseEngineEdition.SqlDataWarehouse.toString())
		),
	order: 2
});

CommandsRegistry.registerCommand(commands.ExplorerScriptExecuteAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(commands.ExplorerScriptExecuteAction, commands.ExplorerScriptExecuteAction.ID, commands.ExplorerScriptExecuteAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: commands.ExplorerScriptExecuteAction.ID,
		title: commands.ExplorerScriptExecuteAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('sproc'),
	order: 2
});

CommandsRegistry.registerCommand(commands.ExplorerScriptAlterAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(commands.ExplorerScriptAlterAction, commands.ExplorerScriptAlterAction.ID, commands.ExplorerScriptAlterAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: commands.ExplorerScriptAlterAction.ID,
		title: commands.ExplorerScriptAlterAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('sproc'), ItemContextKey.ConnectionProvider.isEqualTo('mssql')),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: commands.ExplorerScriptAlterAction.ID,
		title: commands.ExplorerScriptAlterAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('function'), ItemContextKey.ConnectionProvider.isEqualTo('mssql')),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: commands.ExplorerScriptAlterAction.ID,
		title: commands.ExplorerScriptAlterAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('view'), ItemContextKey.ConnectionProvider.isEqualTo('mssql')),
	order: 2
});

CommandsRegistry.registerCommand(commands.ExplorerScriptCreateAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(commands.ExplorerScriptCreateAction, commands.ExplorerScriptCreateAction.ID, commands.ExplorerScriptCreateAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: commands.ExplorerScriptCreateAction.ID,
		title: commands.ExplorerScriptCreateAction.LABEL
	},
	when: ContextKeyExpr.and(
		ItemContextKey.ItemType.notEqualsTo('database'),
		ItemContextKey.ConnectionProvider.notEqualsTo('kusto'),
		ItemContextKey.ConnectionProvider.notEqualsTo('loganalytics')),
	order: 2
});
//#endregion
