/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as actions from 'sql/parts/query/execution/queryActions';
import { QueryInput } from 'sql/parts/query/common/queryInput';

import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { MenuId, IMenuService } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { fillInActionBarActions } from 'vs/platform/actions/browser/menuItemActionItem';
import { IAction, Action, IActionItem } from 'vs/base/common/actions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { prepareActions } from 'vs/workbench/browser/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { createActionItem } from 'sql/platform/actions/browser/menuItemActionItem';

export class QueryEditorActionBar extends Disposable {

	private listDatabaseActionItem: actions.ListDatabasesActionItem;

	private editorToolBarMenuDisposables: IDisposable[] = [];

	private toolbar: ToolBar;

	private _context: actions.IQueryActionContext = {
		input: undefined,
		editor: undefined
	};

	constructor(container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService private keybindingService: IKeybindingService,
		@INotificationService private notificationService: INotificationService,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private contextKeyService: IContextKeyService,
	) {
		super();
		this.toolbar = this._register(new ToolBar(container, contextMenuService, {
			actionItemProvider: action => {
				if (action.id === actions.ListDatabasesAction.ID) {
					return this.listDatabaseActionItem;
				}
				return this.actionItemProvider(action as Action);
			},
			orientation: ActionsOrientation.HORIZONTAL_REVERSE
		}));

		this.listDatabaseActionItem = instantiationService.createInstance(actions.ListDatabasesActionItem);
	}

	private actionItemProvider(action: Action): IActionItem {
		// const activeControl = this.group.activeControl;

		// // Check Active Editor
		let actionItem: IActionItem;
		// if (activeControl instanceof BaseEditor) {
		// 	actionItem = activeControl.getActionItem(action);
		// }

		// Check extensions
		if (!actionItem) {
			actionItem = createActionItem(action, { label: true }, this.keybindingService, this.notificationService, this.contextMenuService);
		}

		return actionItem;
	}


	private updateMenuBar() {
		// Dispose previous listeners
		this.editorToolBarMenuDisposables = dispose(this.editorToolBarMenuDisposables);

		const menuBar = this.menuService.createMenu(MenuId.EditorActionBar, this.contextKeyService);
		this.editorToolBarMenuDisposables.push(menuBar);
		this.editorToolBarMenuDisposables.push((menuBar.onDidChange(() => {
			this.updateMenuBar();
		})));
		const actions = new Array<IAction>();
		fillInActionBarActions(menuBar, {}, actions);
		this.toolbar.setActions(prepareActions(actions))();
	}

	public setInput(input: QueryInput): TPromise<void> {
		this.updateMenuBar();
		this._context.input = input;
		this.toolbar.context = this._context;
		return TPromise.as(undefined);
	}

	public set editor(editor: ICodeEditor) {
		this._context.editor = editor;
		this.toolbar.context = this._context;
	}

	public dispose() {
		dispose(this.editorToolBarMenuDisposables);
		super.dispose();
	}
}
