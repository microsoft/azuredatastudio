/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { asArray } from 'vs/base/common/arrays';
import { DeferredPromise, timeout } from 'vs/base/common/async';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { Emitter } from 'vs/base/common/event';
import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { ResourceMap } from 'vs/base/common/map';
import { URI, UriComponents } from 'vs/base/common/uri';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { ILogService } from 'vs/platform/log/common/log';
import { Cache } from 'vs/workbench/api/common/cache';
import { ExtHostNotebookKernelsShape, ICellExecuteUpdateDto, IMainContext, INotebookKernelDto2, MainContext, MainThreadNotebookKernelsShape, NotebookOutputDto } from 'vs/workbench/api/common/extHost.protocol';
import { ApiCommand, ApiCommandArgument, ApiCommandResult, ExtHostCommands } from 'vs/workbench/api/common/extHostCommands';
import { IExtHostInitDataService } from 'vs/workbench/api/common/extHostInitDataService';
import { ExtHostNotebookController } from 'vs/workbench/api/common/extHostNotebook';
import { ExtHostCell, ExtHostNotebookDocument } from 'vs/workbench/api/common/extHostNotebookDocument';
import * as extHostTypeConverters from 'vs/workbench/api/common/extHostTypeConverters';
import { NotebookCellExecutionState as ExtHostNotebookCellExecutionState, NotebookCellOutput, NotebookControllerAffinity2 } from 'vs/workbench/api/common/extHostTypes';
import { asWebviewUri } from 'vs/workbench/contrib/webview/common/webview';
import { INotebookKernelSourceAction, NotebookCellExecutionState } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { CellExecutionUpdateType } from 'vs/workbench/contrib/notebook/common/notebookExecutionService';
import { checkProposedApiEnabled } from 'vs/workbench/services/extensions/common/extensions';
import { SerializableObjectWithBuffers } from 'vs/workbench/services/extensions/common/proxyIdentifier';
import * as vscode from 'vscode';

interface IKernelData {
	extensionId: ExtensionIdentifier;
	controller: vscode.NotebookController;
	onDidChangeSelection: Emitter<{ selected: boolean; notebook: vscode.NotebookDocument }>;
	onDidReceiveMessage: Emitter<{ editor: vscode.NotebookEditor; message: any }>;
	associatedNotebooks: ResourceMap<boolean>;
}

type ExtHostSelectKernelArgs = ControllerInfo | { notebookEditor: vscode.NotebookEditor } | ControllerInfo & { notebookEditor: vscode.NotebookEditor } | undefined;
type SelectKernelReturnArgs = ControllerInfo | { notebookEditorId: string } | ControllerInfo & { notebookEditorId: string } | undefined;
type ControllerInfo = { id: string; extension: string };


export class ExtHostNotebookKernels implements ExtHostNotebookKernelsShape {

	private readonly _proxy: MainThreadNotebookKernelsShape;
	private readonly _activeExecutions = new ResourceMap<NotebookCellExecutionTask>();
	private readonly _activeNotebookExecutions = new ResourceMap<[NotebookExecutionTask, IDisposable]>();

	private _kernelDetectionTask = new Map<number, vscode.NotebookControllerDetectionTask>();
	private _kernelDetectionTaskHandlePool: number = 0;

	private _kernelSourceActionProviders = new Map<number, vscode.NotebookKernelSourceActionProvider>();
	private _kernelSourceActionProviderHandlePool: number = 0;
	private _kernelSourceActionProviderCache = new Cache<IDisposable>('NotebookKernelSourceActionProviderCache');

	private readonly _kernelData = new Map<number, IKernelData>();
	private _handlePool: number = 0;

	private readonly _onDidChangeCellExecutionState = new Emitter<vscode.NotebookCellExecutionStateChangeEvent>();
	readonly onDidChangeNotebookCellExecutionState = this._onDidChangeCellExecutionState.event;

