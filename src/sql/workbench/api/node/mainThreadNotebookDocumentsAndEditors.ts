/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';

import { SqlMainContext, MainThreadNotebookDocumentsAndEditorsShape, SqlExtHostContext, ExtHostNotebookDocumentsAndEditorsShape, INotebookDocumentsAndEditorsDelta, INotebookEditorAddData } from 'sql/workbench/api/node/sqlExtHost.protocol';
import URI, { UriComponents } from 'vs/base/common/uri';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { INotebookService, INotebookEditor } from 'sql/services/notebook/notebookService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

class MainThreadNotebookEditor extends Disposable {

	constructor(public readonly editor: INotebookEditor) {
		super();
	}

	public save(): Thenable<boolean> {
		return this.editor.save();
	}
}

namespace mapset {

	export function setValues<T>(set: Set<T>): T[] {
		// return Array.from(set);
		let ret: T[] = [];
		set.forEach(v => ret.push(v));
		return ret;
	}

	export function mapValues<T>(map: Map<any, T>): T[] {
		// return Array.from(map.values());
		let ret: T[] = [];
		map.forEach(v => ret.push(v));
		return ret;
	}
}

namespace delta {

	export function ofSets<T>(before: Set<T>, after: Set<T>): { removed: T[], added: T[] } {
		const removed: T[] = [];
		const added: T[] = [];
		before.forEach(element => {
			if (!after.has(element)) {
				removed.push(element);
			}
		});
		after.forEach(element => {
			if (!before.has(element)) {
				added.push(element);
			}
		});
		return { removed, added };
	}

	export function ofMaps<K, V>(before: Map<K, V>, after: Map<K, V>): { removed: V[], added: V[] } {
		const removed: V[] = [];
		const added: V[] = [];
		before.forEach((value, index) => {
			if (!after.has(index)) {
				removed.push(value);
			}
		});
		after.forEach((value, index) => {
			if (!before.has(index)) {
				added.push(value);
			}
		});
		return { removed, added };
	}
}

class NotebookEditorStateDelta {

	readonly isEmpty: boolean;

	constructor(
		readonly removedEditors: INotebookEditor[],
		readonly addedEditors: INotebookEditor[],
		readonly oldActiveEditor: string,
		readonly newActiveEditor: string,
	) {
		this.isEmpty =
			this.removedEditors.length === 0
			&& this.addedEditors.length === 0
			&& oldActiveEditor === newActiveEditor;
	}

	toString(): string {
		let ret = 'NotebookEditorStateDelta\n';
		ret += `\tRemoved Editors: [${this.removedEditors.map(e => e.id).join(', ')}]\n`;
		ret += `\tAdded Editors: [${this.addedEditors.map(e => e.id).join(', ')}]\n`;
		ret += `\tNew Active Editor: ${this.newActiveEditor}\n`;
		return ret;
	}
}

class NotebookEditorState {

	static compute(before: NotebookEditorState, after: NotebookEditorState): NotebookEditorStateDelta {
		if (!before) {
			return new NotebookEditorStateDelta(
				[], mapset.mapValues(after.textEditors),
				undefined, after.activeEditor
			);
		}
		const editorDelta = delta.ofMaps(before.textEditors, after.textEditors);
		const oldActiveEditor = before.activeEditor !== after.activeEditor ? before.activeEditor : undefined;
		const newActiveEditor = before.activeEditor !== after.activeEditor ? after.activeEditor : undefined;

		return new NotebookEditorStateDelta(
			editorDelta.removed, editorDelta.added,
			oldActiveEditor, newActiveEditor
		);
	}

	constructor(
		readonly textEditors: Map<string, INotebookEditor>,
		readonly activeEditor: string) {}
}

class MainThreadNotebookDocumentAndEditorStateComputer extends Disposable {

	private _currentState: NotebookEditorState;

