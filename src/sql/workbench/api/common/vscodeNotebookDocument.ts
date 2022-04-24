/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { convertToVSCodeNotebookCell } from 'sql/workbench/api/common/vscodeExecuteProvider';

export class VSCodeNotebookDocument implements vscode.NotebookDocument {
	private readonly _convertedCells: vscode.NotebookCell[];

	constructor(private readonly _notebookDoc: azdata.nb.NotebookDocument) {
		this._convertedCells = this._notebookDoc.cells?.map((cell, index) => convertToVSCodeNotebookCell(cell.contents.source, index, this._notebookDoc.uri, this._notebookDoc.kernelSpec?.language));
	}

	public get uri() { return this._notebookDoc.uri; }

	public get version() { return undefined; }

	public get notebookType() { return this._notebookDoc.providerId; }

	public get isDirty() { return this._notebookDoc.isDirty; }

	public get isUntitled() { return this._notebookDoc.isUntitled; }

	public get isClosed() { return this._notebookDoc.isClosed; }

	public get metadata() { return {}; }

	public get cellCount() { return this._notebookDoc.cells?.length; }

	cellAt(index: number): vscode.NotebookCell {
		if (this._notebookDoc.cells) {
			if (index < 0) {
				index = 0;
			} else if (index >= this._notebookDoc.cells.length) {
				index = this._convertedCells.length - 1;
			}
			return this._convertedCells[index];
		}
		return undefined;
	}

	getCells(range?: vscode.NotebookRange): vscode.NotebookCell[] {
		let cells: vscode.NotebookCell[] = [];
		if (range) {
			cells = this._convertedCells?.slice(range.start, range.end);
		} else {
			cells = this._convertedCells;
		}
		return cells;
	}

	save(): Thenable<boolean> {
		return this._notebookDoc.save();
	}
}
