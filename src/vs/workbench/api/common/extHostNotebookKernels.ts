/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { ExtHostNotebookKernelsShape, IMainContext, INotebookKernelDto2, MainContext, MainThreadNotebookDocumentsShape, MainThreadNotebookKernelsShape } from 'vs/workbench/api/common/extHost.protocol';
import * as vscode from 'vscode';
import { ExtHostNotebookController } from 'vs/workbench/api/common/extHostNotebook';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { URI, UriComponents } from 'vs/base/common/uri';
import * as extHostTypeConverters from 'vs/workbench/api/common/extHostTypeConverters';
import { IExtHostInitDataService } from 'vs/workbench/api/common/extHostInitDataService';
import { asWebviewUri } from 'vs/workbench/api/common/shared/webview';
import { ResourceMap } from 'vs/base/common/map';
import { timeout } from 'vs/base/common/async';
import { ExtHostCell, ExtHostNotebookDocument } from 'vs/workbench/api/common/extHostNotebookDocument';
import { CellEditType, IImmediateCellEditOperation, IOutputDto, NotebookCellExecutionState, NullablePartialNotebookCellInternalMetadata } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { asArray } from 'vs/base/common/arrays';
import { ILogService } from 'vs/platform/log/common/log';
import { NotebookCellOutput } from 'vs/workbench/api/common/extHostTypes';
import { checkProposedApiEnabled } from 'vs/workbench/services/extensions/common/extensions';

interface IKernelData {
	extensionId: ExtensionIdentifier,
	controller: vscode.NotebookController;
	onDidChangeSelection: Emitter<{ selected: boolean; notebook: vscode.NotebookDocument; }>;
	onDidReceiveMessage: Emitter<{ editor: vscode.NotebookEditor, message: any; }>;
	associatedNotebooks: ResourceMap<boolean>;
}

export class ExtHostNotebookKernels implements ExtHostNotebookKernelsShape {

	private readonly _proxy: MainThreadNotebookKernelsShape;
	private readonly _activeExecutions = new ResourceMap<NotebookCellExecutionTask>();

	private readonly _kernelData = new Map<number, IKernelData>();
	private _handlePool: number = 0;

	constructor(
		private readonly _mainContext: IMainContext,
		private readonly _initData: IExtHostInitDataService,
		private readonly _extHostNotebook: ExtHostNotebookController,
		@ILogService private readonly _logService: ILogService,
	) {
		this._proxy = _mainContext.getProxy(MainContext.MainThreadNotebookKernels);
	}

