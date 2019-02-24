/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

import { Event, Emitter } from 'vs/base/common/event';
import { dispose } from 'vs/base/common/lifecycle';
import { URI, UriComponents } from 'vs/base/common/uri';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import * as typeConverters from 'vs/workbench/api/node/extHostTypeConverters';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { ok } from 'vs/base/common/assert';

import {
	SqlMainContext, INotebookDocumentsAndEditorsDelta, ExtHostNotebookDocumentsAndEditorsShape,
	MainThreadNotebookDocumentsAndEditorsShape, INotebookShowOptions, INotebookModelChangedData
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ExtHostNotebookDocumentData } from 'sql/workbench/api/node/extHostNotebookDocumentData';
import { ExtHostNotebookEditor } from 'sql/workbench/api/node/extHostNotebookEditor';


export class ExtHostNotebookDocumentsAndEditors implements ExtHostNotebookDocumentsAndEditorsShape {

	private _disposables: Disposable[] = [];

	private _activeEditorId: string;
	private _proxy: MainThreadNotebookDocumentsAndEditorsShape;

	private readonly _editors = new Map<string, ExtHostNotebookEditor>();
	private readonly _documents = new Map<string, ExtHostNotebookDocumentData>();

	private readonly _onDidChangeVisibleNotebookEditors = new Emitter<ExtHostNotebookEditor[]>();
	private readonly _onDidChangeActiveNotebookEditor = new Emitter<ExtHostNotebookEditor>();
	private _onDidOpenNotebook = new Emitter<sqlops.nb.NotebookDocument>();
	private _onDidChangeNotebookCell = new Emitter<sqlops.nb.NotebookCellChangeEvent>();

	readonly onDidChangeVisibleNotebookEditors: Event<ExtHostNotebookEditor[]> = this._onDidChangeVisibleNotebookEditors.event;
	readonly onDidChangeActiveNotebookEditor: Event<ExtHostNotebookEditor> = this._onDidChangeActiveNotebookEditor.event;
	readonly onDidOpenNotebookDocument: Event<sqlops.nb.NotebookDocument> = this._onDidOpenNotebook.event;
	readonly onDidChangeNotebookCell: Event<sqlops.nb.NotebookCellChangeEvent> = this._onDidChangeNotebookCell.event;


	constructor(
		private readonly _mainContext: IMainContext,
	) {
		if (this._mainContext) {
			this._proxy = this._mainContext.getProxy(SqlMainContext.MainThreadNotebookDocumentsAndEditors);
		}
	}

	dispose() {
		this._disposables = dispose(this._disposables);
	}

