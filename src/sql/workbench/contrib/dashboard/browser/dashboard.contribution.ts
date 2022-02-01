/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DashboardEditor } from 'sql/workbench/contrib/dashboard/browser/dashboardEditor';
import { DashboardInput } from 'sql/workbench/browser/editor/profiler/dashboardInput';

import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { localize } from 'vs/nls';
import { IConfigurationNode, IConfigurationRegistry, Extensions } from 'vs/platform/configuration/common/configurationRegistry';
import { DASHBOARD_CONFIG_ID } from 'sql/workbench/contrib/dashboard/browser/pages/dashboardPageContribution';
import { DATABASE_DASHBOARD_PROPERTIES, databaseDashboardPropertiesSchema, DATABASE_DASHBOARD_SETTING, databaseDashboardSettingSchema, DATABASE_DASHBOARD_TABS, databaseDashboardTabsSchema } from 'sql/workbench/contrib/dashboard/browser/pages/databaseDashboardPage.contribution';
import { SERVER_DASHBOARD_PROPERTIES, serverDashboardPropertiesSchema, SERVER_DASHBOARD_SETTING, serverDashboardSettingSchema, SERVER_DASHBOARD_TABS, serverDashboardTabsSchema } from 'sql/workbench/contrib/dashboard/browser/pages/serverDashboardPage.contribution';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { DE_MANAGE_COMMAND_ID, OE_MANAGE_COMMAND_ID } from 'sql/workbench/contrib/dashboard/browser/dashboardActions';

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
const dashboardConfig: IConfigurationNode = {
	id: DASHBOARD_CONFIG_ID,
	type: 'object',
	properties: {
		[DATABASE_DASHBOARD_PROPERTIES]: databaseDashboardPropertiesSchema,
		[SERVER_DASHBOARD_PROPERTIES]: serverDashboardPropertiesSchema,
		[DATABASE_DASHBOARD_SETTING]: databaseDashboardSettingSchema,
		[SERVER_DASHBOARD_SETTING]: serverDashboardSettingSchema,
		[DATABASE_DASHBOARD_TABS]: databaseDashboardTabsSchema,
		[SERVER_DASHBOARD_TABS]: serverDashboardTabsSchema
	}
};

configurationRegistry.registerConfiguration(dashboardConfig);

// // Manage
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: '0_query',
	order: 0,
	command: {
		id: DE_MANAGE_COMMAND_ID,
		title: localize('manage', "Manage")
	},
	when: MssqlNodeContext.IsDatabaseOrServer
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 0,
	command: {
		id: OE_MANAGE_COMMAND_ID,
		title: localize('manage', "Manage")
	},
	when: ContextKeyExpr.or(ContextKeyExpr.and(TreeNodeContextKey.Status.notEqualsTo('Unavailable'), TreeNodeContextKey.NodeType.isEqualTo('Server')), ContextKeyExpr.and(TreeNodeContextKey.Status.notEqualsTo('Unavailable'), TreeNodeContextKey.NodeType.isEqualTo('Database')))
});

const dashboardEditorDescriptor = EditorPaneDescriptor.create(
	DashboardEditor,
	DashboardEditor.ID,
	localize('dashboard.editor.label', "Dashboard")
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(dashboardEditorDescriptor, [new SyncDescriptor(DashboardInput)]);
