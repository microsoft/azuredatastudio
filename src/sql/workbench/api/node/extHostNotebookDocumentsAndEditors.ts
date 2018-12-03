/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

import { Event, Emitter } from 'vs/base/common/event';
import { readonly } from 'vs/base/common/errors';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import URI from 'vs/base/common/uri';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import { Schemas } from 'vs/base/common/network';
import { TPromise } from 'vs/base/common/winjs.base';
import * as typeConverters from 'vs/workbench/api/node/extHostTypeConverters';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { ok } from 'vs/base/common/assert';

import { MainThreadNotebookShape, SqlMainContext, INotebookDocumentsAndEditorsDelta,
	ExtHostNotebookDocumentsAndEditorsShape, MainThreadNotebookDocumentsAndEditorsShape
} from 'sql/workbench/api/node/sqlExtHost.protocol';


export class ExtHostNotebookDocumentData implements IDisposable {
	private _document: sqlops.nb.NotebookDocument;
	private _cells: sqlops.nb.NotebookCell[];
	private _isDisposed: boolean = false;

	constructor(private readonly _proxy: MainThreadNotebookDocumentsAndEditorsShape,
		private readonly _uri: URI,
		private readonly _providerId: string,
		private _isDirty: boolean
	) {
		// TODO add cell mapping support
		this._cells = [];
	}

	dispose(): void {
		// we don't really dispose documents but let
		// extensions still read from them. some
		// operations, live saving, will now error tho
		ok(!this._isDisposed);
		this._isDisposed = true;
		this._isDirty = false;
	}


	get document(): sqlops.nb.NotebookDocument {
		if (!this._document) {
			const data = this;
			this._document = {
				get uri() { return data._uri; },
				get fileName() { return data._uri.fsPath; },
				get isUntitled() { return data._uri.scheme === Schemas.untitled; },
				get providerId() { return data._providerId; },
				get isClosed() { return data._isDisposed; },
				get isDirty() { return data._isDirty; },
				get cells() { return data._cells; },
				save() { return data._save(); },
			};
		}
		return Object.freeze(this._document);
	}

	private _save(): Thenable<boolean> {
		if (this._isDisposed) {
			return TPromise.wrapError<boolean>(new Error('Document has been closed'));
		}
		return this._proxy.$trySaveDocument(this._uri);

	}
}

export class ExtHostNotebookEditor implements sqlops.nb.NotebookEditor, IDisposable {
	private _disposed: boolean = false;

	constructor(
		private _proxy: MainThreadNotebookShape,
		private _id: string,
		private readonly _documentData: ExtHostNotebookDocumentData,
		private _viewColumn: vscode.ViewColumn
	) {

	}

	dispose() {
		ok(!this._disposed);
		this._disposed = true;
	}

	get document(): sqlops.nb.NotebookDocument {
		return this._documentData.document;
	}

	set document(value) {
		throw readonly('document');
	}

	get viewColumn(): vscode.ViewColumn {
		return this._viewColumn;
	}

	set viewColumn(value) {
		throw readonly('viewColumn');
	}


	get id(): string {
		return this._id;
	}
}

export class ExtHostNotebookDocumentsAndEditors implements ExtHostNotebookDocumentsAndEditorsShape {

	private _disposables: Disposable[] = [];

	private _activeEditorId: string;
	private _proxy: MainThreadNotebookDocumentsAndEditorsShape;

	private readonly _editors = new Map<string, ExtHostNotebookEditor>();
	private readonly _documents = new Map<string, ExtHostNotebookDocumentData>();

	private readonly _onDidAddDocuments = new Emitter<ExtHostNotebookDocumentData[]>();
	private readonly _onDidRemoveDocuments = new Emitter<ExtHostNotebookDocumentData[]>();
	private readonly _onDidChangeVisibleNotebookEditors = new Emitter<ExtHostNotebookEditor[]>();
	private readonly _onDidChangeActiveNotebookEditor = new Emitter<ExtHostNotebookEditor>();

	readonly onDidAddDocuments: Event<ExtHostNotebookDocumentData[]> = this._onDidAddDocuments.event;
	readonly onDidRemoveDocuments: Event<ExtHostNotebookDocumentData[]> = this._onDidRemoveDocuments.event;
	readonly onDidChangeVisibleNotebookEditors: Event<ExtHostNotebookEditor[]> = this._onDidChangeVisibleNotebookEditors.event;
	readonly onDidChangeActiveNotebookEditor: Event<ExtHostNotebookEditor> = this._onDidChangeActiveNotebookEditor.event;

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
					data.isDirty
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
					this._mainContext.getProxy(SqlMainContext.MainThreadNotebook),
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
		if (delta.removedDocuments) {
			this._onDidRemoveDocuments.fire(removedDocuments);
		}
		if (delta.addedDocuments) {
			this._onDidAddDocuments.fire(addedDocuments);
		}

		if (delta.removedEditors || delta.addedEditors) {
			this._onDidChangeVisibleNotebookEditors.fire(this.getAllEditors());
		}
		if (delta.newActiveEditor !== undefined) {
			this._onDidChangeActiveNotebookEditor.fire(this.getActiveEditor());
		}
	}
	//#endregion

	//#region Extension accessible methods
	showNotebookDocument(uri: vscode.Uri, showOptions: sqlops.nb.NotebookShowOptions): Thenable<sqlops.nb.NotebookEditor> {
		return this.doShowNotebookDocument(uri, showOptions);
	}

	private async doShowNotebookDocument(uri: vscode.Uri, showOptions: sqlops.nb.NotebookShowOptions): Promise<sqlops.nb.NotebookEditor> {
		let id = await this._proxy.$tryShowNotebookDocument(uri, showOptions);
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
