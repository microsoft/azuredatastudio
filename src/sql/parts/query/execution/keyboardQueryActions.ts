/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');

import { Action} from 'vs/base/common/actions';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { TPromise } from 'vs/base/common/winjs.base';

/**
 * Locates the active editor and calls runQuery() on the editor if it is a QueryEditor.
 */
export class RunQueryKeyboardAction extends Action {

	public static ID = 'runQueryKeyboardAction';
	public static LABEL = nls.localize('runQueryKeyboardAction', 'Run Query');

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.getActiveEditor();
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.runQuery();
		}
		return TPromise.as(null);
	}
}

/**
 * Locates the active editor and calls runCurrentQuery() on the editor if it is a QueryEditor.
 */
export class RunCurrentQueryKeyboardAction extends Action {
	public static ID = 'runCurrentQueryKeyboardAction';
	public static LABEL = nls.localize('runCurrentQueryKeyboardAction', 'Run Current Query');

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.getActiveEditor();
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.runCurrentQuery();
		}
		return TPromise.as(null);
	}
}

/**
 * Locates the active editor and calls cancelQuery() on the editor if it is a QueryEditor.
 */
export class CancelQueryKeyboardAction extends Action {

	public static ID = 'cancelQueryKeyboardAction';
	public static LABEL = nls.localize('cancelQueryKeyboardAction', 'Cancel Query');

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.getActiveEditor();
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.cancelQuery();
		}
		return TPromise.as(null);
	}
}

/**
 * Refresh the IntelliSense cache
 */
export class RefreshIntellisenseKeyboardAction extends Action {
	public static ID = 'refreshIntellisenseKeyboardAction';
	public static LABEL = nls.localize('refreshIntellisenseKeyboardAction', 'Refresh IntelliSense Cache');

	constructor(
		id: string,
		label: string,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.getActiveEditor();
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.rebuildIntelliSenseCache();
		}
		return TPromise.as(null);
	}
}
