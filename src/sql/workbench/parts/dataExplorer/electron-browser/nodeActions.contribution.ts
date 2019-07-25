/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import {
	DISCONNECT_COMMAND_ID, MANAGE_COMMAND_ID, NEW_QUERY_COMMAND_ID, REFRESH_COMMAND_ID,
	NEW_NOTEBOOK_COMMAND_ID, SCHEMA_COMPARE_COMMAND_ID, DATA_TIER_WIZARD_COMMAND_ID,
	IMPORT_COMMAND_ID, BACKUP_COMMAND_ID, RESTORE_COMMAND_ID
} from './nodeCommands';
import {
	PROFILER_COMMAND_ID, GENERATE_SCRIPTS_COMMAND_ID, PROPERTIES_COMMAND_ID,
	SCRIPT_AS_CREATE_COMMAND_ID, SCRIPT_AS_DELETE_COMMAND_ID, SCRIPT_AS_SELECT_COMMAND_ID,
	SCRIPT_AS_EXECUTE_COMMAND_ID, SCRIPT_AS_ALTER_COMMAND_ID, EDIT_DATA_COMMAND_ID
} from 'sql/workbench/parts/objectExplorer/common/objectExplorerViewTreeShimActions';
import { ContextKeyExpr, ContextKeyRegexExpr, ContextKeyNotEqualsExpr } from 'vs/platform/contextkey/common/contextkey';
import { NodeContextKey } from 'sql/workbench/parts/dataExplorer/common/nodeContext';
import { MssqlNodeContext } from 'sql/workbench/parts/dataExplorer/common/mssqlNodeContext';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';


// Disconnect
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', "Disconnect")
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnected,
		new ContextKeyNotEqualsExpr('nodeType', NodeType.Folder))
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

// New Query
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', "New Query")
	},
	when: MssqlNodeContext.IsDatabaseOrServer
});

// Manage
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: MANAGE_COMMAND_ID,
		title: localize('manage', "Manage")
	},
	when: MssqlNodeContext.IsDatabaseOrServer
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


// New Notebook
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: NEW_NOTEBOOK_COMMAND_ID,
		title: localize('newNotebook', "New Notebook")
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnectable,
		MssqlNodeContext.IsDatabaseOrServer,
		MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName))
});

// Data-Tier Application Wizard
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'export',
	order: 7,
	command: {
		id: DATA_TIER_WIZARD_COMMAND_ID,
		title: localize('dacFx', "Data-tier Application Wizard")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.IsDatabaseOrServer)
});


MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'export',
	order: 7,
	command: {
		id: DATA_TIER_WIZARD_COMMAND_ID,
		title: localize('dacFx', "Data-tier Application Wizard")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Folder),
		MssqlNodeContext.NodeLabel.isEqualTo('Databases'))
});

// Profiler
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'profiler',
	order: 8,
	command: {
		id: PROFILER_COMMAND_ID,
		title: localize('profiler', "Launch Profiler")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Server))
});

// Flat File Import
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'import',
	order: 10,
	command: {
		id: IMPORT_COMMAND_ID,
		title: localize('flatFileImport', "Import Wizard")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database))
});

// Schema Compare
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'export',
	order: 9,
	command: {
		id: SCHEMA_COMPARE_COMMAND_ID,
		title: localize('schemaCompare', "Schema Compare")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database))
});

// Backup Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: BACKUP_COMMAND_ID,
		title: localize('backup', "Backup")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database))
});

// Restore Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: RESTORE_COMMAND_ID,
		title: localize('restore', "Restore")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database))
});

// Generate Scripts Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'z-AdminToolExt@1',
	order: 11,
	command: {
		id: GENERATE_SCRIPTS_COMMAND_ID,
		title: localize('generateScripts', "Generate Scripts...")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Database),
		MssqlNodeContext.IsWindows)
});

// Properties Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'z-AdminToolExt@2',
	order: 12,
	command: {
		id: PROPERTIES_COMMAND_ID,
		title: localize('properties', "Properties")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.NodeType.isEqualTo(NodeType.Server), ContextKeyExpr.not('isCloud'),
		MssqlNodeContext.IsWindows)
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'z-AdminToolExt@2',
	order: 12,
	command: {
		id: PROPERTIES_COMMAND_ID,
		title: localize('properties', "Properties")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName),
		MssqlNodeContext.IsWindows,
		new ContextKeyRegexExpr('nodeType', /^(Database|Table|Column|Index|Statistic|View|ServerLevelLogin|ServerLevelServerRole|ServerLevelCredential|ServerLevelServerAudit|ServerLevelServerAuditSpecification|StoredProcedure|ScalarValuedFunction|TableValuedFunction|AggregateFunction|Synonym|Assembly|UserDefinedDataType|UserDefinedType|UserDefinedTableType|Sequence|User|DatabaseRole|ApplicationRole|Schema|SecurityPolicy|ServerLevelLinkedServer)$/))
});

//////////////// Scripting Actions /////////////////

// Script as Create
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: SCRIPT_AS_CREATE_COMMAND_ID,
		title: localize('scriptAsCreate', "Script as Create")
	},
	when: MssqlNodeContext.CanScriptAsCreateOrDelete
});

// Script as Delete
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: SCRIPT_AS_DELETE_COMMAND_ID,
		title: localize('scriptAsDelete', "Script as Drop")
	},
	when: MssqlNodeContext.CanScriptAsCreateOrDelete
});

// Script as Select
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: SCRIPT_AS_SELECT_COMMAND_ID,
		title: localize('scriptAsSelect', "Select Top 1000")
	},
	when: MssqlNodeContext.CanScriptAsSelect
});

// Script as Execute
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: SCRIPT_AS_EXECUTE_COMMAND_ID,
		title: localize('scriptAsExecute', "Script as Execute")
	},
	when: MssqlNodeContext.CanScriptAsExecute
});

// Script as Alter
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: SCRIPT_AS_ALTER_COMMAND_ID,
		title: localize('scriptAsAlter', "Script as Alter")
	},
	when: MssqlNodeContext.CanScriptAsAlter
});

// Edit Data
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: EDIT_DATA_COMMAND_ID,
		title: localize('editData', "Edit Data")
	},
	when: MssqlNodeContext.CanEditData
});