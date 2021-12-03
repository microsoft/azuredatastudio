/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IResourceUndoRedoElement, UndoRedoElementType } from 'vs/platform/undoRedo/common/undoRedo';
import { ICellModel, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { localize } from 'vs/nls';

export class MoveCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = localize('moveCellEdit', "Move Cell");
	resource = this.model.notebookUri;
	private readonly cellOperation = { cell_operation: 'move_cell' };

	constructor(private model: NotebookModel, private cell: ICellModel, private moveDirection: MoveDirection) {
	}

	undo(): void {
		const direction = this.moveDirection === MoveDirection.Down ? MoveDirection.Up : MoveDirection.Down;
		this.model.moveCell(this.cell, direction, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.UndoCell, this.cellOperation);
	}

	redo(): void {
		this.model.moveCell(this.cell, this.moveDirection, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.RedoCell, this.cellOperation);
	}
}

export class SplitCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = localize('splitCellEdit', "Split Cell");
	resource = this.model.notebookUri;
	private readonly cellOperation = { cell_operation: 'split_cell' };

	constructor(private model: NotebookModel, private firstCell: ICellModel, private secondCell: ICellModel, private newLinesRemoved: string[]) {
	}

	undo(): void {
		this.model.mergeCells(this.firstCell, this.secondCell, this.newLinesRemoved);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.UndoCell, this.cellOperation);
	}

	redo(): void {
		// no-op currently, will add support on next release
	}
}

export class DeleteCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = localize('deleteCellEdit', "Delete Cell");
	resource = this.model.notebookUri;
	private readonly cellOperation = { cell_operation: 'delete_cell' };

	constructor(private model: NotebookModel, private cell: ICellModel, private index: number) {
	}

	undo(): void {
		this.model.insertCell(this.cell, this.index, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.UndoCell, this.cellOperation);
	}

	redo(): void {
		this.model.deleteCell(this.cell, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.RedoCell, this.cellOperation);
	}
}

export class AddCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = localize('addCellEdit', "Add Cell");
	resource = this.model.notebookUri;
	private readonly cellOperation = { cell_operation: 'add_cell' };

	constructor(private model: NotebookModel, private cell: ICellModel, private index: number) {
	}

	undo(): void {
		this.model.deleteCell(this.cell, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.UndoCell, this.cellOperation);
	}

	redo(): void {
		this.model.insertCell(this.cell, this.index, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.RedoCell, this.cellOperation);
	}
}
