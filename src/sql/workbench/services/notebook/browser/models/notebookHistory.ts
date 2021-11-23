/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICellModel, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';

export class NotebookHistory implements INotebookHistory {
	private _undoMaxSize = 10;
	private _undoCells: INotebookCellState[] = [];
	private _redoCells: INotebookCellState[] = [];

	public undo(): INotebookCellState | undefined {
		if (this._undoCells.length > 0) {
			const cell = this._undoCells.pop();
			if (cell) {
				this._redoCells.push(cell);
			}
			return cell;
		}
		return undefined;
	}

	public redo(): INotebookCellState | undefined {
		if (this._redoCells.length > 0) {
			const cell = this._redoCells.pop();
			if (cell) {
				this._undoCells.push(cell);
			}
			return cell;
		}
		return undefined;
	}

	public addCellToUndo(change: INotebookCellState): void {
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

export interface INotebookCellState {
	undoAction: INotebookChange,
	redoAction: INotebookChange
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

interface INotebookHistory {
	undo(): INotebookCellState | undefined;
	redo(): INotebookCellState | undefined;
}
