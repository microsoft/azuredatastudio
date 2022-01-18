/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { Event, Emitter } from 'vs/base/common/event';
import { dispose } from 'vs/base/common/lifecycle';
import { URI, UriComponents } from 'vs/base/common/uri';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import * as typeConverters from 'vs/workbench/api/common/extHostTypeConverters';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { ok } from 'vs/base/common/assert';
import { localize } from 'vs/nls';

import {
	SqlMainContext, INotebookDocumentsAndEditorsDelta, ExtHostNotebookDocumentsAndEditorsShape,
	MainThreadNotebookDocumentsAndEditorsShape, INotebookShowOptions, INotebookModelChangedData
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ExtHostNotebookDocumentData } from 'sql/workbench/api/common/extHostNotebookDocumentData';
import { ExtHostNotebookEditor } from 'sql/workbench/api/common/extHostNotebookEditor';
import { VSCodeNotebookDocument } from 'sql/workbench/api/common/notebooks/vscodeNotebookDocument';

type Adapter = azdata.nb.NavigationProvider;

export class ExtHostNotebookDocumentsAndEditors implements ExtHostNotebookDocumentsAndEditorsShape {
	private static _handlePool: number = 0;

	private _disposables: Disposable[] = [];
	private _adapters = new Map<number, Adapter>();

	private _activeEditorId: string;
	private _proxy: MainThreadNotebookDocumentsAndEditorsShape;

	private readonly _editors = new Map<string, ExtHostNotebookEditor>();
	private readonly _documents = new Map<string, ExtHostNotebookDocumentData>();

	private readonly _onDidChangeVisibleNotebookEditors = new Emitter<ExtHostNotebookEditor[]>();
	private readonly _onDidChangeActiveNotebookEditor = new Emitter<ExtHostNotebookEditor>();
	private _onDidOpenNotebook = new Emitter<azdata.nb.NotebookDocument>();
	private _onDidCloseNotebook = new Emitter<azdata.nb.NotebookDocument>();
	private _onDidChangeNotebookCell = new Emitter<azdata.nb.NotebookCellChangeEvent>();

	readonly onDidChangeVisibleNotebookEditors: Event<ExtHostNotebookEditor[]> = this._onDidChangeVisibleNotebookEditors.event;
	readonly onDidChangeActiveNotebookEditor: Event<ExtHostNotebookEditor> = this._onDidChangeActiveNotebookEditor.event;
	readonly onDidOpenNotebookDocument: Event<azdata.nb.NotebookDocument> = this._onDidOpenNotebook.event;
	readonly onDidCloseNotebookDocument: Event<azdata.nb.NotebookDocument> = this._onDidCloseNotebook.event;
	readonly onDidChangeNotebookCell: Event<azdata.nb.NotebookCellChangeEvent> = this._onDidChangeNotebookCell.event;

	private _onDidOpenVSCodeNotebook = new Emitter<vscode.NotebookDocument>();
	private _onDidCloseVSCodeNotebook = new Emitter<vscode.NotebookDocument>();
	readonly onDidOpenVSCodeNotebookDocument: Event<vscode.NotebookDocument> = this._onDidOpenVSCodeNotebook.event;
	readonly onDidCloseVSCodeNotebookDocument: Event<vscode.NotebookDocument> = this._onDidCloseVSCodeNotebook.event;

	constructor(
		private readonly _mainContext: IMainContext,
	) {
		if (this._mainContext) {
			this._proxy = this._mainContext.getProxy(SqlMainContext.MainThreadNotebookDocumentsAndEditors);
		}

		this.onDidOpenNotebookDocument(notebook => this._onDidOpenVSCodeNotebook.fire(new VSCodeNotebookDocument(notebook)));
		this.onDidCloseNotebookDocument(notebook => this._onDidCloseVSCodeNotebook.fire(new VSCodeNotebookDocument(notebook)));
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
					typeof data.editorPosition === 'number' ? typeConverters.ViewColumn.to(data.editorPosition) : undefined
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
			removedDocuments.forEach(d => this._onDidCloseNotebook.fire(d.document));
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
				kind: e.changeKind
			});
		}
	}

	private _nextHandle(): number {
		return ExtHostNotebookDocumentsAndEditors._handlePool++;
	}

	private _addNewAdapter(adapter: Adapter): number {
		const handle = this._nextHandle();
		this._adapters.set(handle, adapter);
		return handle;
	}

	private _getAdapter<T>(id: number): T {
		let adapter = <T><any>this._adapters.get(id);
		if (adapter === undefined) {
			throw new Error('No adapter found');
		}
		return adapter;
	}

	$getNavigation(handle: number, notebookUri: UriComponents): Thenable<azdata.nb.NavigationResult> {
		let navProvider = this._getAdapter<azdata.nb.NavigationProvider>(handle);
		if (navProvider) {
			let uri = URI.revive(notebookUri);
			return navProvider.getNavigation(uri);
		}
		throw new Error('No navigation provider found for handle ${handle}');
	}

	//#endregion

	//#region Extension accessible methods
	showNotebookDocument(uri: vscode.Uri, showOptions: azdata.nb.NotebookShowOptions): Thenable<azdata.nb.NotebookEditor> {
		return this.doShowNotebookDocument(uri, showOptions);
	}

	private async doShowNotebookDocument(uri: vscode.Uri, showOptions: azdata.nb.NotebookShowOptions): Promise<azdata.nb.NotebookEditor> {
		let options: INotebookShowOptions = {};
		if (showOptions) {
			options.preserveFocus = showOptions.preserveFocus;
			options.preview = showOptions.preview;
			options.position = showOptions.viewColumn;
			options.providerId = showOptions.providerId;
			options.connectionProfile = showOptions.connectionProfile;
			options.defaultKernel = showOptions.defaultKernel;
			if (showOptions.initialContent) {
				if (typeof (showOptions.initialContent) !== 'string') {
					options.initialContent = JSON.stringify(showOptions.initialContent);
				} else {
					options.initialContent = showOptions.initialContent;
				}
			}
			options.initialDirtyState = showOptions.initialDirtyState;
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

	registerNavigationProvider(provider: azdata.nb.NavigationProvider): vscode.Disposable {
		if (!provider || !provider.providerId) {
			throw new Error(localize('navigationProviderRequired', "A NavigationProvider with valid providerId must be passed to this method"));
		}
		const handle = this._addNewAdapter(provider);
		this._proxy.$registerNavigationProvider(provider.providerId, handle);
		return new Disposable(() => {
			this._adapters.delete(handle);
		});
	}

	createNotebookDocument(providerId: string, contents: azdata.nb.INotebookContents): Promise<azdata.nb.NotebookDocument> {
		return this._proxy.$createNotebookDocument(providerId, contents);
	}
	//#endregion
}
