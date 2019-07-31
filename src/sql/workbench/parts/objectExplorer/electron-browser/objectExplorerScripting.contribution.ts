/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SCRIPT_AS_SELECT_COMMAND_ID, EDIT_DATA_COMMAND_ID, SCRIPT_AS_CREATE_COMMAND_ID, SCRIPT_AS_EXECUTE_COMMAND_ID, SCRIPT_AS_ALTER_COMMAND_ID, SCRIPT_AS_DELETE_COMMAND_ID } from 'sql/workbench/parts/objectExplorer/electron-browser/objectExplorerScriptingActions';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { ConnectionContextKey } from 'sql/workbench/parts/connection/common/connectionContextKey';
import { TreeNodeContextKey } from 'sql/workbench/parts/objectExplorer/common/treeNodeContextKey';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'scripting',
	order: 3,
	command: {
		id: SCRIPT_AS_SELECT_COMMAND_ID,
		title: localize('scriptSelect', "Select Top 1000")
	},
	when: ContextKeyExpr.or(TreeNodeContextKey.NodeType.isEqualTo('Table'), TreeNodeContextKey.NodeType.isEqualTo('View'))
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'scripting',
	order: 3,
	command: {
		id: EDIT_DATA_COMMAND_ID,
		title: localize('editData', "Edit Data")
	},
	when: TreeNodeContextKey.NodeType.isEqualTo('Table')
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'scripting',
	order: 3,
	command: {
		id: SCRIPT_AS_CREATE_COMMAND_ID,
		title: localize('scriptCreate', "Script as Create")
	},
	when: ContextKeyExpr.or(
		TreeNodeContextKey.NodeType.isEqualTo('Table'),
		TreeNodeContextKey.NodeType.isEqualTo('View'),
		TreeNodeContextKey.NodeType.isEqualTo('Schema'),
		TreeNodeContextKey.NodeType.isEqualTo('User'),
		TreeNodeContextKey.NodeType.isEqualTo('UserDefinedTableType'),
		TreeNodeContextKey.NodeType.isEqualTo('StoredProcedure'),
		TreeNodeContextKey.NodeType.isEqualTo('AggregateFunction'),
		TreeNodeContextKey.NodeType.isEqualTo('PartitionFunction'),
		TreeNodeContextKey.NodeType.isEqualTo('ScalarValuedFunction'),
		TreeNodeContextKey.NodeType.isEqualTo('TableValuedFunction'))
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'scripting',
	order: 3,
	command: {
		id: SCRIPT_AS_EXECUTE_COMMAND_ID,
		title: localize('scriptExecute', "Script as Execute")
	},
	when: ContextKeyExpr.and(ConnectionContextKey.Provider.isEqualTo('MSSQL'), TreeNodeContextKey.NodeType.isEqualTo('StoredProcedure'))
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'scripting',
	order: 3,
	command: {
		id: SCRIPT_AS_ALTER_COMMAND_ID,
		title: localize('scriptAlter', "Script as Alter")
	},
	when:
		ContextKeyExpr.or(
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo('StoredProcedure')),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo('View')),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo('AggregateFunction')),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo('PartitionFunction')),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo('ScalarValuedFunction')),
			ContextKeyExpr.and(
				ConnectionContextKey.Provider.isEqualTo('MSSQL'),
				TreeNodeContextKey.NodeType.isEqualTo('TableValuedFunction')),
		)
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: 'scripting',
	order: 3,
	command: {
		id: SCRIPT_AS_DELETE_COMMAND_ID,
		title: localize('scriptDelete', "Script as Drop")
	},
	when: ContextKeyExpr.or(
		TreeNodeContextKey.NodeType.isEqualTo('Table'),
		TreeNodeContextKey.NodeType.isEqualTo('View'),
		TreeNodeContextKey.NodeType.isEqualTo('Schema'),
		TreeNodeContextKey.NodeType.isEqualTo('User'),
		TreeNodeContextKey.NodeType.isEqualTo('UserDefinedTableType'),
		TreeNodeContextKey.NodeType.isEqualTo('StoredProcedure'),
		TreeNodeContextKey.NodeType.isEqualTo('AggregateFunction'),
		TreeNodeContextKey.NodeType.isEqualTo('PartitionFunction'),
		TreeNodeContextKey.NodeType.isEqualTo('ScalarValuedFunction'),
		TreeNodeContextKey.NodeType.isEqualTo('TableValuedFunction'))
});
