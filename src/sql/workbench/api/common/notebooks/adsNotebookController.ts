/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { INotebookKernelDto2 } from 'vs/workbench/api/common/extHost.protocol';
import { Emitter, Event } from 'vs/base/common/event';
import * as extHostTypeConverters from 'vs/workbench/api/common/extHostTypeConverters';
import { Deferred } from 'sql/base/common/promise';
import { ExtHostNotebookDocumentsAndEditors } from 'sql/workbench/api/common/extHostNotebookDocumentsAndEditors';
import { URI } from 'vs/base/common/uri';
import { NotebookCellExecutionTaskState } from 'vs/workbench/api/common/extHostNotebookKernels';
import { asArray } from 'vs/base/common/arrays';
import { convertToADSCellOutput } from 'sql/workbench/api/common/notebooks/notebookUtils';
import { CancellationTokenSource } from 'vs/base/common/cancellation';

type SelectionChangedEvent = { selected: boolean, notebook: vscode.NotebookDocument; };
type MessageReceivedEvent = { editor: vscode.NotebookEditor, message: any; };
type ExecutionHandler = (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => void | Thenable<void>;
type LanguagesHandler = (languages: string[]) => void;
type InterruptHandler = (notebook: vscode.NotebookDocument) => void | Promise<void>;
type GetDocHandler = (notebookUri: URI) => azdata.nb.NotebookDocument;

/**
 * A VS Code Notebook Controller that is used as part of converting VS Code notebook extension APIs into ADS equivalents.
 */
export class ADSNotebookController implements vscode.NotebookController {
	private readonly _kernelData: INotebookKernelDto2;
	private _interruptHandler: (notebook: vscode.NotebookDocument) => void | Promise<void>;

	private readonly _onDidChangeSelection = new Emitter<SelectionChangedEvent>();
	private readonly _onDidReceiveMessage = new Emitter<MessageReceivedEvent>();

	private readonly _languagesAdded = new Deferred<void>();
	private readonly _executionHandlerAdded = new Deferred<void>();

	private readonly _execMap: Map<string, ADSNotebookCellExecution> = new Map();

	constructor(
		private _extension: IExtensionDescription,
		private _id: string,
		private _viewType: string,
		private _label: string,
		private _extHostNotebookDocumentsAndEditors: ExtHostNotebookDocumentsAndEditors,
		private _languagesHandler: LanguagesHandler,
		private _getDocHandler: GetDocHandler,
		private _execHandler?: ExecutionHandler,
		preloads?: vscode.NotebookRendererScript[]
	) {
		this._kernelData = {
			id: `${this._extension.identifier.value}/${this._id}`,
			notebookType: this._viewType,
			extensionId: this._extension.identifier,
			extensionLocation: this._extension.extensionLocation,
			label: this._label || this._extension.identifier.value,
			preloads: preloads ? preloads.map(extHostTypeConverters.NotebookRendererScript.from) : []
		};
		if (this._execHandler) {
			this._executionHandlerAdded.resolve();
		}
	}

	public get languagesAdded(): Promise<void> {
		return this._languagesAdded.promise;
	}

	public get executionHandlerAdded(): Promise<void> {
		return this._executionHandlerAdded.promise;
	}

	public get id(): string { return this._id; }

	public get notebookType(): string { return this._viewType; }

	public get onDidChangeSelectedNotebooks(): Event<SelectionChangedEvent> {
		return this._onDidChangeSelection.event;
	}

	public get onDidReceiveMessage(): Event<MessageReceivedEvent> {
		return this._onDidReceiveMessage.event;
	}

	public get label(): string {
		return this._kernelData.label;
	}

	public set label(value: string) {
		this._kernelData.label = value ?? this._extension.displayName ?? this._extension.name;
	}

	public get detail(): string {
		return this._kernelData.detail ?? '';
	}

	public set detail(value: string) {
		this._kernelData.detail = value;
	}

	public get description(): string {
		return this._kernelData.description ?? '';
	}

	public set description(value: string) {
		this._kernelData.description = value;
	}

	public get supportedLanguages(): string[] | undefined {
		return this._kernelData.supportedLanguages;
	}

	public set supportedLanguages(value: string[]) {
		this._kernelData.supportedLanguages = value;
		this._languagesHandler(value);
		this._languagesAdded.resolve();
	}

	public get supportsExecutionOrder(): boolean {
		return this._kernelData.supportsExecutionOrder ?? false;
	}

	public set supportsExecutionOrder(value: boolean) {
		this._kernelData.supportsExecutionOrder = value;
	}

	public get rendererScripts(): vscode.NotebookRendererScript[] {
		return this._kernelData.preloads ? this._kernelData.preloads.map(extHostTypeConverters.NotebookRendererScript.to) : [];
	}

	public get executeHandler(): ExecutionHandler {
		return this._execHandler;
	}

	public set executeHandler(value: ExecutionHandler) {
		this._execHandler = value;
		this._executionHandlerAdded.resolve();
	}

	public get interruptHandler(): InterruptHandler {
		return this._interruptHandler;
	}

	public set interruptHandler(value: InterruptHandler) {
		this._interruptHandler = value;
		this._kernelData.supportsInterrupt = Boolean(value);
	}

	public getCellExecution(cellUri: URI): ADSNotebookCellExecution | undefined {
		return this._execMap.get(cellUri.toString());
	}

	public removeCellExecution(cellUri: URI): void {
		this._execMap.delete(cellUri.toString());
	}

	public getNotebookDocument(notebookUri: URI): azdata.nb.NotebookDocument {
		return this._getDocHandler(notebookUri);
	}

	public createNotebookCellExecution(cell: vscode.NotebookCell): vscode.NotebookCellExecution {
		let exec = new ADSNotebookCellExecution(cell, this._extHostNotebookDocumentsAndEditors);
		this._execMap.set(cell.document.uri.toString(), exec);
		return exec;
	}

	public dispose(): void {
		// No-op
	}

	public updateNotebookAffinity(notebook: vscode.NotebookDocument, affinity: vscode.NotebookControllerAffinity): void {
		// No-op
	}

	public postMessage(message: any, editor?: vscode.NotebookEditor): Thenable<boolean> {
		return Promise.resolve(true);
	}

	public asWebviewUri(localResource: vscode.Uri): vscode.Uri {
		return undefined;
	}
}

class ADSNotebookCellExecution implements vscode.NotebookCellExecution {
	private _executionOrder: number;
	private _state = NotebookCellExecutionTaskState.Init;
	private _cancellationSource = new CancellationTokenSource();
	constructor(private readonly _cell: vscode.NotebookCell, private readonly _extHostNotebookDocumentsAndEditors: ExtHostNotebookDocumentsAndEditors) {
		this._executionOrder = this._cell.executionSummary?.executionOrder ?? -1;
	}

	public get cell(): vscode.NotebookCell {
		return this._cell;
	}

	public get tokenSource(): vscode.CancellationTokenSource {
		return this._cancellationSource;
	}

	public get token(): vscode.CancellationToken {
		return this._cancellationSource.token;
	}

	public get executionOrder(): number {
		return this._executionOrder;
	}

	public set executionOrder(order: number) {
		this._executionOrder = order;
	}

	public start(startTime?: number): void {
		this._state = NotebookCellExecutionTaskState.Started;
	}

	public end(success: boolean, endTime?: number): void {
		this._state = NotebookCellExecutionTaskState.Resolved;
	}

	public async clearOutput(cell?: vscode.NotebookCell): Promise<void> {
		this.verifyStateForOutput();
		const targetCell = typeof cell === 'number' ? this._cell.notebook.cellAt(cell) : (cell ?? this._cell);
		const editor = this._extHostNotebookDocumentsAndEditors.getEditor(URI.from(targetCell.notebook.uri).toString());
		await editor.clearOutput(editor.document.cells[targetCell.index]);
	}

	public async replaceOutput(out: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Promise<void> {
		this.verifyStateForOutput();
		return this.updateOutputs(out, cell, false);
	}

	public async appendOutput(out: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Promise<void> {
		this.verifyStateForOutput();
		return this.updateOutputs(out, cell, true);
	}

	public async replaceOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Promise<void> {
		this.verifyStateForOutput();
		return this.updateOutputItems(items, output, false);
	}

	public async appendOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Promise<void> {
		this.verifyStateForOutput();
		return this.updateOutputItems(items, output, true);
	}

	private async updateOutputs(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell: vscode.NotebookCell | number | undefined, append: boolean): Promise<void> {
		this.verifyStateForOutput();
		const targetCell = typeof cell === 'number' ? this._cell.notebook.cellAt(cell) : (cell ?? this._cell);
		const editor = this._extHostNotebookDocumentsAndEditors.getEditor(URI.from(targetCell.notebook.uri).toString());
		await editor.edit(builder => {
			const adsOutputs = convertToADSCellOutput(outputs);
			builder.updateCell(targetCell.index, { outputs: adsOutputs }, append);
		});
	}

	private async updateOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput, append: boolean): Promise<void> {
		this.verifyStateForOutput();
		const editor = this._extHostNotebookDocumentsAndEditors.getEditor(URI.from(this._cell.notebook.uri).toString());
		await editor.edit(builder => {
			const adsOutput = convertToADSCellOutput({ id: output.id, items: asArray(items) }, undefined);
			builder.updateCellOutput(this._cell.index, { outputs: adsOutput }, append);
		});
	}

	/**
	 * Verify that the execution is in a state where it's valid to modify the output (currently executing).
	 */
	private verifyStateForOutput() {
		if (this._state === NotebookCellExecutionTaskState.Init) {
			throw new Error('Must call start before modifying cell output');
		}

		if (this._state === NotebookCellExecutionTaskState.Resolved) {
			throw new Error('Cannot modify cell output after calling end');
		}
	}
}
