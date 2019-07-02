/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import {
	DISCONNECT_COMMAND_ID, MANAGE_COMMAND_ID, NEW_QUERY_COMMAND_ID, REFRESH_COMMAND_ID,
	NEW_NOTEBOOK_COMMAND_ID, SCHEMA_COMPARE_COMMAND_ID, PROFILER_COMMAND_ID, DATA_TIER_WIZARD_COMMAND_ID,
	IMPORT_COMMAND_ID, BACKUP_COMMAND_ID, RESTORE_COMMAND_ID, GENERATE_SCRIPTS_COMMAND_ID
} from './nodeCommands';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { NodeContextKey } from 'sql/workbench/parts/dataExplorer/common/nodeContext';
import { NodeContextUtils } from 'sql/workbench/parts/dataExplorer/common/nodeContextUtils';

// Disconnect
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', 'Disconnect')
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnected,
		ContextKeyExpr.not('isMssqlProvided'))
});

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: DISCONNECT_COMMAND_ID,
		title: localize('disconnect', 'Disconnect')
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnected,
		NodeContextUtils.IsMssqlProvided, NodeContextUtils.IsDatabaseOrServer)
});

// New Query
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', 'New Query')
	},
	when: NodeContextUtils.IsDatabaseOrServer
});

// Manage
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: MANAGE_COMMAND_ID,
		title: localize('manage', 'Manage')
	},
	when: NodeContextUtils.IsDatabaseOrServer
});


// Refresh
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 6,
	command: {
		id: REFRESH_COMMAND_ID,
		title: localize('refresh', 'Refresh')
	},
	when: NodeContextKey.IsConnectable
});


// New Notebook
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: NEW_NOTEBOOK_COMMAND_ID,
		title: localize('newNotebook', 'New Notebook')
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnectable,
		NodeContextUtils.IsDatabaseOrServer,
		NodeContextUtils.IsMssqlProvided)
});

// Data-Tier Application Wizard
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'export',
	order: 7,
	command: {
		id: DATA_TIER_WIZARD_COMMAND_ID,
		title: localize('dacFx', 'Data-tier Application Wizard')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.IsDatabaseOrServer)
});


MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'export',
	order: 7,
	command: {
		id: DATA_TIER_WIZARD_COMMAND_ID,
		title: localize('dacFx', 'Data-tier Application Wizard')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.isDatabasesFolder)
});

// Profiler
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'profiler',
	order: 8,
	command: {
		id: PROFILER_COMMAND_ID,
		title: localize('profiler', 'Launch Profiler')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.IsServer)
});

// Flat File Import
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'import',
	order: 10,
	command: {
		id: IMPORT_COMMAND_ID,
		title: localize('flatFileImport', 'Import Wizard')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.IsDatabaseOrServer, ContextKeyExpr.not('isServer'))
});

// Schema Compare
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'export',
	order: 9,
	command: {
		id: SCHEMA_COMPARE_COMMAND_ID,
		title: localize('schemaCompare', 'Schema Compare')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.IsDatabaseOrServer, ContextKeyExpr.not('isServer'))
});

// Backup Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: BACKUP_COMMAND_ID,
		title: localize('backup', 'Backup')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.IsDatabaseOrServer, ContextKeyExpr.not('isServer'))
});

// Restore Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: RESTORE_COMMAND_ID,
		title: localize('restore', 'Restore')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.IsDatabaseOrServer, ContextKeyExpr.not('isServer'))
});

// Generate Scripts Action
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'z-AdminToolExt@1',
	order: 11,
	command: {
		id: GENERATE_SCRIPTS_COMMAND_ID,
		title: localize('generateScripts', 'Generate Scripts...')
	},
	when: ContextKeyExpr.and(NodeContextUtils.IsMssqlProvided,
		NodeContextUtils.IsDatabaseOrServer, ContextKeyExpr.not('isServer'))
});