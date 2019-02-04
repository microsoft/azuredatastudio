/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

import { ok } from 'vs/base/common/assert';
import { IDisposable } from 'vs/base/common/lifecycle';
import { readonly } from 'vs/base/common/errors';
import { TPromise } from 'vs/base/common/winjs.base';

import { MainThreadNotebookDocumentsAndEditorsShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ExtHostNotebookDocumentData } from 'sql/workbench/api/node/extHostNotebookDocumentData';
import { CellRange, ISingleNotebookEditOperation, ICellRange } from 'sql/workbench/api/common/sqlExtHostTypes';

export interface INotebookEditOperation {
	range: sqlops.nb.CellRange;
	cell: Partial<sqlops.nb.ICellContents>;
	forceMoveMarkers: boolean;
}

export interface INotebookEditData {
	documentVersionId: number;
	edits: INotebookEditOperation[];
	undoStopBefore: boolean;
	undoStopAfter: boolean;
}

function toICellRange(range: sqlops.nb.CellRange): ICellRange {
	return {
		start: range.start,
		end: range.end
	};
}

export class NotebookEditorEdit {

	private readonly _document: sqlops.nb.NotebookDocument;
	private readonly _documentVersionId: number;
	private _collectedEdits: INotebookEditOperation[];
	private readonly _undoStopBefore: boolean;
	private readonly _undoStopAfter: boolean;

	constructor(document: sqlops.nb.NotebookDocument, options: { undoStopBefore: boolean; undoStopAfter: boolean; }) {
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

	replace(location: number | CellRange, value: Partial<sqlops.nb.ICellContents>): void {
		let range: CellRange = this.getAsRange(location);
		this._pushEdit(range, value, false);
	}

	private getAsRange(location: number | CellRange): CellRange {
		let range: CellRange = null;
		if (typeof (location) === 'number') {
			range = new CellRange(location, location+1);
		}
		else if (location instanceof CellRange) {
			range = location;
		}
		else {
			throw new Error('Unrecognized location');
		}
		return range;
	}

	insertCell(value:  Partial<sqlops.nb.ICellContents>, location?: number): void {
		if (location === null || location === undefined) {
			// If not specified, assume adding to end of list
			location = this._document.cells.length;
		}
		this._pushEdit(new CellRange(location, location), value, true);
	}

	deleteCell(index: number): void {
		let range: CellRange = null;

		if (typeof(index) === 'number') {
			// Currently only allowing single-cell deletion.
			// Do this by saying the range extends over 1 cell so on the main thread
			// we can delete that cell, then handle insertions
			range = new CellRange(index, index+1);
		} else {
			throw new Error('Unrecognized index');
		}

		this._pushEdit(range, null, true);
	}

	private _pushEdit(range: sqlops.nb.CellRange, cell:  Partial<sqlops.nb.ICellContents>, forceMoveMarkers: boolean): void {
		let validRange = this._document.validateCellRange(range);
		this._collectedEdits.push({
			range: validRange,
			cell: cell,
			forceMoveMarkers: forceMoveMarkers
		});
	}
}

export class ExtHostNotebookEditor implements sqlops.nb.NotebookEditor, IDisposable {
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

	public runCell(cell: sqlops.nb.NotebookCell): Thenable<boolean> {
		let uri = cell ? cell.uri : undefined;
		return this._proxy.$runCell(this._id, uri);
	}

	public edit(callback: (editBuilder: sqlops.nb.NotebookEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean> {
		if (this._disposed) {
			return TPromise.wrapError<boolean>(new Error('NotebookEditor#edit not possible on closed editors'));
		}
		let edit = new NotebookEditorEdit(this._documentData.document, options);
		callback(edit);
		return this._applyEdit(edit);
	}

	private _applyEdit(editBuilder: NotebookEditorEdit): TPromise<boolean> {
		let editData = editBuilder.finalize();

		// return when there is nothing to do
		if (editData.edits.length === 0) {
			return TPromise.wrap(true);
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
				return TPromise.wrapError<boolean>(
					new Error('Overlapping ranges are not allowed!')
				);
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
