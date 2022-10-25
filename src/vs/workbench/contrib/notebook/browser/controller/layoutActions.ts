/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';
import { Action2, MenuId, MenuRegistry, registerAction2 } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { NOTEBOOK_ACTIONS_CATEGORY } from 'vs/workbench/contrib/notebook/browser/controller/coreActions';
import { NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from 'vs/workbench/contrib/notebook/common/notebookContextKeys';
import { NotebookSetting } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';
import { IPreferencesService } from 'vs/workbench/services/preferences/common/preferences';

registerAction2(class NotebookConfigureLayoutAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.notebook.layout.select',
			title: localize('workbench.notebook.layout.select.label', "Select between Notebook Layouts"),
			f1: true,
			precondition: ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true),
			category: NOTEBOOK_ACTIONS_CATEGORY,
			menu: [
				{
					id: MenuId.EditorTitle,
					group: 'notebookLayout',
					when: ContextKeyExpr.and(
						NOTEBOOK_IS_ACTIVE_EDITOR,
						ContextKeyExpr.notEquals('config.notebook.globalToolbar', true),
						ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true)
					),
					order: 0
				},
				{
					id: MenuId.NotebookToolbar,
					group: 'notebookLayout',
					when: ContextKeyExpr.and(
						ContextKeyExpr.equals('config.notebook.globalToolbar', true),
						ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true)
					),
					order: 0
				}
			]
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(ICommandService).executeCommand('workbench.action.openWalkthrough', { category: 'notebooks', step: 'notebookProfile' }, true);
	}
});

registerAction2(class NotebookConfigureLayoutAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.notebook.layout.configure',
			title: localize('workbench.notebook.layout.configure.label', "Customize Notebook Layout"),
			f1: true,
			category: NOTEBOOK_ACTIONS_CATEGORY,
			menu: [
				{
					id: MenuId.NotebookToolbar,
					group: 'notebookLayout',
					when: ContextKeyExpr.equals('config.notebook.globalToolbar', true),
					order: 1
				}
			]
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:notebookLayout' });
	}
});

registerAction2(class NotebookConfigureLayoutFromEditorTitle extends Action2 {
	constructor() {
		super({
			id: 'workbench.notebook.layout.configure.editorTitle',
			title: localize('workbench.notebook.layout.configure.label', "Customize Notebook Layout"),
			f1: false,
			category: NOTEBOOK_ACTIONS_CATEGORY,
			menu: [
				{
					id: MenuId.NotebookEditorLayoutConfigure,
					group: 'notebookLayout',
					when: NOTEBOOK_IS_ACTIVE_EDITOR,
					order: 1
				}
			]
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:notebookLayout' });
	}
});

MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	submenu: MenuId.NotebookEditorLayoutConfigure,
	rememberDefaultAction: false,
	title: { value: localize('customizeNotebook', "Customize Notebook..."), original: 'Customize Notebook...', },
	icon: Codicon.gear,
	group: 'navigation',
	order: -1,
	when: NOTEBOOK_IS_ACTIVE_EDITOR
});

registerAction2(class ToggleLineNumberFromEditorTitle extends Action2 {
	constructor() {
		super({
			id: 'notebook.toggleLineNumbersFromEditorTitle',
			title: { value: localize('notebook.toggleLineNumbers', "Toggle Notebook Line Numbers"), original: 'Toggle Notebook Line Numbers' },
			precondition: NOTEBOOK_EDITOR_FOCUSED,
			menu: [
				{
					id: MenuId.NotebookEditorLayoutConfigure,
					group: 'notebookLayoutDetails',
					order: 1,
					when: NOTEBOOK_IS_ACTIVE_EDITOR
				}],
			category: NOTEBOOK_ACTIONS_CATEGORY,
			f1: true,
			toggled: {
				condition: ContextKeyExpr.notEquals('config.notebook.lineNumbers', 'off'),
				title: { value: localize('notebook.showLineNumbers', "Show Notebook Line Numbers"), original: 'Show Notebook Line Numbers' },
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(ICommandService).executeCommand('notebook.toggleLineNumbers');
	}
});

registerAction2(class ToggleCellToolbarPositionFromEditorTitle extends Action2 {
	constructor() {
		super({
			id: 'notebook.toggleCellToolbarPositionFromEditorTitle',
			title: { value: localize('notebook.toggleCellToolbarPosition', "Toggle Cell Toolbar Position"), original: 'Toggle Cell Toolbar Position' },
			menu: [{
				id: MenuId.NotebookEditorLayoutConfigure,
				group: 'notebookLayoutDetails',
				order: 3
			}],
			category: NOTEBOOK_ACTIONS_CATEGORY,
			f1: false
		});
	}

	async run(accessor: ServicesAccessor, ...args: any[]): Promise<void> {
		return accessor.get(ICommandService).executeCommand('notebook.toggleCellToolbarPosition', ...args);
	}
});

registerAction2(class ToggleBreadcrumbFromEditorTitle extends Action2 {
	constructor() {
		super({
			id: 'breadcrumbs.toggleFromEditorTitle',
			title: { value: localize('notebook.toggleBreadcrumb', "Toggle Breadcrumbs"), original: 'Toggle Breadcrumbs' },
			menu: [{
				id: MenuId.NotebookEditorLayoutConfigure,
				group: 'notebookLayoutDetails',
				order: 2
			}],
			f1: false
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(ICommandService).executeCommand('breadcrumbs.toggle');
	}
});

registerAction2(class SaveMimeTypeDisplayOrder extends Action2 {
	constructor() {
		super({
			id: 'notebook.saveMimeTypeOrder',
			title: localize('notebook.saveMimeTypeOrder', 'Save Mimetype Display Order'),
			f1: true,
			category: NOTEBOOK_ACTIONS_CATEGORY,
			precondition: NOTEBOOK_IS_ACTIVE_EDITOR,
		});
	}

	run(accessor: ServicesAccessor) {
		const service = accessor.get(INotebookService);
		const qp = accessor.get(IQuickInputService).createQuickPick<IQuickPickItem & { target: ConfigurationTarget }>();
		qp.placeholder = localize('notebook.placeholder', 'Settings file to save in');
		qp.items = [
			{ target: ConfigurationTarget.USER, label: localize('saveTarget.machine', 'User Settings') },
			{ target: ConfigurationTarget.WORKSPACE, label: localize('saveTarget.workspace', 'Workspace Settings') },
		];

		qp.onDidAccept(() => {
			const target = qp.selectedItems[0]?.target;
			if (target !== undefined) {
				service.saveMimeDisplayOrder(target);
			}
			qp.dispose();
		});

		qp.onDidHide(() => qp.dispose());

		qp.show();
	}
});
