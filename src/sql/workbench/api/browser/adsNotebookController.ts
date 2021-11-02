/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { INotebookKernelDto2 } from 'vs/workbench/api/common/extHost.protocol';
import { Emitter, Event } from 'vs/base/common/event';
import * as extHostTypeConverters from 'vs/workbench/api/common/extHostTypeConverters';
import { Registry } from 'vs/platform/registry/common/platform';
import { INotebookProviderRegistry, NotebookProviderRegistryId } from 'sql/workbench/services/notebook/common/notebookRegistry';
import { INotebookEditor, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Deferred } from 'sql/base/common/promise';

const notebookRegistry = Registry.as<INotebookProviderRegistry>(NotebookProviderRegistryId);

type SelectionChangedEvent = { selected: boolean, notebook: vscode.NotebookDocument; };
type MessageReceivedEvent = { editor: vscode.NotebookEditor, message: any; };
type ExecutionHandler = (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => void | Thenable<void>;
type InterruptHandler = (notebook: vscode.NotebookDocument) => void | Thenable<void>;

export class ADSNotebookController implements vscode.NotebookController {
	private readonly _kernelData: INotebookKernelDto2;
	private _interruptHandler: (notebook: vscode.NotebookDocument) => void | Thenable<void>;

	private readonly _onDidChangeSelection = new Emitter<SelectionChangedEvent>();
	private readonly _onDidReceiveMessage = new Emitter<MessageReceivedEvent>();

	public readonly languagesAdded = new Deferred<void>();

	constructor(
		private _extension: IExtensionDescription,
		private _id: string,
		private _viewType: string,
		private _label: string,
		private _notebookService: INotebookService,
		private _handler?: ExecutionHandler,
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
		notebookRegistry.updateProviderDescriptionLanguages(this._viewType, value);
		this.languagesAdded.resolve();
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
		return this._handler;
	}

	public set executeHandler(value: ExecutionHandler) {
		this._handler = value;
	}

	public get interruptHandler(): InterruptHandler {
		return this._interruptHandler;
	}

	public set interruptHandler(value: InterruptHandler) {
		this._interruptHandler = value;
		this._kernelData.supportsInterrupt = Boolean(value);
	}

	public createNotebookCellExecution(cell: vscode.NotebookCell): vscode.NotebookCellExecution {
		return new ADSNotebookCellExecution(cell, this._notebookService);
	}

	public dispose(): void {
		// No-op
	}

	public updateNotebookAffinity(notebook: vscode.NotebookDocument, affinity: vscode.NotebookControllerAffinity): void {
		throw new Error('Method not implemented.');
	}

	public postMessage(message: any, editor?: vscode.NotebookEditor): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}

	public asWebviewUri(localResource: vscode.Uri): vscode.Uri {
		throw new Error('Method not implemented.');
	}
}

class ADSNotebookCellExecution implements vscode.NotebookCellExecution {
	private _notebookEditor: INotebookEditor;

	constructor(private readonly _cell: vscode.NotebookCell, private readonly _notebookService: INotebookService) {
	}

	private get editor(): INotebookEditor {
		if (!this._notebookEditor) {
			this._notebookEditor = this._notebookService.findNotebookEditor(this._cell.notebook.uri);
		}
		return this._notebookEditor;
	}

	private get innerCell(): ICellModel {
		if (this.editor?.cells && this._cell.index > 0) {
			return this.editor.cells[this._cell.index];
		}
		return undefined;
	}

	public get cell(): vscode.NotebookCell {
		return this._cell;
	}

	public get token(): vscode.CancellationToken {
		return undefined;
	}

	public get executionOrder(): number {
		return this.innerCell?.executionCount ?? -1;
	}

	public set executionOrder(order: number) {
		if (this.innerCell) {
			this.innerCell.executionCount = order;
		}
	}

	public start(startTime?: number): void {
		// No-op
	}

	public end(success: boolean, endTime?: number): void {
		// No-op
	}

	public async clearOutput(cell?: vscode.NotebookCell): Promise<void> {
		if (this.editor && this.innerCell) {
			return this.editor.clearOutput(this.innerCell).then();
		}
	}

	public replaceOutput(out: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	public appendOutput(out: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	public replaceOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	public appendOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}