	createNotebookController(extension: IExtensionDescription, id: string, viewType: string, label: string, handler?: (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => void | Thenable<void>, preloads?: vscode.NotebookRendererScript[]): vscode.NotebookController {

		for (let data of this._kernelData.values()) {
			if (data.controller.id === id && ExtensionIdentifier.equals(extension.identifier, data.extensionId)) {
				throw new Error(`notebook controller with id '${id}' ALREADY exist`);
			}
		}


		const handle = this._handlePool++;
		const that = this;

		this._logService.trace(`NotebookController[${handle}], CREATED by ${extension.identifier.value}, ${id}`);

		const _defaultExecutHandler = () => console.warn(`NO execute handler from notebook controller '${data.id}' of extension: '${extension.identifier}'`);

		let isDisposed = false;
		const commandDisposables = new DisposableStore();

		const onDidChangeSelection = new Emitter<{ selected: boolean, notebook: vscode.NotebookDocument; }>();
		const onDidReceiveMessage = new Emitter<{ editor: vscode.NotebookEditor, message: any; }>();

		const data: INotebookKernelDto2 = {
			id: `${extension.identifier.value}/${id}`,
			notebookType: viewType,
			extensionId: extension.identifier,
			extensionLocation: extension.extensionLocation,
			label: label || extension.identifier.value,
			preloads: preloads ? preloads.map(extHostTypeConverters.NotebookRendererScript.from) : []
		};

		//
		let _executeHandler = handler ?? _defaultExecutHandler;
		let _interruptHandler: ((this: vscode.NotebookController, notebook: vscode.NotebookDocument) => void | Thenable<void>) | undefined;

		this._proxy.$addKernel(handle, data).catch(err => {
			// this can happen when a kernel with that ID is already registered
			console.log(err);
			isDisposed = true;
		});

		// update: all setters write directly into the dto object
		// and trigger an update. the actual update will only happen
		// once per event loop execution
		let tokenPool = 0;
		const _update = () => {
			if (isDisposed) {
				return;
			}
			const myToken = ++tokenPool;
			Promise.resolve().then(() => {
				if (myToken === tokenPool) {
					this._proxy.$updateKernel(handle, data);
				}
			});
		};

		// notebook documents that are associated to this controller
		const associatedNotebooks = new ResourceMap<boolean>();

		const controller: vscode.NotebookController = {
			get id() { return id; },
			get notebookType() { return data.notebookType; },
			onDidChangeSelectedNotebooks: onDidChangeSelection.event,
			get label() {
				return data.label;
			},
			set label(value) {
				data.label = value ?? extension.displayName ?? extension.name;
				_update();
			},
			get detail() {
				return data.detail ?? '';
			},
			set detail(value) {
				data.detail = value;
				_update();
			},
			get description() {
				return data.description ?? '';
			},
			set description(value) {
				data.description = value;
				_update();
			},
			get supportedLanguages() {
				return data.supportedLanguages;
			},
			set supportedLanguages(value) {
				data.supportedLanguages = value;
				_update();
			},
			get supportsExecutionOrder() {
				return data.supportsExecutionOrder ?? false;
			},
			set supportsExecutionOrder(value) {
				data.supportsExecutionOrder = value;
				_update();
			},
			get rendererScripts() {
				return data.preloads ? data.preloads.map(extHostTypeConverters.NotebookRendererScript.to) : [];
			},
			get executeHandler() {
				return _executeHandler;
			},
			set executeHandler(value) {
				_executeHandler = value ?? _defaultExecutHandler;
			},
			get interruptHandler() {
				return _interruptHandler;
			},
			set interruptHandler(value) {
				_interruptHandler = value;
				data.supportsInterrupt = Boolean(value);
				_update();
			},
			createNotebookCellExecution(cell) {
				if (isDisposed) {
					throw new Error('notebook controller is DISPOSED');
				}
				if (!associatedNotebooks.has(cell.notebook.uri)) {
					that._logService.trace(`NotebookController[${handle}] NOT associated to notebook, associated to THESE notebooks:`, Array.from(associatedNotebooks.keys()).map(u => u.toString()));
					throw new Error(`notebook controller is NOT associated to notebook: ${cell.notebook.uri.toString()}`);
				}
				return that._createNotebookCellExecution(cell);
			},
			dispose: () => {
				if (!isDisposed) {
					this._logService.trace(`NotebookController[${handle}], DISPOSED`);
					isDisposed = true;
					this._kernelData.delete(handle);
					commandDisposables.dispose();
					onDidChangeSelection.dispose();
					onDidReceiveMessage.dispose();
					this._proxy.$removeKernel(handle);
				}
			},
			// --- priority
			updateNotebookAffinity(notebook, priority) {
				that._proxy.$updateNotebookPriority(handle, notebook.uri, priority);
			},
			// --- ipc
			onDidReceiveMessage: onDidReceiveMessage.event,
			postMessage(message, editor) {
				checkProposedApiEnabled(extension);
				return that._proxy.$postMessage(handle, editor && that._extHostNotebook.getIdByEditor(editor), message);
			},
			asWebviewUri(uri: URI) {
				checkProposedApiEnabled(extension);
				return asWebviewUri(uri, that._initData.remote);
			},
		};

		this._kernelData.set(handle, {
			extensionId: extension.identifier,
			controller,
			onDidReceiveMessage,
			onDidChangeSelection,
			associatedNotebooks
		});
		return controller;
	}

	$acceptNotebookAssociation(handle: number, uri: UriComponents, value: boolean): void {
		const obj = this._kernelData.get(handle);
		if (obj) {
			// update data structure
			const notebook = this._extHostNotebook.getNotebookDocument(URI.revive(uri))!;
			if (value) {
				obj.associatedNotebooks.set(notebook.uri, true);
			} else {
				obj.associatedNotebooks.delete(notebook.uri);
			}
			this._logService.trace(`NotebookController[${handle}] ASSOCIATE notebook`, notebook.uri.toString(), value);
			// send event
			obj.onDidChangeSelection.fire({
				selected: value,
				notebook: notebook.apiNotebook
			});
		}
	}

	async $executeCells(handle: number, uri: UriComponents, handles: number[]): Promise<void> {
		const obj = this._kernelData.get(handle);
		if (!obj) {
			// extension can dispose kernels in the meantime
			return;
		}
		const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
		const cells: vscode.NotebookCell[] = [];
		for (let cellHandle of handles) {
			const cell = document.getCell(cellHandle);
			if (cell) {
				cells.push(cell.apiCell);
			}
		}

		try {
			this._logService.trace(`NotebookController[${handle}] EXECUTE cells`, document.uri.toString(), cells.length);
			await obj.controller.executeHandler.call(obj.controller, cells, document.apiNotebook, obj.controller);
		} catch (err) {
			//
			this._logService.error(`NotebookController[${handle}] execute cells FAILED`, err);
			console.error(err);
		}
	}

	async $cancelCells(handle: number, uri: UriComponents, handles: number[]): Promise<void> {
		const obj = this._kernelData.get(handle);
		if (!obj) {
			// extension can dispose kernels in the meantime
			return;
		}

		// cancel or interrupt depends on the controller. When an interrupt handler is used we
		// don't trigger the cancelation token of executions.
		const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
		if (obj.controller.interruptHandler) {
			await obj.controller.interruptHandler.call(obj.controller, document.apiNotebook);

		} else {
			for (let cellHandle of handles) {
				const cell = document.getCell(cellHandle);
				if (cell) {
					this._activeExecutions.get(cell.uri)?.cancel();
				}
			}
		}
	}

	$acceptKernelMessageFromRenderer(handle: number, editorId: string, message: any): void {
		const obj = this._kernelData.get(handle);
		if (!obj) {
			// extension can dispose kernels in the meantime
			return;
		}

		const editor = this._extHostNotebook.getEditorById(editorId);
		obj.onDidReceiveMessage.fire(Object.freeze({ editor: editor.apiEditor, message }));
	}

	// ---

	_createNotebookCellExecution(cell: vscode.NotebookCell): vscode.NotebookCellExecution {
		if (cell.index < 0) {
			throw new Error('CANNOT execute cell that has been REMOVED from notebook');
		}
		const notebook = this._extHostNotebook.getNotebookDocument(cell.notebook.uri);
		const cellObj = notebook.getCellFromApiCell(cell);
		if (!cellObj) {
			throw new Error('invalid cell');
		}
		if (this._activeExecutions.has(cellObj.uri)) {
			throw new Error(`duplicate execution for ${cellObj.uri}`);
		}
		const execution = new NotebookCellExecutionTask(cellObj.notebook, cellObj, this._mainContext.getProxy(MainContext.MainThreadNotebookDocuments));
		this._activeExecutions.set(cellObj.uri, execution);
		const listener = execution.onDidChangeState(() => {
			if (execution.state === NotebookCellExecutionTaskState.Resolved) {
				execution.dispose();
				listener.dispose();
				this._activeExecutions.delete(cellObj.uri);
			}
		});
		return execution.asApiObject();
	}
}


enum NotebookCellExecutionTaskState {
	Init,
	Started,
	Resolved
}

class NotebookCellExecutionTask extends Disposable {
	private _onDidChangeState = new Emitter<void>();
	readonly onDidChangeState = this._onDidChangeState.event;

