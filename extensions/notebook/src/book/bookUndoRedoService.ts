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
	private _undoStack: IBookUndoRedoElement[] = [];
	private _redoStack: IBookUndoRedoElement[] = [];
	private _undoMaxSize = 10;

	constructor() {
	}

	public async undo(): Promise<void> | undefined {
		if (this._undoStack.length > 0) {
			const change = this._undoStack.pop();
			this._redoStack.push(change);
			return change.undo();
		}
		return undefined;
	}

	public async redo(): Promise<void> | undefined {
		if (this._redoStack.length > 0) {
			const change = this._redoStack.pop();
			this._undoStack.push(change);
			return change.redo();
		}
		return undefined;
	}

	public pushElement(change: IBookUndoRedoElement): void {
		if (this._undoStack.length >= this._undoMaxSize) {
			this._undoStack.shift();
		}
		this._undoStack.push(change);
		this._redoStack = [];
	}
}
