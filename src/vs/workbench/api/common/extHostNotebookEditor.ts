/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainThreadNotebookEditorsShape } from 'vs/workbench/api/common/extHost.protocol';
import * as extHostTypes from 'vs/workbench/api/common/extHostTypes';
import * as extHostConverter from 'vs/workbench/api/common/extHostTypeConverters';
import { CellEditType, ICellEditOperation, ICellReplaceEdit } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import * as vscode from 'vscode';
import { ExtHostNotebookDocument } from './extHostNotebookDocument';
import { illegalArgument } from 'vs/base/common/errors';

interface INotebookEditData {
	documentVersionId: number;
	cellEdits: ICellEditOperation[];
}

class NotebookEditorCellEditBuilder implements vscode.NotebookEditorEdit {

	private readonly _documentVersionId: number;

	private _finalized: boolean = false;
	private _collectedEdits: ICellEditOperation[] = [];

	constructor(documentVersionId: number) {
		this._documentVersionId = documentVersionId;
	}

	finalize(): INotebookEditData {
		this._finalized = true;
		return {
			documentVersionId: this._documentVersionId,
			cellEdits: this._collectedEdits
		};
	}

	private _throwIfFinalized() {
		if (this._finalized) {
			throw new Error('Edit is only valid while callback runs');
		}
	}

	replaceMetadata(value: { [key: string]: any }): void {
		this._throwIfFinalized();
		this._collectedEdits.push({
			editType: CellEditType.DocumentMetadata,
			metadata: value
		});
	}

	replaceCellMetadata(index: number, metadata: Record<string, any>): void {
		this._throwIfFinalized();
		this._collectedEdits.push({
			editType: CellEditType.Metadata,
			index,
			metadata
		});
	}

	replaceCells(from: number, to: number, cells: vscode.NotebookCellData[]): void {
		this._throwIfFinalized();
		if (from === to && cells.length === 0) {
			return;
		}
		this._collectedEdits.push({
			editType: CellEditType.Replace,
			index: from,
			count: to - from,
			cells: cells.map(extHostConverter.NotebookCellData.from)
		});
	}
}

export class ExtHostNotebookEditor {

	public static readonly apiEditorsToExtHost = new WeakMap<vscode.NotebookEditor, ExtHostNotebookEditor>();

	private _selections: vscode.NotebookRange[] = [];
	private _visibleRanges: vscode.NotebookRange[] = [];
	private _viewColumn?: vscode.ViewColumn;

	private _visible: boolean = false;
	private readonly _hasDecorationsForKey = new Set<string>();

	private _editor?: vscode.NotebookEditor;

	constructor(
		readonly id: string,
		private readonly _proxy: MainThreadNotebookEditorsShape,
		readonly notebookData: ExtHostNotebookDocument,
		visibleRanges: vscode.NotebookRange[],
		selections: vscode.NotebookRange[],
		viewColumn: vscode.ViewColumn | undefined
	) {
		this._selections = selections;
		this._visibleRanges = visibleRanges;
		this._viewColumn = viewColumn;
	}

	get apiEditor(): vscode.NotebookEditor {
		if (!this._editor) {
			const that = this;
			this._editor = {
				get document() {
					return that.notebookData.apiNotebook;
				},
				get selections() {
					return that._selections;
				},
				set selections(value: vscode.NotebookRange[]) {
					if (!Array.isArray(value) || !value.every(extHostTypes.NotebookRange.isNotebookRange)) {
						throw illegalArgument('selections');
					}
					that._selections = value;
					that._trySetSelections(value);
				},
				get visibleRanges() {
					return that._visibleRanges;
				},
				revealRange(range, revealType) {
					that._proxy.$tryRevealRange(
						that.id,
						extHostConverter.NotebookRange.from(range),
						revealType ?? extHostTypes.NotebookEditorRevealType.Default
					);
				},
				get viewColumn() {
					return that._viewColumn;
				},
				edit(callback) {
					const edit = new NotebookEditorCellEditBuilder(this.document.version);
					callback(edit);
					return that._applyEdit(edit.finalize());
				},
				setDecorations(decorationType, range) {
					return that.setDecorations(decorationType, range);
				}
			};

			ExtHostNotebookEditor.apiEditorsToExtHost.set(this._editor, this);
		}
		return this._editor;
	}

	get visible(): boolean {
		return this._visible;
	}

	_acceptVisibility(value: boolean) {
		this._visible = value;
	}

	_acceptVisibleRanges(value: vscode.NotebookRange[]): void {
		this._visibleRanges = value;
	}

	_acceptSelections(selections: vscode.NotebookRange[]): void {
		this._selections = selections;
	}

	private _trySetSelections(value: vscode.NotebookRange[]): void {
		this._proxy.$trySetSelections(this.id, value.map(extHostConverter.NotebookRange.from));
	}

	_acceptViewColumn(value: vscode.ViewColumn | undefined) {
		this._viewColumn = value;
	}

	private _applyEdit(editData: INotebookEditData): Promise<boolean> {

		// return when there is nothing to do
		if (editData.cellEdits.length === 0) {
			return Promise.resolve(true);
		}

		const compressedEdits: ICellEditOperation[] = [];
		let compressedEditsIndex = -1;

		for (let i = 0; i < editData.cellEdits.length; i++) {
			if (compressedEditsIndex < 0) {
				compressedEdits.push(editData.cellEdits[i]);
				compressedEditsIndex++;
				continue;
			}

			const prevIndex = compressedEditsIndex;
			const prev = compressedEdits[prevIndex];

			const edit = editData.cellEdits[i];
			if (prev.editType === CellEditType.Replace && edit.editType === CellEditType.Replace) {
				if (prev.index === edit.index) {
					prev.cells.push(...(editData.cellEdits[i] as ICellReplaceEdit).cells);
					prev.count += (editData.cellEdits[i] as ICellReplaceEdit).count;
					continue;
				}
			}

			compressedEdits.push(editData.cellEdits[i]);
			compressedEditsIndex++;
		}

		return this._proxy.$tryApplyEdits(this.id, editData.documentVersionId, compressedEdits);
	}

	setDecorations(decorationType: vscode.NotebookEditorDecorationType, range: vscode.NotebookRange): void {
		if (range.isEmpty && !this._hasDecorationsForKey.has(decorationType.key)) {
			// avoid no-op call to the renderer
			return;
		}
		if (range.isEmpty) {
			this._hasDecorationsForKey.delete(decorationType.key);
		} else {
			this._hasDecorationsForKey.add(decorationType.key);
		}

		return this._proxy.$trySetDecorations(
			this.id,
			extHostConverter.NotebookRange.from(range),
			decorationType.key
		);
	}
}
