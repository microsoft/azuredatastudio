/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerDashboardWidget } from 'sql/platform/dashboard/browser/widgetRegistry';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ExplorerManageAction, CustomExecuteCommandAction } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerTreeActions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ItemContextKey } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerTreeContext';
import { BackupAction, RestoreAction, NewQueryAction } from 'sql/workbench/common/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { NewNotebookAction } from 'sql/workbench/parts/notebook/browser/notebookActions';

const explorerSchema: IJSONSchema = {
	type: 'object',
};

registerDashboardWidget('explorer-widget', '', explorerSchema);

CommandsRegistry.registerCommand(ExplorerManageAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(ExplorerManageAction, ExplorerManageAction.ID, ExplorerManageAction.LABEL).run(context);
});

const ExplorerBackUpActionID = 'explorer.backup';
CommandsRegistry.registerCommand(ExplorerBackUpActionID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(CustomExecuteCommandAction, BackupAction.ID, BackupAction.LABEL).run(context);
});

const ExplorerRestoreActionID = 'explorer.restore';
CommandsRegistry.registerCommand(ExplorerRestoreActionID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(CustomExecuteCommandAction, RestoreAction.ID, RestoreAction.LABEL).run(context);
});

const ExplorerNewQueryActionID = 'explorer.query';
CommandsRegistry.registerCommand(ExplorerNewQueryActionID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(CustomExecuteCommandAction, NewQueryAction.ID, NewQueryAction.LABEL).run(context);
});

const ExplorerNotebookActionID = 'explorer.notebook';
CommandsRegistry.registerCommand(ExplorerNotebookActionID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(CustomExecuteCommandAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerManageAction.ID,
		title: ExplorerManageAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('database'),
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerNewQueryActionID,
		title: NewQueryAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('database'),
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerNotebookActionID,
		title: NewNotebookAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('database'),
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerRestoreActionID,
		title: RestoreAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.isEqualTo('mssql'), ItemContextKey.IsCloud.toNegated()),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerBackUpActionID,
		title: BackupAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('database'), ItemContextKey.ConnectionProvider.isEqualTo('mssql'), ItemContextKey.IsCloud.toNegated()),
	order: 2
});
