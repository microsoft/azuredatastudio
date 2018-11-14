/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	ToggleConnectDatabaseAction, ListDatabasesAction, RunQueryAction,
	ListDatabasesActionItem, IQueryActionContext, ChangeConnectionAction, EstimatedQueryPlanAction, CancelQueryAction
} from 'sql/parts/query/execution/queryActions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { QueryInput, QueryEditorState } from 'sql/parts/query/common/queryInput';

import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

export class QueryEditorActionBar extends Taskbar {

	private runQuery: RunQueryAction;
	private cancelQuery: CancelQueryAction;
	private toggleConnect: ToggleConnectDatabaseAction;
	private changeConnection: ChangeConnectionAction;
	private listDatabaseActionItem: ListDatabasesActionItem;
	private estimatedQueryPlan: EstimatedQueryPlanAction;

	private inputDisposables: IDisposable[] = [];

	private _context: IQueryActionContext = {
		input: undefined,
		editor: undefined
	};

	constructor(container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(container, {
			actionItemProvider: action => {
				if (action.id === ListDatabasesAction.ID) {
					return this.listDatabaseActionItem;
				}
				return undefined;
			}
		});
		this.runQuery = instantiationService.createInstance(RunQueryAction, RunQueryAction.ID, RunQueryAction.Label);
		this.cancelQuery = instantiationService.createInstance(CancelQueryAction, CancelQueryAction.ID, CancelQueryAction.Label);
		this.toggleConnect = instantiationService.createInstance(ToggleConnectDatabaseAction);
		this.changeConnection = instantiationService.createInstance(ChangeConnectionAction);
		this.listDatabaseActionItem = instantiationService.createInstance(ListDatabasesActionItem);
		this.estimatedQueryPlan = instantiationService.createInstance(EstimatedQueryPlanAction);

		this.setContent([
			{ action: this.runQuery },
			{ action: this.cancelQuery },
			{ action: this.toggleConnect },
			{ action: this.changeConnection },
			{ action: instantiationService.createInstance(ListDatabasesAction) },
			{ element: Taskbar.createTaskbarSeparator() },
			{ action: this.estimatedQueryPlan }
		]);
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
		this.runQuery.enabled = state.connected && !state.executing;
		this.cancelQuery.enabled = state.connected && state.executing;
		this.changeConnection.enabled = state.connected && !state.executing;
		this.toggleConnect.connected = state.connected;
		this.listDatabaseActionItem.enabled = state.connected && !state.executing;
		this.estimatedQueryPlan.enabled = state.connected && !state.executing;
	}

	public set editor(editor: ICodeEditor) {
		this._context.editor = editor;
		this.context = this._context;
	}
}