	constructor(
		private readonly _onDidChangeState: (delta: NotebookEditorStateDelta) => void,
		@IEditorService private readonly _editorService: IEditorService,
		@INotebookService private readonly _notebookService: INotebookService
	) {
		super();
		this._register(this._editorService.onDidActiveEditorChange(this._updateState, this));
		this._register(this._editorService.onDidVisibleEditorsChange(this._updateState, this));
		this._register(this._notebookService.onNotebookEditorAdd(this._onDidAddEditor, this));
		this._register(this._notebookService.onNotebookEditorRemove(this._onDidRemoveEditor, this));

		this._updateState();
	}

	private _onDidAddEditor(e: INotebookEditor): void {
		// TODO hook to cell change and other events
		this._updateState();
	}

	private _onDidRemoveEditor(e: INotebookEditor): void {
		// TODO remove event listeners
		this._updateState();
	}

	private _updateState(): void {
		// editor
		const editors = new Map<string, INotebookEditor>();
		let activeEditor: string = null;

		for (const editor of this._notebookService.listNotebookEditors()) {
			editors.set(editor.id, editor);
			if (editor.isActive) {
				activeEditor = editor.id;
			}
		}

		// compute new state and compare against old
		const newState = new NotebookEditorState(editors, activeEditor);
		const delta = NotebookEditorState.compute(this._currentState, newState);
		if (!delta.isEmpty) {
			this._currentState = newState;
			this._onDidChangeState(delta);
		}
	}
}


@extHostNamedCustomer(SqlMainContext.MainThreadNotebookDocumentsAndEditors)
export class MainThreadNotebookDocumentsAndEditors extends Disposable implements MainThreadNotebookDocumentsAndEditorsShape {
	private _proxy: ExtHostNotebookDocumentsAndEditorsShape;
	private _notebookEditors = new Map<string, MainThreadNotebookEditor>();
	private _stateComputer: MainThreadNotebookDocumentAndEditorStateComputer
	constructor(
		extHostContext: IExtHostContext,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostNotebookDocumentsAndEditors);
		}
		this._stateComputer = instantiationService.createInstance(MainThreadNotebookDocumentAndEditorStateComputer, delta => this._onDelta(delta));
	}

	$trySaveDocument(uri: UriComponents): Thenable<boolean> {
		let uriString = URI.revive(uri).toString();
		let editor = this._notebookEditors.get(uriString);
		if (editor) {
			return editor.save();
		} else {
			return Promise.resolve(false);
		}
	}


	private _onDelta(delta: NotebookEditorStateDelta): void {
		let removedEditors: string[] = [];
		let addedEditors: MainThreadNotebookEditor[] = [];

		// added editors
		for (const editor of delta.addedEditors) {
			const mainThreadEditor = new MainThreadNotebookEditor(editor);

			this._notebookEditors.set(editor.id, mainThreadEditor);
			addedEditors.push(mainThreadEditor);
		}

		// removed editors
		for (const { id } of delta.removedEditors) {
			const mainThreadEditor = this._notebookEditors.get(id);
			if (mainThreadEditor) {
				mainThreadEditor.dispose();
				this._notebookEditors.delete(id);
				removedEditors.push(id);
			}
		}

		let extHostDelta: INotebookDocumentsAndEditorsDelta = Object.create(null);
		let empty = true;
		if (delta.newActiveEditor !== undefined) {
			empty = false;
			extHostDelta.newActiveEditor = delta.newActiveEditor;
		}
		if (removedEditors.length > 0) {
			empty = false;
			extHostDelta.removedEditors = removedEditors;
		}
		if (delta.addedEditors.length > 0) {
			empty = false;
			extHostDelta.addedEditors = addedEditors.map(e => this._toNotebookEditorAddData(e));
		}

		if (!empty) {
			this._proxy.$acceptDocumentsAndEditorsDelta(extHostDelta);
		}
	}

	private _toNotebookEditorAddData(editor: MainThreadNotebookEditor): INotebookEditorAddData {
		let addData: INotebookEditorAddData = {
			documentUri: editor.editor.notebookParams.notebookUri,
			editorPosition: undefined,
			id: editor.editor.id
		};
		return addData;
	}
}