	constructor(
		mainContext: IMainContext,
		private readonly _initData: IExtHostInitDataService,
		private readonly _extHostNotebook: ExtHostNotebookController,
		private _commands: ExtHostCommands,
		@ILogService private readonly _logService: ILogService,
	) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadNotebookKernels);

		// todo@rebornix @joyceerhl: move to APICommands once stabilized.
		const selectKernelApiCommand = new ApiCommand(
			'notebook.selectKernel',
			'_notebook.selectKernel',
			'Trigger kernel picker for specified notebook editor widget',
			[
				new ApiCommandArgument<ExtHostSelectKernelArgs, SelectKernelReturnArgs>('options', 'Select kernel options', v => true, (v: ExtHostSelectKernelArgs) => {
					if (v && 'notebookEditor' in v && 'id' in v) {
						const notebookEditorId = this._extHostNotebook.getIdByEditor(v.notebookEditor);
						return {
							id: v.id, extension: v.extension, notebookEditorId
						};
					} else if (v && 'notebookEditor' in v) {
						const notebookEditorId = this._extHostNotebook.getIdByEditor(v.notebookEditor);
						if (notebookEditorId === undefined) {
							throw new Error(`Cannot invoke 'notebook.selectKernel' for unrecognized notebook editor ${v.notebookEditor.notebook.uri.toString()}`);
						}
						return { notebookEditorId };
					}
					return <any>v;
				})
			],
			ApiCommandResult.Void);
		this._commands.registerApiCommand(selectKernelApiCommand);
	}

	createNotebookController(extension: IExtensionDescription, id: string, viewType: string, label: string, handler?: (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => void | Thenable<void>, preloads?: vscode.NotebookRendererScript[]): vscode.NotebookController {

		for (const data of this._kernelData.values()) {
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

		const onDidChangeSelection = new Emitter<{ selected: boolean; notebook: vscode.NotebookDocument }>();
		const onDidReceiveMessage = new Emitter<{ editor: vscode.NotebookEditor; message: any }>();

		const data: INotebookKernelDto2 = {
			id: createKernelId(extension.identifier, id),
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
				return that._createNotebookCellExecution(cell, createKernelId(extension.identifier, this.id));
			},
			createNotebookExecution(notebook) {
				checkProposedApiEnabled(extension, 'notebookExecution');
				if (isDisposed) {
					throw new Error('notebook controller is DISPOSED');
				}
				if (!associatedNotebooks.has(notebook.uri)) {
					that._logService.trace(`NotebookController[${handle}] NOT associated to notebook, associated to THESE notebooks:`, Array.from(associatedNotebooks.keys()).map(u => u.toString()));
					throw new Error(`notebook controller is NOT associated to notebook: ${notebook.uri.toString()}`);
				}
				return that._createNotebookExecution(notebook, createKernelId(extension.identifier, this.id));
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
				if (priority === NotebookControllerAffinity2.Hidden) {
					// This api only adds an extra enum value, the function is the same, so just gate on the new value being passed
					// for proposedAPI check.
					checkProposedApiEnabled(extension, 'notebookControllerAffinityHidden');
				}
				that._proxy.$updateNotebookPriority(handle, notebook.uri, priority);
			},
			// --- ipc
			onDidReceiveMessage: onDidReceiveMessage.event,
			postMessage(message, editor) {
				checkProposedApiEnabled(extension, 'notebookMessaging');
				return that._proxy.$postMessage(handle, editor && that._extHostNotebook.getIdByEditor(editor), message);
			},
			asWebviewUri(uri: URI) {
				checkProposedApiEnabled(extension, 'notebookMessaging');
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

	getIdByController(controller: vscode.NotebookController) {
		for (const [_, candidate] of this._kernelData) {
			if (candidate.controller === controller) {
				return createKernelId(candidate.extensionId, controller.id);
			}
		}
		return null;
	}

	createNotebookControllerDetectionTask(extension: IExtensionDescription, viewType: string): vscode.NotebookControllerDetectionTask {
		const handle = this._kernelDetectionTaskHandlePool++;
		const that = this;

		this._logService.trace(`NotebookControllerDetectionTask[${handle}], CREATED by ${extension.identifier.value}`);
		this._proxy.$addKernelDetectionTask(handle, viewType);

		const detectionTask: vscode.NotebookControllerDetectionTask = {
			dispose: () => {
				this._kernelDetectionTask.delete(handle);
				that._proxy.$removeKernelDetectionTask(handle);
			}
		};

		this._kernelDetectionTask.set(handle, detectionTask);
		return detectionTask;
	}

	registerKernelSourceActionProvider(extension: IExtensionDescription, viewType: string, provider: vscode.NotebookKernelSourceActionProvider) {
		const handle = this._kernelSourceActionProviderHandlePool++;
		const eventHandle = typeof provider.onDidChangeNotebookKernelSourceActions === 'function' ? handle : undefined;
		const that = this;

		this._kernelSourceActionProviders.set(handle, provider);
		this._logService.trace(`NotebookKernelSourceActionProvider[${handle}], CREATED by ${extension.identifier.value}`);
		this._proxy.$addKernelSourceActionProvider(handle, handle, viewType);

		let subscription: vscode.Disposable | undefined;
		if (eventHandle !== undefined) {
			subscription = provider.onDidChangeNotebookKernelSourceActions!(_ => this._proxy.$emitNotebookKernelSourceActionsChangeEvent(eventHandle));
		}

		return {
			dispose: () => {
				this._kernelSourceActionProviders.delete(handle);
				that._proxy.$removeKernelSourceActionProvider(handle, handle);
				subscription?.dispose();
			}
		};
	}

	async $provideKernelSourceActions(handle: number, token: CancellationToken): Promise<INotebookKernelSourceAction[]> {
		const provider = this._kernelSourceActionProviders.get(handle);
		if (provider) {
			const disposables = new DisposableStore();
			this._kernelSourceActionProviderCache.add([disposables]);
			const ret = await provider.provideNotebookKernelSourceActions(token);
			return (ret ?? []).map(item => extHostTypeConverters.NotebookKernelSourceAction.from(item, this._commands.converter, disposables));
		}
		return [];
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
		for (const cellHandle of handles) {
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
			for (const cellHandle of handles) {
				const cell = document.getCell(cellHandle);
				if (cell) {
					this._activeExecutions.get(cell.uri)?.cancel();
				}
			}
		}

		if (obj.controller.interruptHandler) {
			// If we're interrupting all cells, we also need to cancel the notebook level execution.
			const items = this._activeNotebookExecutions.get(document.uri);
			if (handles.length && Array.isArray(items) && items.length) {
				items.forEach(d => d.dispose());
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

	$cellExecutionChanged(uri: UriComponents, cellHandle: number, state: NotebookCellExecutionState | undefined): void {
		const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
		const cell = document.getCell(cellHandle);
		if (cell) {
			const newState = state ? extHostTypeConverters.NotebookCellExecutionState.to(state) : ExtHostNotebookCellExecutionState.Idle;
			if (newState !== undefined) {
				this._onDidChangeCellExecutionState.fire({
					cell: cell.apiCell,
					state: newState
				});
			}
		}
	}

	// ---

	_createNotebookCellExecution(cell: vscode.NotebookCell, controllerId: string): vscode.NotebookCellExecution {
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
		const execution = new NotebookCellExecutionTask(controllerId, cellObj, this._proxy);
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

	// ---

	_createNotebookExecution(nb: vscode.NotebookDocument, controllerId: string): vscode.NotebookExecution {
		const notebook = this._extHostNotebook.getNotebookDocument(nb.uri);
		const runningCell = nb.getCells().find(cell => {
			const apiCell = notebook.getCellFromApiCell(cell);
			return apiCell && this._activeExecutions.has(apiCell.uri);
		});
		if (runningCell) {
			throw new Error(`duplicate cell execution for ${runningCell.document.uri}`);
		}
		if (this._activeNotebookExecutions.has(notebook.uri)) {
			throw new Error(`duplicate notebook execution for ${notebook.uri}`);
		}
		const execution = new NotebookExecutionTask(controllerId, notebook, this._proxy);
		const listener = execution.onDidChangeState(() => {
			if (execution.state === NotebookExecutionTaskState.Resolved) {
				execution.dispose();
				listener.dispose();
				this._activeNotebookExecutions.delete(notebook.uri);
			}
		});
		this._activeNotebookExecutions.set(notebook.uri, [execution, listener]);
		return execution.asApiObject();
	}
}


enum NotebookCellExecutionTaskState {
	Init,
	Started,
	Resolved
}

class NotebookCellExecutionTask extends Disposable {
	private static HANDLE = 0;
	private _handle = NotebookCellExecutionTask.HANDLE++;

	private _onDidChangeState = new Emitter<void>();
	readonly onDidChangeState = this._onDidChangeState.event;

	private _state = NotebookCellExecutionTaskState.Init;
	get state(): NotebookCellExecutionTaskState { return this._state; }

	private readonly _tokenSource = this._register(new CancellationTokenSource());

	private readonly _collector: TimeoutBasedCollector<ICellExecuteUpdateDto>;

	private _executionOrder: number | undefined;

	constructor(
		controllerId: string,
		private readonly _cell: ExtHostCell,
		private readonly _proxy: MainThreadNotebookKernelsShape
	) {
		super();

		this._collector = new TimeoutBasedCollector(10, updates => this.update(updates));

		this._executionOrder = _cell.internalMetadata.executionOrder;
		this._proxy.$createExecution(this._handle, controllerId, this._cell.notebook.uri, this._cell.handle);
	}

	cancel(): void {
		this._tokenSource.cancel();
	}

	private async updateSoon(update: ICellExecuteUpdateDto): Promise<void> {
		await this._collector.addItem(update);
	}

	private async update(update: ICellExecuteUpdateDto | ICellExecuteUpdateDto[]): Promise<void> {
		const updates = Array.isArray(update) ? update : [update];
		return this._proxy.$updateExecution(this._handle, new SerializableObjectWithBuffers(updates));
	}

	private verifyStateForOutput() {
		if (this._state === NotebookCellExecutionTaskState.Init) {
			throw new Error('Must call start before modifying cell output');
		}

		if (this._state === NotebookCellExecutionTaskState.Resolved) {
			throw new Error('Cannot modify cell output after calling resolve');
		}
	}

	private cellIndexToHandle(cellOrCellIndex: vscode.NotebookCell | undefined): number {
		let cell: ExtHostCell | undefined = this._cell;
		if (cellOrCellIndex) {
			cell = this._cell.notebook.getCellFromApiCell(cellOrCellIndex);
		}
		if (!cell) {
			throw new Error('INVALID cell');
		}
		return cell.handle;
	}

	private validateAndConvertOutputs(items: vscode.NotebookCellOutput[]): NotebookOutputDto[] {
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

	private async updateOutputs(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell: vscode.NotebookCell | undefined, append: boolean): Promise<void> {
		const handle = this.cellIndexToHandle(cell);
		const outputDtos = this.validateAndConvertOutputs(asArray(outputs));
		return this.updateSoon(
			{
				editType: CellExecutionUpdateType.Output,
				cellHandle: handle,
				append,
				outputs: outputDtos
			});
	}

	private async updateOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput, append: boolean): Promise<void> {
		items = NotebookCellOutput.ensureUniqueMimeTypes(asArray(items), true);
		return this.updateSoon({
			editType: CellExecutionUpdateType.OutputItems,
			items: items.map(extHostTypeConverters.NotebookCellOutputItem.from),
			outputId: output.id,
			append
		});
	}

	asApiObject(): vscode.NotebookCellExecution {
		const that = this;
		const result: vscode.NotebookCellExecution = {
			get token() { return that._tokenSource.token; },
			get cell() { return that._cell.apiCell; },
			get executionOrder() { return that._executionOrder; },
			set executionOrder(v: number | undefined) {
				that._executionOrder = v;
				that.update([{
					editType: CellExecutionUpdateType.ExecutionState,
					executionOrder: that._executionOrder
				}]);
			},

			start(startTime?: number): void {
				if (that._state === NotebookCellExecutionTaskState.Resolved || that._state === NotebookCellExecutionTaskState.Started) {
					throw new Error('Cannot call start again');
				}

				that._state = NotebookCellExecutionTaskState.Started;
				that._onDidChangeState.fire();

				that.update({
					editType: CellExecutionUpdateType.ExecutionState,
					runStartTime: startTime
				});
			},

			end(success: boolean | undefined, endTime?: number): void {
				if (that._state === NotebookCellExecutionTaskState.Resolved) {
					throw new Error('Cannot call resolve twice');
				}

				that._state = NotebookCellExecutionTaskState.Resolved;
				that._onDidChangeState.fire();

				// The last update needs to be ordered correctly and applied immediately,
				// so we use updateSoon and immediately flush.
				that._collector.flush();

				that._proxy.$completeExecution(that._handle, new SerializableObjectWithBuffers({
					runEndTime: endTime,
					lastRunSuccess: success
				}));
			},

			clearOutput(cell?: vscode.NotebookCell): Thenable<void> {
				that.verifyStateForOutput();
				return that.updateOutputs([], cell, false);
			},

			appendOutput(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputs(outputs, cell, true);
			},

			replaceOutput(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputs(outputs, cell, false);
			},

			appendOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputItems(items, output, true);
			},

			replaceOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Promise<void> {
				that.verifyStateForOutput();
				return that.updateOutputItems(items, output, false);
			}
		};
		return Object.freeze(result);
	}
}


enum NotebookExecutionTaskState {
	Init,
	Started,
	Resolved
}


class NotebookExecutionTask extends Disposable {
	private static HANDLE = 0;
	private _handle = NotebookExecutionTask.HANDLE++;

	private _onDidChangeState = new Emitter<void>();
	readonly onDidChangeState = this._onDidChangeState.event;

	private _state = NotebookExecutionTaskState.Init;
	get state(): NotebookExecutionTaskState { return this._state; }

	private readonly _tokenSource = this._register(new CancellationTokenSource());

	constructor(
		controllerId: string,
		private readonly _notebook: ExtHostNotebookDocument,
		private readonly _proxy: MainThreadNotebookKernelsShape
	) {
		super();

		this._proxy.$createNotebookExecution(this._handle, controllerId, this._notebook.uri);
	}

	cancel(): void {
		this._tokenSource.cancel();
	}
	asApiObject(): vscode.NotebookExecution {
		const result: vscode.NotebookExecution = {
			start: () => {
				if (this._state === NotebookExecutionTaskState.Resolved || this._state === NotebookExecutionTaskState.Started) {
					throw new Error('Cannot call start again');
				}

				this._state = NotebookExecutionTaskState.Started;
				this._onDidChangeState.fire();

				this._proxy.$beginNotebookExecution(this._handle);
			},

			end: () => {
				if (this._state === NotebookExecutionTaskState.Resolved) {
					throw new Error('Cannot call resolve twice');
				}

				this._state = NotebookExecutionTaskState.Resolved;
				this._onDidChangeState.fire();

				this._proxy.$completeNotebookExecution(this._handle);
			},

		};
		return Object.freeze(result);
	}
}

class TimeoutBasedCollector<T> {
	private batch: T[] = [];
	private startedTimer = Date.now();
	private currentDeferred: DeferredPromise<void> | undefined;

	constructor(
		private readonly delay: number,
		private readonly callback: (items: T[]) => Promise<void>) { }

	addItem(item: T): Promise<void> {
		this.batch.push(item);
		if (!this.currentDeferred) {
			this.currentDeferred = new DeferredPromise<void>();
			this.startedTimer = Date.now();
			timeout(this.delay).then(() => {
				return this.flush();
			});
		}

		// This can be called by the extension repeatedly for a long time before the timeout is able to run.
		// Force a flush after the delay.
		if (Date.now() - this.startedTimer > this.delay) {
			return this.flush();
		}

		return this.currentDeferred.p;
	}

	flush(): Promise<void> {
		if (this.batch.length === 0 || !this.currentDeferred) {
			return Promise.resolve();
		}

		const deferred = this.currentDeferred;
		this.currentDeferred = undefined;
		const batch = this.batch;
		this.batch = [];
		return this.callback(batch)
			.finally(() => deferred.complete());
	}
}

export function createKernelId(extensionIdentifier: ExtensionIdentifier, id: string): string {
	return `${extensionIdentifier.value}/${id}`;
}
