/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { combinedDisposable, Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ResourceMap } from 'vs/base/common/map';
import { isEqual } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { NotebookTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookTextModel';
import { CellEditType, CellUri, ICellEditOperation, NotebookCellExecutionState, NotebookCellInternalMetadata, NotebookTextModelWillAddRemoveEvent } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { CellExecutionUpdateType, INotebookExecutionService } from 'vs/workbench/contrib/notebook/common/notebookExecutionService';
import { ICellExecuteUpdate, ICellExecutionComplete, ICellExecutionStateChangedEvent, ICellExecutionStateUpdate, INotebookCellExecution, INotebookExecutionStateService } from 'vs/workbench/contrib/notebook/common/notebookExecutionStateService';
import { INotebookKernelService } from 'vs/workbench/contrib/notebook/common/notebookKernelService';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';

export class NotebookExecutionStateService extends Disposable implements INotebookExecutionStateService {
	declare _serviceBrand: undefined;

	private readonly _executions = new ResourceMap<Map<number, CellExecution>>();
	private readonly _notebookListeners = new ResourceMap<NotebookExecutionListeners>();
	private readonly _cellListeners = new ResourceMap<IDisposable>();

	private readonly _onDidChangeCellExecution = this._register(new Emitter<ICellExecutionStateChangedEvent>());
	onDidChangeCellExecution = this._onDidChangeCellExecution.event;

	constructor(
		@INotebookKernelService private readonly _notebookKernelService: INotebookKernelService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ILogService private readonly _logService: ILogService,
		@INotebookService private readonly _notebookService: INotebookService,
	) {
		super();
	}

	forceCancelNotebookExecutions(notebookUri: URI): void {
		const notebookExecutions = this._executions.get(notebookUri);
		if (!notebookExecutions) {
			return;
		}

		for (const exe of notebookExecutions.values()) {
			this._onCellExecutionDidComplete(notebookUri, exe.cellHandle, exe);
		}
	}

	getCellExecution(cellUri: URI): INotebookCellExecution | undefined {
		const parsed = CellUri.parse(cellUri);
		if (!parsed) {
			throw new Error(`Not a cell URI: ${cellUri}`);
		}

		const exeMap = this._executions.get(parsed.notebook);
		if (exeMap) {
			return exeMap.get(parsed.handle);
		}

		return undefined;
	}

	getCellExecutionStatesForNotebook(notebook: URI): INotebookCellExecution[] {
		const exeMap = this._executions.get(notebook);
		return exeMap ? Array.from(exeMap.values()) : [];
	}

	private _onCellExecutionDidChange(notebookUri: URI, cellHandle: number, exe: CellExecution): void {
		this._onDidChangeCellExecution.fire(new NotebookExecutionEvent(notebookUri, cellHandle, exe));
	}

	private _onCellExecutionDidComplete(notebookUri: URI, cellHandle: number, exe: CellExecution): void {
		const notebookExecutions = this._executions.get(notebookUri);
		if (!notebookExecutions) {
			this._logService.debug(`NotebookExecutionStateService#_onCellExecutionDidComplete - unknown notebook ${notebookUri.toString()}`);
			return;
		}

		exe.dispose();
		const cellUri = CellUri.generate(notebookUri, cellHandle);
		this._cellListeners.get(cellUri)?.dispose();
		this._cellListeners.delete(cellUri);
		notebookExecutions.delete(cellHandle);
		if (notebookExecutions.size === 0) {
			this._executions.delete(notebookUri);
			this._notebookListeners.get(notebookUri)?.dispose();
			this._notebookListeners.delete(notebookUri);
		}

		this._onDidChangeCellExecution.fire(new NotebookExecutionEvent(notebookUri, cellHandle));
	}

	createCellExecution(controllerId: string, notebookUri: URI, cellHandle: number): INotebookCellExecution {
		const notebook = this._notebookService.getNotebookTextModel(notebookUri);
		if (!notebook) {
			throw new Error(`Notebook not found: ${notebookUri.toString()}`);
		}

		const kernel = this._notebookKernelService.getMatchingKernel(notebook);
		if (!kernel.selected || kernel.selected.id !== controllerId) {
			throw new Error(`Kernel is not selected: ${kernel.selected?.id} !== ${controllerId}`);
		}

		let notebookExecutionMap = this._executions.get(notebookUri);
		if (!notebookExecutionMap) {
			const listeners = this._instantiationService.createInstance(NotebookExecutionListeners, notebookUri);
			this._notebookListeners.set(notebookUri, listeners);

			notebookExecutionMap = new Map<number, CellExecution>();
			this._executions.set(notebookUri, notebookExecutionMap);
		}

		let exe = notebookExecutionMap.get(cellHandle);
		if (!exe) {
			exe = this._createNotebookCellExecution(notebook, cellHandle);
			notebookExecutionMap.set(cellHandle, exe);
			this._onDidChangeCellExecution.fire(new NotebookExecutionEvent(notebookUri, cellHandle, exe));
		}

		return exe;
	}

	private _createNotebookCellExecution(notebook: NotebookTextModel, cellHandle: number): CellExecution {
		const notebookUri = notebook.uri;
		const exe: CellExecution = this._instantiationService.createInstance(CellExecution, cellHandle, notebook);
		const disposable = combinedDisposable(
			exe.onDidUpdate(() => this._onCellExecutionDidChange(notebookUri, cellHandle, exe)),
			exe.onDidComplete(() => this._onCellExecutionDidComplete(notebookUri, cellHandle, exe)));
		this._cellListeners.set(CellUri.generate(notebookUri, cellHandle), disposable);

		return exe;
	}

	override dispose(): void {
		super.dispose();
		this._executions.forEach(executionMap => {
			executionMap.forEach(execution => execution.dispose());
			executionMap.clear();
		});
		this._executions.clear();

		this._cellListeners.forEach(disposable => disposable.dispose());
		this._notebookListeners.forEach(disposable => disposable.dispose());
	}
}

class NotebookExecutionEvent implements ICellExecutionStateChangedEvent {
	constructor(
		readonly notebook: URI,
		readonly cellHandle: number,
		readonly changed?: CellExecution
	) { }

	affectsCell(cell: URI): boolean {
		const parsedUri = CellUri.parse(cell);
		return !!parsedUri && isEqual(this.notebook, parsedUri.notebook) && this.cellHandle === parsedUri.handle;
	}

	affectsNotebook(notebook: URI): boolean {
		return isEqual(this.notebook, notebook);
	}
}

class NotebookExecutionListeners extends Disposable {
	private readonly _notebookModel: NotebookTextModel;

	constructor(
		notebook: URI,
		@INotebookService private readonly _notebookService: INotebookService,
		@INotebookExecutionService private readonly _notebookExecutionService: INotebookExecutionService,
		@INotebookExecutionStateService private readonly _notebookExecutionStateService: INotebookExecutionStateService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._logService.debug(`NotebookExecution#ctor ${notebook.toString()}`);

		const notebookModel = this._notebookService.getNotebookTextModel(notebook);
		if (!notebookModel) {
			throw new Error('Notebook not found: ' + notebook);
		}

		this._notebookModel = notebookModel;
		this._register(this._notebookModel.onWillAddRemoveCells(e => this.onWillAddRemoveCells(e)));
		this._register(this._notebookModel.onWillDispose(() => this.onWillDisposeDocument()));
	}

	private cancelAll(): void {
		this._logService.debug(`NotebookExecutionListeners#cancelAll`);
		const exes = this._notebookExecutionStateService.getCellExecutionStatesForNotebook(this._notebookModel.uri);
		this._notebookExecutionService.cancelNotebookCellHandles(this._notebookModel, exes.map(exe => exe.cellHandle));
	}

	private onWillDisposeDocument(): void {
		this._logService.debug(`NotebookExecution#onWillDisposeDocument`);
		this.cancelAll();
	}

	private onWillAddRemoveCells(e: NotebookTextModelWillAddRemoveEvent): void {
		const notebookExes = this._notebookExecutionStateService.getCellExecutionStatesForNotebook(this._notebookModel.uri);
		const handles = new Set(notebookExes.map(exe => exe.cellHandle));
		const myDeletedHandles = new Set<number>();
		e.rawEvent.changes.forEach(([start, deleteCount]) => {
			if (deleteCount) {
				const deletedHandles = this._notebookModel.cells.slice(start, start + deleteCount).map(c => c.handle);
				deletedHandles.forEach(h => {
					if (handles.has(h)) {
						myDeletedHandles.add(h);
					}
				});
			}

			return false;
		});

		if (myDeletedHandles.size) {
			this._logService.debug(`NotebookExecution#onWillAddRemoveCells, ${JSON.stringify([...myDeletedHandles])}`);
			this._notebookExecutionService.cancelNotebookCellHandles(this._notebookModel, myDeletedHandles);
		}
	}
}

function updateToEdit(update: ICellExecuteUpdate, cellHandle: number): ICellEditOperation {
	if (update.editType === CellExecutionUpdateType.Output) {
		return {
			editType: CellEditType.Output,
			handle: cellHandle,
			append: update.append,
			outputs: update.outputs,
		};
	} else if (update.editType === CellExecutionUpdateType.OutputItems) {
		return {
			editType: CellEditType.OutputItems,
			items: update.items,
			append: update.append,
			outputId: update.outputId
		};
	} else if (update.editType === CellExecutionUpdateType.ExecutionState) {
		const newInternalMetadata: Partial<NotebookCellInternalMetadata> = {};
		if (typeof update.executionOrder !== 'undefined') {
			newInternalMetadata.executionOrder = update.executionOrder;
		}
		if (typeof update.runStartTime !== 'undefined') {
			newInternalMetadata.runStartTime = update.runStartTime;
		}
		return {
			editType: CellEditType.PartialInternalMetadata,
			handle: cellHandle,
			internalMetadata: newInternalMetadata
		};
	}

	throw new Error('Unknown cell update type');
}

class CellExecution extends Disposable implements INotebookCellExecution {
	private readonly _onDidUpdate = this._register(new Emitter<void>());
	readonly onDidUpdate = this._onDidUpdate.event;

	private readonly _onDidComplete = this._register(new Emitter<void>());
	readonly onDidComplete = this._onDidComplete.event;

	private _state: NotebookCellExecutionState = NotebookCellExecutionState.Unconfirmed;
	get state() {
		return this._state;
	}

	get notebook(): URI {
		return this._notebookModel.uri;
	}

	private _didPause = false;
	get didPause() {
		return this._didPause;
	}

	private _isPaused = false;
	get isPaused() {
		return this._isPaused;
	}

	constructor(
		readonly cellHandle: number,
		private readonly _notebookModel: NotebookTextModel,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._logService.debug(`CellExecution#ctor ${this.getCellLog()}`);
		const startExecuteEdit: ICellEditOperation = {
			editType: CellEditType.PartialInternalMetadata,
			handle: this.cellHandle,
			internalMetadata: {
				runStartTime: null,
				runEndTime: null,
				lastRunSuccess: null,
				executionOrder: null,
			}
		};
		this._applyExecutionEdits([startExecuteEdit]);
	}

	private getCellLog(): string {
		return `${this._notebookModel.uri.toString()}, ${this.cellHandle}`;
	}

	private logUpdates(updates: ICellExecuteUpdate[]): void {
		const updateTypes = updates.map(u => CellExecutionUpdateType[u.editType]).join(', ');
		this._logService.debug(`CellExecution#updateExecution ${this.getCellLog()}, [${updateTypes}]`);
	}

	confirm() {
		this._logService.debug(`CellExecution#confirm ${this.getCellLog()}`);
		this._state = NotebookCellExecutionState.Pending;
		this._onDidUpdate.fire();
	}

	update(updates: ICellExecuteUpdate[]): void {
		this.logUpdates(updates);
		if (updates.some(u => u.editType === CellExecutionUpdateType.ExecutionState)) {
			this._state = NotebookCellExecutionState.Executing;
		}

		if (!this._didPause && updates.some(u => u.editType === CellExecutionUpdateType.ExecutionState && u.didPause)) {
			this._didPause = true;
		}

		const lastIsPausedUpdate = [...updates].reverse().find(u => u.editType === CellExecutionUpdateType.ExecutionState && typeof u.isPaused === 'boolean');
		if (lastIsPausedUpdate) {
			this._isPaused = (lastIsPausedUpdate as ICellExecutionStateUpdate).isPaused!;
		}

		const cellModel = this._notebookModel.cells.find(c => c.handle === this.cellHandle);
		if (!cellModel) {
			this._logService.debug(`CellExecution#update, updating cell not in notebook: ${this._notebookModel.uri.toString()}, ${this.cellHandle}`);
		} else {
			const edits = updates.map(update => updateToEdit(update, this.cellHandle));
			this._applyExecutionEdits(edits);
		}

		this._onDidUpdate.fire();
	}

	complete(completionData: ICellExecutionComplete): void {
		const cellModel = this._notebookModel.cells.find(c => c.handle === this.cellHandle);
		if (!cellModel) {
			this._logService.debug(`CellExecution#complete, completing cell not in notebook: ${this._notebookModel.uri.toString()}, ${this.cellHandle}`);
		} else {
			const edit: ICellEditOperation = {
				editType: CellEditType.PartialInternalMetadata,
				handle: this.cellHandle,
				internalMetadata: {
					lastRunSuccess: completionData.lastRunSuccess,
					runStartTime: this._didPause ? null : cellModel.internalMetadata.runStartTime,
					runEndTime: this._didPause ? null : completionData.runEndTime,
				}
			};
			this._applyExecutionEdits([edit]);
		}

		this._onDidComplete.fire();
	}

	private _applyExecutionEdits(edits: ICellEditOperation[]): void {
		this._notebookModel.applyEdits(edits, true, undefined, () => undefined, undefined, false);
	}
}
