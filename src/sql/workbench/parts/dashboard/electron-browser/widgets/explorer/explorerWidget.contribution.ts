/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ExplorerScriptSelectAction, ExplorerScriptExecuteAction, ExplorerScriptAlterAction, ExplorerScriptCreateAction } from 'sql/workbench/parts/dashboard/electron-browser/widgets/explorer/explorerTreeActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ItemContextKey } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerTreeContext';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { EditDataAction } from 'sql/workbench/electron-browser/scriptingActions';

CommandsRegistry.registerCommand(ExplorerScriptSelectAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(ExplorerScriptSelectAction, ExplorerScriptSelectAction.ID, ExplorerScriptSelectAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerScriptSelectAction.ID,
		title: ExplorerScriptSelectAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('view'),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerScriptSelectAction.ID,
		title: ExplorerScriptSelectAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('table'),
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
	when: ItemContextKey.ItemType.isEqualTo('table'),
	order: 2
});

CommandsRegistry.registerCommand(ExplorerScriptExecuteAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(ExplorerScriptExecuteAction, ExplorerScriptExecuteAction.ID, ExplorerScriptExecuteAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerScriptExecuteAction.ID,
		title: ExplorerScriptExecuteAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('sproc'),
	order: 2
});

CommandsRegistry.registerCommand(ExplorerScriptAlterAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(ExplorerScriptAlterAction, ExplorerScriptAlterAction.ID, ExplorerScriptAlterAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerScriptAlterAction.ID,
		title: ExplorerScriptAlterAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('sproc'), ItemContextKey.ConnectionProvider.isEqualTo('mssql')),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerScriptAlterAction.ID,
		title: ExplorerScriptAlterAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('function'), ItemContextKey.ConnectionProvider.isEqualTo('mssql')),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerScriptAlterAction.ID,
		title: ExplorerScriptAlterAction.LABEL
	},
	when: ContextKeyExpr.and(ItemContextKey.ItemType.isEqualTo('view'), ItemContextKey.ConnectionProvider.isEqualTo('mssql')),
	order: 2
});

CommandsRegistry.registerCommand(ExplorerScriptCreateAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(ExplorerScriptCreateAction, ExplorerScriptCreateAction.ID, ExplorerScriptCreateAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerScriptCreateAction.ID,
		title: ExplorerScriptCreateAction.LABEL
	},
	order: 2
});
