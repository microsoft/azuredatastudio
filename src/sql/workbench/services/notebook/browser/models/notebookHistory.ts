/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICellModel, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';

export class NotebookHistory {
	private _undoMaxSize = 10;
	private _undoCells: INotebookUndoRedoElement[] = [];
	private _redoCells: INotebookUndoRedoElement[] = [];

	public popUndo(): INotebookChange | undefined {
		if (this._undoCells.length > 0) {
			const cell = this._undoCells.pop();
			this._redoCells.push(cell);
			return cell.undo;
		}
		return undefined;
	}

	public popRedo(): INotebookChange | undefined {
		if (this._redoCells.length > 0) {
			const cell = this._redoCells.pop();
			this._undoCells.push(cell);
			return cell.redo;
		}
		return undefined;
	}

	public addCellToUndo(change: INotebookUndoRedoElement): void {
		if (this._undoCells.length < this._undoMaxSize) {
			this._undoCells.push(change);
			this._redoCells = [];
		} else {
			// remove the oldest undo
			this._undoCells.shift();
		}
	}

	public get undoCells() {
		return this._undoCells;
	}
}

export interface INotebookUndoRedoElement {
	undo: INotebookChange,
	redo: INotebookChange
}

export interface INotebookChange {
	op: CellOperation,
	index?: number,
	cell: ICellModel,
	direction?: MoveDirection
}

export enum CellOperation {
	'DELETE',
	'CREATE',
	'MOVE'
}