	private _state = NotebookCellExecutionTaskState.Init;
	get state(): NotebookCellExecutionTaskState { return this._state; }

	private readonly _tokenSource = this._register(new CancellationTokenSource());

	private readonly _collector: TimeoutBasedCollector<IImmediateCellEditOperation>;

	private _executionOrder: number | undefined;

	constructor(
		private readonly _document: ExtHostNotebookDocument,
		private readonly _cell: ExtHostCell,
		private readonly _proxy: MainThreadNotebookDocumentsShape
	) {
		super();

		this._collector = new TimeoutBasedCollector(10, edits => this.applyEdits(edits));

		this._executionOrder = _cell.internalMetadata.executionOrder;
		this.mixinMetadata({
			runState: NotebookCellExecutionState.Pending,
			executionOrder: null
		});
	}

	cancel(): void {
		this._tokenSource.cancel();
	}

	private async applyEditSoon(edit: IImmediateCellEditOperation): Promise<void> {
		await this._collector.addItem(edit);
	}

	private async applyEdits(edits: IImmediateCellEditOperation[]): Promise<void> {
		return this._proxy.$applyEdits(this._document.uri, edits, false);
	}

	private verifyStateForOutput() {
		if (this._state === NotebookCellExecutionTaskState.Init) {
			throw new Error('Must call start before modifying cell output');
		}

		if (this._state === NotebookCellExecutionTaskState.Resolved) {
			throw new Error('Cannot modify cell output after calling resolve');
		}
	}

