/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { ok } from 'vs/base/common/assert';
import { IDisposable } from 'vs/base/common/lifecycle';
import { readonly } from 'vs/base/common/errors';

import { MainThreadNotebookDocumentsAndEditorsShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ExtHostNotebookDocumentData } from 'sql/workbench/api/common/extHostNotebookDocumentData';
import { CellRange, ISingleNotebookEditOperation, ICellRange } from 'sql/workbench/api/common/sqlExtHostTypes';
import { find } from 'vs/base/common/arrays';
import { HideInputTag } from 'sql/platform/notebooks/common/outputRegistry';

export interface INotebookEditOperation {
	range: azdata.nb.CellRange;
	cell: Partial<azdata.nb.ICellContents>;
	forceMoveMarkers: boolean;
}

export interface INotebookEditData {
	documentVersionId: number;
	edits: INotebookEditOperation[];
	undoStopBefore: boolean;
	undoStopAfter: boolean;
}

function toICellRange(range: azdata.nb.CellRange): ICellRange {
	return {
		start: range.start,
		end: range.end
	};
}

export class NotebookEditorEdit {

	private readonly _document: azdata.nb.NotebookDocument;
	private readonly _documentVersionId: number;
	private _collectedEdits: INotebookEditOperation[];
	private readonly _undoStopBefore: boolean;
	private readonly _undoStopAfter: boolean;

	constructor(document: azdata.nb.NotebookDocument, options: { undoStopBefore: boolean; undoStopAfter: boolean; }) {
		this._document = document;
		// TODO add version handling
		this._documentVersionId = 0;
		// this._documentVersionId = document.version;
		this._collectedEdits = [];
		this._undoStopBefore = options ? options.undoStopBefore : true;
		this._undoStopAfter = options ? options.undoStopAfter : false;
	}

	finalize(): INotebookEditData {
		return {
			documentVersionId: this._documentVersionId,
			edits: this._collectedEdits,
			undoStopBefore: this._undoStopBefore,
			undoStopAfter: this._undoStopAfter
		};
	}

	replace(location: number | CellRange, value: Partial<azdata.nb.ICellContents>): void {
		let range: CellRange = this.getAsRange(location);
		this._pushEdit(range, value, false);
	}

	private getAsRange(location: number | CellRange): CellRange {
		let range: CellRange = null;
		if (typeof (location) === 'number') {
			range = new CellRange(location, location + 1);
		}
		else if (location instanceof CellRange) {
			range = location;
		}
		else {
			throw new Error('Unrecognized location');
		}
		return range;
	}

	setTrusted(isTrusted: boolean) {
		this._document.setTrusted(isTrusted);
	}

	insertCell(value: Partial<azdata.nb.ICellContents>, index?: number, collapsed?: boolean): void {
		if (index === null || index === undefined) {
			// If not specified, assume adding to end of list
			index = this._document.cells.length;
		}
		if (!!collapsed) {
			if (!value.metadata) {
				value.metadata = { tags: [HideInputTag] };
			} else if (!value.metadata.tags) {
				value.metadata.tags = [HideInputTag];
			} else if (!find(value.metadata.tags, x => x === HideInputTag)) {
				value.metadata.tags.push(HideInputTag);
			}
		}
		this._pushEdit(new CellRange(index, index), value, true);
	}

	deleteCell(index: number): void {
		let range: CellRange = null;

		if (typeof (index) === 'number') {
			// Currently only allowing single-cell deletion.
			// Do this by saying the range extends over 1 cell so on the main thread
			// we can delete that cell, then handle insertions
			range = new CellRange(index, index + 1);
		} else {
			throw new Error('Unrecognized index');
		}

		this._pushEdit(range, null, true);
	}

	private _pushEdit(range: azdata.nb.CellRange, cell: Partial<azdata.nb.ICellContents>, forceMoveMarkers: boolean): void {
		let validRange = this._document.validateCellRange(range);
		this._collectedEdits.push({
			range: validRange,
			cell: cell,
			forceMoveMarkers: forceMoveMarkers
		});
	}
}

export class ExtHostNotebookEditor implements azdata.nb.NotebookEditor, IDisposable {
	private _disposed: boolean = false;

	constructor(
		private _proxy: MainThreadNotebookDocumentsAndEditorsShape,
		private _id: string,
		private readonly _documentData: ExtHostNotebookDocumentData,
		private _viewColumn: vscode.ViewColumn
	) {

	}

	dispose() {
		ok(!this._disposed);
		this._disposed = true;
	}

	get document(): azdata.nb.NotebookDocument {
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

	public runCell(cell: azdata.nb.NotebookCell): Thenable<boolean> {
		let uri = cell ? cell.uri : undefined;
		return this._proxy.$runCell(this._id, uri);
	}

	public runAllCells(startCell?: azdata.nb.NotebookCell, endCell?: azdata.nb.NotebookCell): Thenable<boolean> {
		let startCellUri = startCell ? startCell.uri : undefined;
		let endCellUri = endCell ? endCell.uri : undefined;
		return this._proxy.$runAllCells(this._id, startCellUri, endCellUri);
	}

	public clearOutput(cell: azdata.nb.NotebookCell): Thenable<boolean> {
		let uri = cell ? cell.uri : undefined;
		return this._proxy.$clearOutput(this._id, uri);
	}

	public clearAllOutputs(): Thenable<boolean> {
		return this._proxy.$clearAllOutputs(this._id);
	}

	public changeKernel(kernel: azdata.nb.IKernelSpec): Thenable<boolean> {
		return this._proxy.$changeKernel(this._id, kernel);
	}

	public edit(callback: (editBuilder: azdata.nb.NotebookEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean> {
		if (this._disposed) {
			return Promise.reject(new Error('NotebookEditor#edit not possible on closed editors'));
		}
		let edit = new NotebookEditorEdit(this._documentData.document, options);
		callback(edit);
		return this._applyEdit(edit);
	}

	private _applyEdit(editBuilder: NotebookEditorEdit): Promise<boolean> {
		let editData = editBuilder.finalize();

		// return when there is nothing to do
		if (editData.edits.length === 0) {
			return Promise.resolve(true);
		}

		// check that the edits are not overlapping (i.e. illegal)
		let editRanges = editData.edits.map(edit => edit.range);

		// sort ascending (by end and then by start)
		editRanges.sort((a, b) => {
			if (a.end === b.end) {
				return a.start - b.start;
			}
			return a.end - b.end;
		});

		// check that no edits are overlapping
		for (let i = 0, count = editRanges.length - 1; i < count; i++) {
			const rangeEnd = editRanges[i].end;
			const nextRangeStart = editRanges[i + 1].start;

			if (nextRangeStart < rangeEnd) {
				// overlapping ranges
				return Promise.reject(new Error('Overlapping ranges are not allowed!'));
			}
		}

		// prepare data for serialization
		let edits: ISingleNotebookEditOperation[] = editData.edits.map((edit) => {
			return {
				range: toICellRange(edit.range),
				cell: edit.cell,
				forceMoveMarkers: edit.forceMoveMarkers
			};
		});

		return this._proxy.$tryApplyEdits(this._id, editData.documentVersionId, edits, {
			undoStopBefore: editData.undoStopBefore,
			undoStopAfter: editData.undoStopAfter
		});
	}
}
