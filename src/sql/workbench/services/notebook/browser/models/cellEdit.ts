/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { IResourceUndoRedoElement, UndoRedoElementType } from 'vs/platform/undoRedo/common/undoRedo';
import { CellEditType, ICellEdit, ICellModel, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel, SplitCell } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { deepClone } from 'vs/base/common/objects';
import { localize } from 'vs/nls';

export class MoveCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = localize('moveCellEdit', "Move Cell");
	resource = this.model.notebookUri;
	readonly code: string;

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
	private firstCellOriginalSource: string[] | string;
	readonly code: string;

	constructor(private model: NotebookModel, private cells: SplitCell[]) {
		this.firstCellOriginalSource = deepClone(cells[0].cell.source);
	}

	undo(): void {
		this.model.mergeCells(this.cells);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.UndoCell, this.cellOperation);
	}

	redo(): void {
		this.model.splitCells(this.cells, this.firstCellOriginalSource);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.RedoCell, this.cellOperation);
	}
}

export class DeleteCellEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = localize('deleteCellEdit', "Delete Cell");
	resource = this.model.notebookUri;
	readonly code: string;

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
	readonly code: string;

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

export class ConvertCellTypeEdit implements IResourceUndoRedoElement {
	type: UndoRedoElementType.Resource = UndoRedoElementType.Resource;
	label: string = localize('convertCellTypeEdit', "Convert Cell Type");
	resource = this.model.notebookUri;
	readonly code: string;

	private readonly cellOperation = { cell_operation: 'convert_cell_type' };

	constructor(private model: NotebookModel, private cell: ICellModel) {
	}

	undo(): void {
		this.model.convertCellType(this.cell, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.UndoCell, this.cellOperation);
	}

	redo(): void {
		this.model.convertCellType(this.cell, false);
		this.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.RedoCell, this.cellOperation);
	}
}

/**
 * Edit for modifying the outputs of a cell.
 */
export class CellOutputEdit implements ICellEdit {
	type = CellEditType.Output;
	public constructor(public readonly outputs: azdata.nb.ICellOutput[], public readonly append: boolean) { }
}

/**
 * Edit for modifying the data of a specific output of a cell.
 */
export class CellOutputDataEdit implements ICellEdit {
	type = CellEditType.OutputData;
	public constructor(public readonly outputId: string, public readonly data: azdata.nb.DisplayResultData, public readonly append: boolean) { }
}