	private mixinMetadata(mixinMetadata: NullablePartialNotebookCellInternalMetadata) {
		const edit: IImmediateCellEditOperation = { editType: CellEditType.PartialInternalMetadata, handle: this._cell.handle, internalMetadata: mixinMetadata };
		this.applyEdits([edit]);
	}

	private cellIndexToHandle(cellOrCellIndex: vscode.NotebookCell | number | undefined): number {
		let cell: ExtHostCell | undefined = this._cell;
		if (typeof cellOrCellIndex === 'number') {
			// todo@jrieken remove support for number shortly
			cell = this._document.getCellFromIndex(cellOrCellIndex);
		} else if (cellOrCellIndex) {
			cell = this._document.getCellFromApiCell(cellOrCellIndex);
		}
		if (!cell) {
			throw new Error('INVALID cell');
		}
		return cell.handle;
	}

	private validateAndConvertOutputs(items: vscode.NotebookCellOutput[]): IOutputDto[] {
		return items.map(output => {
			const newOutput = NotebookCellOutput.ensureUniqueMimeTypes(output.items, true);
			if (newOutput === output.items) {
				return extHostTypeConverters.NotebookCellOutput.from(output);
			}
			return extHostTypeConverters.NotebookCellOutput.from({
				items: newOutput,
				id: output.id,
				metadata: output.metadata
			});
		});
	}

	private async updateOutputs(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell: vscode.NotebookCell | number | undefined, append: boolean): Promise<void> {
		const handle = this.cellIndexToHandle(cell);
		const outputDtos = this.validateAndConvertOutputs(asArray(outputs));
		return this.applyEditSoon({ editType: CellEditType.Output, handle, append, outputs: outputDtos });
	}

	private async updateOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], outputOrOutputId: vscode.NotebookCellOutput | string, append: boolean): Promise<void> {
		if (NotebookCellOutput.isNotebookCellOutput(outputOrOutputId)) {
			outputOrOutputId = outputOrOutputId.id;
		}
		items = NotebookCellOutput.ensureUniqueMimeTypes(asArray(items), true);
		return this.applyEditSoon({ editType: CellEditType.OutputItems, items: items.map(extHostTypeConverters.NotebookCellOutputItem.from), outputId: outputOrOutputId, append });
	}

	asApiObject(): vscode.NotebookCellExecution {
		const that = this;
		const result: vscode.NotebookCellExecution = {
			get token() { return that._tokenSource.token; },
			get cell() { return that._cell.apiCell; },
			get executionOrder() { return that._executionOrder; },
			set executionOrder(v: number | undefined) {
				that._executionOrder = v;
				that.mixinMetadata({
					executionOrder: v
				});
			},

			start(startTime?: number): void {
				if (that._state === NotebookCellExecutionTaskState.Resolved || that._state === NotebookCellExecutionTaskState.Started) {
					throw new Error('Cannot call start again');
				}

				that._state = NotebookCellExecutionTaskState.Started;
				that._onDidChangeState.fire();

				that.mixinMetadata({
					runState: NotebookCellExecutionState.Executing,
					runStartTime: startTime ?? null
				});
			},

			end(success: boolean | undefined, endTime?: number): void {
				if (that._state === NotebookCellExecutionTaskState.Resolved) {
					throw new Error('Cannot call resolve twice');
				}

				that._state = NotebookCellExecutionTaskState.Resolved;
				that._onDidChangeState.fire();

				that.mixinMetadata({
					runState: null,
					lastRunSuccess: success ?? null,
					runEndTime: endTime ?? null,
				});
			},

			clearOutput(cell?: vscode.NotebookCell | number): Thenable<void> {
				that.verifyStateForOutput();
				return that.updateOutputs([], cell, false);
			},

			appendOutput(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell | number): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputs(outputs, cell, true);
			},

			replaceOutput(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell | number): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputs(outputs, cell, false);
			},

			appendOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput | string): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputItems(items, output, true);
			},

			replaceOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput | string): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputItems(items, output, false);
			}
		};
		return Object.freeze(result);
	}
}

class TimeoutBasedCollector<T> {
	private batch: T[] = [];
	private waitPromise: Promise<void> | undefined;

	constructor(
		private readonly delay: number,
		private readonly callback: (items: T[]) => Promise<void>) { }

	addItem(item: T): Promise<void> {
		this.batch.push(item);
		if (!this.waitPromise) {
			this.waitPromise = timeout(this.delay).then(() => {
				this.waitPromise = undefined;
				const batch = this.batch;
				this.batch = [];
				return this.callback(batch);
			});
		}

		return this.waitPromise;
	}
}
