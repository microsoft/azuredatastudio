/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { Disposable } from 'vs/base/common/lifecycle';

import { SqlMainContext, MainThreadNotebookDocumentsAndEditorsShape, SqlExtHostContext, ExtHostNotebookDocumentsAndEditorsShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import URI, { UriComponents } from 'vs/base/common/uri';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { INotebookService, INotebookEditor } from 'sql/services/notebook/notebookService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';


@extHostNamedCustomer(SqlMainContext.MainThreadNotebookDocumentsAndEditors)
export class MainThreadNotebookDocumentsAndEditors extends Disposable implements MainThreadNotebookDocumentsAndEditorsShape {
	private _proxy: ExtHostNotebookDocumentsAndEditorsShape;

	constructor(
		extHostContext: IExtHostContext,
		@INotebookService private notebookService: INotebookService,
		@ITextFileService private textFileService: ITextFileService,
		@IEditorService private readonly _editorService: IEditorService,
		@IEditorGroupsService private readonly _editorGroupService: IEditorGroupsService,
		@INotebookService private readonly _notebookService: INotebookService

	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostNotebookDocumentsAndEditors);
		}
		this._register(this._editorService.onDidVisibleEditorsChange(this._updateActiveAndVisibleTextEditors, this));
		this._register(this._editorGroupService.onDidRemoveGroup(this._updateActiveAndVisibleTextEditors, this));
		this._register(this._editorGroupService.onDidMoveGroup(this._updateActiveAndVisibleTextEditors, this));
		this._register(this._notebookService.onNotebookEditorAdd(this._onDidAddEditor, this));
		this._register(this._notebookService.onNotebookEditorRemove(this._onDidRemoveEditor, this));
	}

	$trySaveDocument(uri: UriComponents): Thenable<boolean> {
		return this.textFileService.save(URI.revive(uri));
	}

	private _updateActiveAndVisibleTextEditors(): void {

		// editor columns
		let editorPositionData = this._getTextEditorPositionData();
		if (!objectEquals(this._editorPositionData, editorPositionData)) {
			this._editorPositionData = editorPositionData;
			this._proxy.$acceptEditorPositionData(this._editorPositionData);
		}
	}


	private _onDidAddEditor(e: INotebookEditor): void {
		this._toDisposeOnEditorRemove.set(e.id, e.onDidChangeModel(() => this._updateState()));
		this._toDisposeOnEditorRemove.set(e.id, e.onDidFocusEditorText(() => this._updateState()));
		this._toDisposeOnEditorRemove.set(e.id, e.onDidBlurEditorText(() => this._updateState()));
		this._updateState();
	}

	private _onDidRemoveEditor(e: ICodeEditor): void {
		const sub = this._toDisposeOnEditorRemove.get(e.getId());
		if (sub) {
			this._toDisposeOnEditorRemove.delete(e.getId());
			sub.dispose();
			this._updateState();
		}
	}
	private _updateState(): void {

		// models: ignore too large models
		const models = new Set<ITextModel>();
		for (const model of this._modelService.getModels()) {
			if (shouldSynchronizeModel(model)) {
				models.add(model);
			}
		}


		// editor: only take those that have a not too large model
		const editors = new Map<string, TextEditorSnapshot>();
		let activeEditor: string = null;

		for (const editor of this._codeEditorService.listCodeEditors()) {
			if (editor.isSimpleWidget) {
				continue;
			}
			const model = editor.getModel();
			if (model && shouldSynchronizeModel(model)
				&& !model.isDisposed() // model disposed
				&& Boolean(this._modelService.getModel(model.uri)) // model disposing, the flag didn't flip yet but the model service already removed it
			) {
				const apiEditor = new TextEditorSnapshot(editor);
				editors.set(apiEditor.id, apiEditor);
				if (editor.hasTextFocus()) {
					activeEditor = apiEditor.id;
				}
			}
		}

		// active editor: if none of the previous editors had focus we try
		// to match the active workbench editor with one of editor we have
		// just computed
		if (!activeEditor) {
			let candidate = this._editorService.activeTextEditorWidget;
			if (isDiffEditor(candidate)) {
				candidate = candidate.getModifiedEditor();
			}
			if (candidate) {
				editors.forEach(snapshot => {
					if (candidate === snapshot.editor) {
						activeEditor = snapshot.id;
					}
				});
			}
		}

		// compute new state and compare against old
		const newState = new DocumentAndEditorState(models, editors, activeEditor);
		const delta = DocumentAndEditorState.compute(this._currentState, newState);
		if (!delta.isEmpty) {
			this._currentState = newState;
			this._onDidChangeState(delta);
		}
	}
}