	//#region Main Thread accessible methods
	$acceptDocumentsAndEditorsDelta(delta: INotebookDocumentsAndEditorsDelta): void {

		const removedDocuments: ExtHostNotebookDocumentData[] = [];
		const addedDocuments: ExtHostNotebookDocumentData[] = [];
		const removedEditors: ExtHostNotebookEditor[] = [];

		if (delta.removedDocuments) {
			for (const uriComponent of delta.removedDocuments) {
				const uri = URI.revive(uriComponent);
				const id = uri.toString();
				const data = this._documents.get(id);
				this._documents.delete(id);
				removedDocuments.push(data);
			}
		}

		if (delta.addedDocuments) {
			for (const data of delta.addedDocuments) {
				const resource = URI.revive(data.uri);
				ok(!this._documents.has(resource.toString()), `document '${resource} already exists!'`);

				const documentData = new ExtHostNotebookDocumentData(
					this._proxy,
					resource,
					data.providerId,
					data.isDirty,
					data.cells
				);
				this._documents.set(resource.toString(), documentData);
				addedDocuments.push(documentData);
			}
		}

		if (delta.removedEditors) {
			for (const id of delta.removedEditors) {
				const editor = this._editors.get(id);
				this._editors.delete(id);
				removedEditors.push(editor);
			}
		}

		if (delta.addedEditors) {
			for (const data of delta.addedEditors) {
				const resource = URI.revive(data.documentUri);
				ok(this._documents.has(resource.toString()), `document '${resource}' does not exist`);
				ok(!this._editors.has(data.id), `editor '${data.id}' already exists!`);

				const documentData = this._documents.get(resource.toString());
				const editor = new ExtHostNotebookEditor(
					this._mainContext.getProxy(SqlMainContext.MainThreadNotebookDocumentsAndEditors),
					data.id,
					documentData,
					typeConverters.ViewColumn.to(data.editorPosition)
				);
				this._editors.set(data.id, editor);
			}
		}

		if (delta.newActiveEditor !== undefined) {
			ok(delta.newActiveEditor === null || this._editors.has(delta.newActiveEditor), `active editor '${delta.newActiveEditor}' does not exist`);
			this._activeEditorId = delta.newActiveEditor;
		}

		dispose(removedDocuments);
		dispose(removedEditors);

		// now that the internal state is complete, fire events
		if (removedDocuments) {
			// TODO add doc close event
		}
		if (addedDocuments) {
			addedDocuments.forEach(d => this._onDidOpenNotebook.fire(d.document));
		}

		if (delta.removedEditors || delta.addedEditors) {
			this._onDidChangeVisibleNotebookEditors.fire(this.getAllEditors());
		}
		if (delta.newActiveEditor !== undefined) {
			this._onDidChangeActiveNotebookEditor.fire(this.getActiveEditor());
		}
	}

	$acceptModelChanged(uriComponents: UriComponents, e: INotebookModelChangedData): void {
		const uri = URI.revive(uriComponents);
		const strURL = uri.toString();
		let data = this._documents.get(strURL);
		if (data) {
			data.onModelChanged(e);
			this._onDidChangeNotebookCell.fire({
				cells: data.document.cells,
				notebook: data.document,
				kind: undefined
			});
		}
	}

	//#endregion

	//#region Extension accessible methods
	showNotebookDocument(uri: vscode.Uri, showOptions: sqlops.nb.NotebookShowOptions): Thenable<sqlops.nb.NotebookEditor> {
		return this.doShowNotebookDocument(uri, showOptions);
	}

	private async doShowNotebookDocument(uri: vscode.Uri, showOptions: sqlops.nb.NotebookShowOptions): Promise<sqlops.nb.NotebookEditor> {
		let options: INotebookShowOptions = {};
		if (showOptions) {
			options.preserveFocus = showOptions.preserveFocus;
			options.preview = showOptions.preview;
			options.position = showOptions.viewColumn;
			options.providerId = showOptions.providerId;
			options.connectionId = showOptions.connectionId;
			options.defaultKernel = showOptions.defaultKernel;
		}
		let id = await this._proxy.$tryShowNotebookDocument(uri, options);
		let editor = this.getEditor(id);
		if (editor) {
			return editor;
		} else {
			throw new Error(`Failed to show notebook document ${uri.toString()}, should show in editor #${id}`);
		}
	}

	getDocument(strUrl: string): ExtHostNotebookDocumentData {
		return this._documents.get(strUrl);
	}

	getAllDocuments(): ExtHostNotebookDocumentData[] {
		const result: ExtHostNotebookDocumentData[] = [];
		this._documents.forEach(data => result.push(data));
		return result;
	}

	getEditor(id: string): ExtHostNotebookEditor {
		return this._editors.get(id);
	}

	getActiveEditor(): ExtHostNotebookEditor | undefined {
		if (!this._activeEditorId) {
			return undefined;
		} else {
			return this._editors.get(this._activeEditorId);
		}
	}

	getAllEditors(): ExtHostNotebookEditor[] {
		const result: ExtHostNotebookEditor[] = [];
		this._editors.forEach(data => result.push(data));
		return result;
	}
	//#endregion
}
