/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as actions from 'sql/parts/query/execution/queryActions';
import { QueryInput, QueryEditorState } from 'sql/parts/query/common/queryInput';

import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { QueryEditorExtensionsRegistry, QueryEditorAction } from 'sql/parts/query/editor/queryEditorExtensions';
import { MenuRegistry, MenuId, IMenuItem, IMenuService } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Themable } from 'vs/workbench/common/theme';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { fillInActionBarActions } from 'vs/platform/actions/browser/menuItemActionItem';
import { IAction } from 'vs/base/common/actions';

export class QueryEditorActionBar extends Themable {
/*
	private runQuery: actions.RunQueryAction;
	private cancelQuery: actions.CancelQueryAction;
	private connect: actions.ConnectAction;
	private disconnect: actions.DisconnectAction;
	private changeConnection: actions.ChangeConnectionAction;
	private estimatedQueryPlan: actions.EstimatedQueryPlanAction;
	*/
	private listDatabaseActionItem: actions.ListDatabasesActionItem;

	private inputDisposables: IDisposable[] = [];
	private editorToolBarMenuDisposables: IDisposable[] = [];

	private _context: actions.IQueryActionContext = {
		input: undefined,
		editor: undefined
	};

	constructor(container: HTMLElement,
		@IThemeService themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private contextKeyService: IContextKeyService,
	) {
		super(themeService);
		// super(container, {
		// 	actionItemProvider: action => {
		// 		if (action.id === actions.ListDatabasesAction.ID) {
		// 			return this.listDatabaseActionItem;
		// 		}
		// 		return undefined;
		// 	}
		// });

		this.listDatabaseActionItem = instantiationService.createInstance(actions.ListDatabasesActionItem);
	}

	private updateMenuBar() {

		// Dispose previous listeners
		this.editorToolBarMenuDisposables = dispose(this.editorToolBarMenuDisposables);

		const menuBar = this.menuService.createMenu(MenuId.EditorActionBar, this.contextKeyService);
		this.editorToolBarMenuDisposables.push(menuBar);
		this.editorToolBarMenuDisposables.push((menuBar.onDidChange(() => {
			this.updateMenuBar();
		})));
		fillInActionBarActions(menuBar, {}, new Array<IAction>());
	}

	public setInput(input: QueryInput): TPromise<void> {
		dispose(this.inputDisposables);
		this.inputDisposables = [];
		this.inputDisposables.push(input.state.onChange(() => this.parseState(input.state)));
		this.parseState(input.state);
		this._context.input = input;
		this.context = this._context;
		return TPromise.as(undefined);
	}

	private parseState(state: QueryEditorState) {
		/*
		this.runQuery.enabled = state.connected && !state.executing;
		this.cancelQuery.enabled = state.connected && state.executing;
		this.changeConnection.enabled = state.connected && !state.executing;
		this.connect.enabled = !state.connected;
		this.disconnect.enabled = state.connected;
		this.listDatabaseActionItem.enabled = state.connected && !state.executing;
		this.estimatedQueryPlan.enabled = state.connected && !state.executing;
		*/
	}

	public set editor(editor: ICodeEditor) {
		this._context.editor = editor;
		this.context = this._context;
	}
}
