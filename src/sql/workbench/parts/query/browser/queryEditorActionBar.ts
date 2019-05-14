/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';
import * as queryActions from 'sql/workbench/parts/query/browser/queryActions';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';

export class QueryEditorActionBar extends Disposable {
	private toolbar: ToolBar;

	private _context: queryActions.IQueryActionContext = {
		input: undefined,
		editor: undefined
	};

	constructor(
		container: HTMLElement,
		@IContextMenuService contextMenuService: IContextMenuService
	) {
		super();
		this.toolbar = this._register(new ToolBar(container, contextMenuService, {
			orientation: ActionsOrientation.HORIZONTAL_REVERSE
		}));
	}

	public setInput(input: QueryInput): void {
		this._context.input = input;
		this.toolbar.context = this._context;
	}

	public set editor(editor: ICodeEditor) {
		this._context.editor = editor;
		this.toolbar.context = this._context;
	}
}
