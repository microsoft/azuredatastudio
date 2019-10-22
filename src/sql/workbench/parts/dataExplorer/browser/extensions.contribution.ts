/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { DATA_TIER_WIZARD_COMMAND_ID, PROFILER_COMMAND_ID, IMPORT_COMMAND_ID, SCHEMA_COMPARE_COMMAND_ID, GENERATE_SCRIPTS_COMMAND_ID, PROPERTIES_COMMAND_ID } from 'sql/workbench/parts/dataExplorer/browser/extensionActions';
import { ContextKeyExpr, ContextKeyRegexExpr } from 'vs/platform/contextkey/common/contextkey';
import { MssqlNodeContext } from 'sql/workbench/parts/dataExplorer/browser/mssqlNodeContext';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';
import { localize } from 'vs/nls';

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
