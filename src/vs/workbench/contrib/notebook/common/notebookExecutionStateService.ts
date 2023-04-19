/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { NotebookCellExecutionState } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { CellExecutionUpdateType, ICellExecuteOutputEdit, ICellExecuteOutputItemEdit } from 'vs/workbench/contrib/notebook/common/notebookExecutionService';

export type ICellExecuteUpdate = ICellExecuteOutputEdit | ICellExecuteOutputItemEdit | ICellExecutionStateUpdate;

export interface ICellExecutionStateUpdate {
	editType: CellExecutionUpdateType.ExecutionState;
	executionOrder?: number;
	runStartTime?: number;
	didPause?: boolean;
	isPaused?: boolean;
}

export interface ICellExecutionComplete {
	runEndTime?: number;
	lastRunSuccess?: boolean;
}

export interface ICellExecutionEntry {
	notebook: URI;
	cellHandle: number;
	state: NotebookCellExecutionState;
	didPause: boolean;
	isPaused: boolean;
}

export interface ICellExecutionStateChangedEvent {
	notebook: URI;
	cellHandle: number;
	changed?: INotebookCellExecution; // undefined -> execution was completed
	affectsCell(cell: URI): boolean;
	affectsNotebook(notebook: URI): boolean;
}
export interface INotebookFailStateChangedEvent {
	failed: boolean;
	notebook: URI;
}

export const INotebookExecutionStateService = createDecorator<INotebookExecutionStateService>('INotebookExecutionStateService');

export interface INotebookExecutionStateService {
	_serviceBrand: undefined;

	onDidChangeCellExecution: Event<ICellExecutionStateChangedEvent>;
	onDidChangeLastRunFailState: Event<INotebookFailStateChangedEvent>;

	forceCancelNotebookExecutions(notebookUri: URI): void;
	getCellExecutionStatesForNotebook(notebook: URI): INotebookCellExecution[];
	getCellExecution(cellUri: URI): INotebookCellExecution | undefined;
	createCellExecution(notebook: URI, cellHandle: number): INotebookCellExecution;
	getLastFailedCellForNotebook(notebook: URI): number | undefined;
}

export interface INotebookCellExecution {
	readonly notebook: URI;
	readonly cellHandle: number;
	readonly state: NotebookCellExecutionState;
	readonly didPause: boolean;
	readonly isPaused: boolean;

	confirm(): void;
	update(updates: ICellExecuteUpdate[]): void;
	complete(complete: ICellExecutionComplete): void;
}
