/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IBookUndoRedoElement {
	readonly label: string;
	undo(): Promise<void> | void;
	redo(): Promise<void> | void;
}

export class BookUndoRedoService {
	private _undoBookChange: IBookUndoRedoElement[] = [];
	private _redoBookChange: IBookUndoRedoElement[] = [];
	private _undoMaxSize = 10;

	constructor() {
	}

	public async undo(): Promise<void> | undefined {
		if (this._undoBookChange.length > 0) {
			const change = this._undoBookChange.pop();
			this._redoBookChange.push(change);
			return change.undo();
		}
		return undefined;
	}

	public async redo(): Promise<void> | undefined {
		if (this._redoBookChange.length > 0) {
			const change = this._redoBookChange.pop();
			this._undoBookChange.push(change);
			return change.redo();
		}
		return undefined;
	}

	public pushElement(change: IBookUndoRedoElement): void {
		if (this._undoBookChange.length < this._undoMaxSize) {
			this._undoBookChange.push(change);
			this._redoBookChange = [];
		} else {
			this._undoBookChange.shift();
		}
	}
}
