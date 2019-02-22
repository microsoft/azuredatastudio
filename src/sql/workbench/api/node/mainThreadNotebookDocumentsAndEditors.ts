/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { URI, UriComponents } from 'vs/base/common/uri';
import { Event, Emitter } from 'vs/base/common/event';
import { IExtHostContext, IUndoStopOptions } from 'vs/workbench/api/node/extHost.protocol';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { viewColumnToEditorGroup } from 'vs/workbench/api/shared/editor';
import { Schemas } from 'vs/base/common/network';

import {
	SqlMainContext, MainThreadNotebookDocumentsAndEditorsShape, SqlExtHostContext, ExtHostNotebookDocumentsAndEditorsShape,
	INotebookDocumentsAndEditorsDelta, INotebookEditorAddData, INotebookShowOptions, INotebookModelAddedData, INotebookModelChangedData
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { NotebookInputModel, NotebookInput } from 'sql/parts/notebook/notebookInput';
import { INotebookService, INotebookEditor, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/common/notebookService';
import { TPromise } from 'vs/base/common/winjs.base';
import { getProvidersForFileName, getStandardKernelsForProvider } from 'sql/parts/notebook/notebookUtils';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { disposed } from 'vs/base/common/errors';
import { ICellModel, NotebookContentChange, INotebookModel } from 'sql/parts/notebook/models/modelInterfaces';
import { NotebookChangeType, CellTypes } from 'sql/parts/notebook/models/contracts';

class MainThreadNotebookEditor extends Disposable {
	private _contentChangedEmitter = new Emitter<NotebookContentChange>();
	public readonly contentChanged: Event<NotebookContentChange> = this._contentChangedEmitter.event;

	constructor(public readonly editor: INotebookEditor) {
		super();
		editor.modelReady.then(model => {
			this._register(model.contentChanged((e) => this._contentChangedEmitter.fire(e)));
			this._register(model.kernelChanged((e) => {
				let changeEvent: NotebookContentChange = {
					changeType: NotebookChangeType.KernelChanged
				};
				this._contentChangedEmitter.fire(changeEvent);
			}));
		});
	}

	public get uri(): URI {
		return this.editor.notebookParams.notebookUri;
	}

	public get id(): string {
		return this.editor.id;
	}

	public get isDirty(): boolean {
		return this.editor.isDirty();
	}

	public get providerId(): string {
		return this.editor.notebookParams.providerId;
	}

	public get providers(): string[] {
		return this.editor.notebookParams.providers;
	}

	public get cells(): ICellModel[] {
		return this.editor.cells;
	}

	public get model(): INotebookModel | null {
		return this.editor.model;
	}

	public save(): Thenable<boolean> {
		return this.editor.save();
	}

	public matches(input: NotebookInput): boolean {
		if (!input) {
			return false;
		}
		return input === this.editor.notebookParams.input;
	}

	public applyEdits(versionIdCheck: number, edits: ISingleNotebookEditOperation[], opts: IUndoStopOptions): boolean {
		// TODO Handle version tracking
		// if (this._model.getVersionId() !== versionIdCheck) {
		// 	// throw new Error('Model has changed in the meantime!');
		// 	// model changed in the meantime
		// 	return false;
		// }

		if (!this.editor) {
			// console.warn('applyEdits on invisible editor');
			return false;
		}

		// TODO handle undo tracking
		// if (opts.undoStopBefore) {
		// 	this._codeEditor.pushUndoStop();
		// }

		this.editor.executeEdits(edits);
		// if (opts.undoStopAfter) {
		// 	this._codeEditor.pushUndoStop();
		// }
		return true;
	}

	public runCell(cell: ICellModel): Promise<boolean> {
		if (!this.editor) {
			return Promise.resolve(false);
		}

		return this.editor.runCell(cell);
	}
}

function wait(timeMs: number): Promise<void> {
	return new Promise((resolve: Function) => setTimeout(resolve, timeMs));
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
		readonly activeEditor: string) { }
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
		this._register(this._notebookService.onNotebookEditorRename(this._onDidRenameEditor, this));

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

	private _onDidRenameEditor(e: INotebookEditor): void {
		this._updateState();
		//TODO: Close editor and open it
	}

	private _updateState(): void {
		// editor
		const editors = new Map<string, INotebookEditor>();
		let activeEditor: string = undefined;

		for (const editor of this._notebookService.listNotebookEditors()) {
			editors.set(editor.id, editor);
			if (editor.isActive()) {
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
	private _modelToDisposeMap = new Map<string, IDisposable>();
	constructor(
		extHostContext: IExtHostContext,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IEditorGroupsService private _editorGroupService: IEditorGroupsService,
		@INotebookService private readonly _notebookService: INotebookService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostNotebookDocumentsAndEditors);
		}

		// Create a state computer that actually tracks all required changes. This is hooked to onDelta which notifies extension host
		this._register(this._instantiationService.createInstance(MainThreadNotebookDocumentAndEditorStateComputer, delta => this._onDelta(delta)));
	}

	//#region extension host callable APIs
	$trySaveDocument(uri: UriComponents): Thenable<boolean> {
		let uriString = URI.revive(uri).toString();
		let editor = this._notebookEditors.get(uriString);
		if (editor) {
			return editor.save();
		} else {
			return Promise.resolve(false);
		}
	}

	$tryShowNotebookDocument(resource: UriComponents, options: INotebookShowOptions): TPromise<string> {
		return TPromise.wrap(this.doOpenEditor(resource, options));
	}

	$tryApplyEdits(id: string, modelVersionId: number, edits: ISingleNotebookEditOperation[], opts: IUndoStopOptions): TPromise<boolean> {
		let editor = this.getEditor(id);
		if (!editor) {
			return TPromise.wrapError<boolean>(disposed(`TextEditor(${id})`));
		}
		return TPromise.as(editor.applyEdits(modelVersionId, edits, opts));
	}

	$runCell(id: string, cellUri: UriComponents): Promise<boolean> {
		// Requires an editor and the matching cell in that editor
		let editor = this.getEditor(id);
		if (!editor) {
			return Promise.reject(disposed(`TextEditor(${id})`));
		}
		let cell: ICellModel;
		if (cellUri) {
			let uriString = URI.revive(cellUri).toString();
			cell = editor.cells.find(c => c.cellUri.toString() === uriString);
			// If it's markdown what should we do? Show notification??
		} else {
			// Use the active cell in this case, or 1st cell if there's none active
			cell = editor.model.activeCell;
			if (!cell) {
				cell = editor.cells.find(c => c.cellType === CellTypes.Code);
			}
		}
		if (!cell) {
			return Promise.reject(disposed(`Could not find cell for this Notebook`));
		}

		return editor.runCell(cell);
	}

	//#endregion

	private async doOpenEditor(resource: UriComponents, options: INotebookShowOptions): Promise<string> {
		const uri = URI.revive(resource);

		const editorOptions: ITextEditorOptions = {
			preserveFocus: options.preserveFocus,
			pinned: !options.preview
		};
		let trusted = uri.scheme === Schemas.untitled;
		let model = new NotebookInputModel(uri, undefined, trusted, undefined, undefined, undefined, options.connectionId);
		let providerId = options.providerId;
		let providers: string[] = undefined;
		// Ensure there is always a sensible provider ID for this file type
		providers = getProvidersForFileName(uri.fsPath, this._notebookService);
		// Try to use a non-builtin provider first
		if (providers) {
			providerId = providers.find(p => p !== DEFAULT_NOTEBOOK_PROVIDER);
			if (!providerId) {
				providerId = model.providerId;
			}
		}
		model.providers = providers;
		model.providerId = providerId;
		model.defaultKernel = options && options.defaultKernel;
		model.providers.forEach(provider => {
			let standardKernels = getStandardKernelsForProvider(provider, this._notebookService);
			model.standardKernels = standardKernels;
		});
		let input = this._instantiationService.createInstance(NotebookInput, undefined, model);

		let editor = await this._editorService.openEditor(input, editorOptions, viewColumnToEditorGroup(this._editorGroupService, options.position));
		if (!editor) {
			return undefined;
		}
		return this.waitOnEditor(input);
	}

	private async waitOnEditor(input: NotebookInput): Promise<string> {
		let id: string = undefined;
		let attemptsLeft = 10;
		let timeoutMs = 20;
		while (!id && attemptsLeft > 0) {
			id = this.findNotebookEditorIdFor(input);
			if (!id) {
				await wait(timeoutMs);
			}
		}
		return id;
	}

	findNotebookEditorIdFor(input: NotebookInput): string {
		let foundId: string = undefined;
		this._notebookEditors.forEach(e => {
			if (e.matches(input)) {
				foundId = e.id;
			}
		});
		return foundId;
	}

	getEditor(id: string): MainThreadNotebookEditor {
		return this._notebookEditors.get(id);
	}

	private _onDelta(delta: NotebookEditorStateDelta): void {
		let removedEditors: string[] = [];
		let removedDocuments: URI[] = [];
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
				removedDocuments.push(mainThreadEditor.uri);
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
		if (removedDocuments.length > 0) {
			empty = false;
			extHostDelta.removedDocuments = removedDocuments;
		}
		if (removedEditors.length > 0) {
			empty = false;
			extHostDelta.removedEditors = removedEditors;
		}
		if (delta.addedEditors.length > 0) {
			empty = false;
			extHostDelta.addedDocuments = [];
			extHostDelta.addedEditors = [];
			for (let editor of addedEditors) {
				extHostDelta.addedEditors.push(this._toNotebookEditorAddData(editor));
				// For now, add 1 document for each editor. In the future these may be trackable independently
				extHostDelta.addedDocuments.push(this._toNotebookModelAddData(editor));
			}
		}

		if (!empty) {
			this._proxy.$acceptDocumentsAndEditorsDelta(extHostDelta);
			this.processRemovedDocs(removedDocuments);
			this.processAddedDocs(addedEditors);
		}
	}
	processRemovedDocs(removedDocuments: URI[]): void {
		if (!removedDocuments) {
			return;
		}
		removedDocuments.forEach(removedDoc => {
			let listener = this._modelToDisposeMap.get(removedDoc.toString());
			if (listener) {
				listener.dispose();
				this._modelToDisposeMap.delete(removedDoc.toString());
			}
		});
	}

	processAddedDocs(addedEditors: MainThreadNotebookEditor[]): any {
		if (!addedEditors) {
			return;
		}
		addedEditors.forEach(editor => {
			let modelUrl = editor.uri;
			this._modelToDisposeMap.set(editor.uri.toString(), editor.contentChanged((e) => {
				this._proxy.$acceptModelChanged(modelUrl, this._toNotebookChangeData(e, editor));
			}));
		});
	}

	private _toNotebookEditorAddData(editor: MainThreadNotebookEditor): INotebookEditorAddData {
		let addData: INotebookEditorAddData = {
			documentUri: editor.uri,
			editorPosition: undefined,
			id: editor.editor.id
		};
		return addData;
	}

	private _toNotebookModelAddData(editor: MainThreadNotebookEditor): INotebookModelAddedData {
		let addData: INotebookModelAddedData = {
			uri: editor.uri,
			isDirty: editor.isDirty,
			providerId: editor.providerId,
			providers: editor.providers,
			cells: this.convertCellModelToNotebookCell(editor.cells)
		};
		return addData;
	}

	private _toNotebookChangeData(e: NotebookContentChange, editor: MainThreadNotebookEditor): INotebookModelChangedData {
		let changeData: INotebookModelChangedData = {
			// Note: we just send all cells for now, not a diff
			cells: this.convertCellModelToNotebookCell(editor.cells),
			isDirty: e.isDirty,
			providerId: editor.providerId,
			providers: editor.providers,
			uri: editor.uri,
			kernelSpec: this.getKernelSpec(editor)
		};
		return changeData;
	}

	private getKernelSpec(editor: MainThreadNotebookEditor): sqlops.nb.IKernelSpec {
		let spec = editor && editor.model && editor.model.clientSession ? editor.model.clientSession.cachedKernelSpec : undefined;
		return spec;
	}

	private convertCellModelToNotebookCell(cells: ICellModel | ICellModel[]): sqlops.nb.NotebookCell[] {
		let notebookCells: sqlops.nb.NotebookCell[] = [];
		if (Array.isArray(cells)) {
			for (let cell of cells) {
				notebookCells.push({
					uri: cell.cellUri,
					contents: {
						cell_type: cell.cellType,
						execution_count: cell.executionCount,
						metadata: {
							language: cell.language
						},
						source: undefined,
						outputs: [...cell.outputs]
					}
				});
			}
		}
		else {
			notebookCells.push({
				uri: cells.cellUri,
				contents: {
					cell_type: cells.cellType,
					execution_count: undefined,
					metadata: {
						language: cells.language
					},
					source: undefined
				}
			});
		}
		return notebookCells;
	}
}
