/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IResourceUndoRedoElement, UndoRedoElementType } from 'vs/platform/undoRedo/common/undoRedo';
import { ICellModel, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';

export class MoveCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = 'Move Cell';
	resource = this.model.notebookUri;

	constructor(private model: NotebookModel, private cell: ICellModel, private moveDirection: MoveDirection) {
	}

	undo(): void {
		const direction = this.moveDirection === MoveDirection.Down ? MoveDirection.Up : MoveDirection.Down;
		this.model.moveCell(this.cell, direction, false);
	}

	redo(): void {
		this.model.moveCell(this.cell, this.moveDirection, false);
	}
}

export class SplitCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = 'Split Cell';
	resource = this.model.notebookUri;

	constructor(private model: NotebookModel, private firstCell: ICellModel, private secondCell: ICellModel) {
	}

	undo(): void {
		this.model.mergeCells(this.firstCell, this.secondCell);
	}

	redo(): void {
		// no op
	}
}

export class DeleteCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = 'Delete Cell';
	resource = this.model.notebookUri;

	constructor(private model: NotebookModel, private cell: ICellModel, private index: number) {
	}

	undo(): void {
		this.model.insertCell(this.cell, this.index, false);
	}

	redo(): void {
		this.model.deleteCell(this.cell, false);
	}
}

export class AddCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = 'Add Cell';
	resource = this.model.notebookUri;

	constructor(private model: NotebookModel, private cell: ICellModel, private index: number) {
	}

	undo(): void {
		this.model.deleteCell(this.cell, false);
	}

	redo(): void {
		this.model.insertCell(this.cell, this.index, false);
	}
}
