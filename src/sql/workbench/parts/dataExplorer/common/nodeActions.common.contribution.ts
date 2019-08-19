/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import {
	DISCONNECT_COMMAND_ID, REFRESH_COMMAND_ID,
	SCHEMA_COMPARE_COMMAND_ID, DATA_TIER_WIZARD_COMMAND_ID,
	PROFILER_COMMAND_ID, GENERATE_SCRIPTS_COMMAND_ID, PROPERTIES_COMMAND_ID
} from './nodeCommands.common';
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
		ContextKeyNotEqualsExpr.create('nodeType', NodeType.Folder))
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
		ContextKeyRegexExpr.create('nodeType', /^(Database|Table|Column|Index|Statistic|View|ServerLevelLogin|ServerLevelServerRole|ServerLevelCredential|ServerLevelServerAudit|ServerLevelServerAuditSpecification|StoredProcedure|ScalarValuedFunction|TableValuedFunction|AggregateFunction|Synonym|Assembly|UserDefinedDataType|UserDefinedType|UserDefinedTableType|Sequence|User|DatabaseRole|ApplicationRole|Schema|SecurityPolicy|ServerLevelLinkedServer)$/))
});
