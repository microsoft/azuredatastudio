/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { INotebookKernelDto2 } from 'vs/workbench/api/common/extHost.protocol';
import { Emitter } from 'vs/base/common/event';
import * as extHostTypeConverters from 'vs/workbench/api/common/extHostTypeConverters';

export class VSCodeExecuteProvider implements azdata.nb.NotebookExecuteProvider {

	constructor(controller: vscode.NotebookController) {

	}

	providerId: string;
	getExecuteManager(notebookUri: vscode.Uri): Thenable<azdata.nb.ExecuteManager> {
		throw new Error('Method not implemented.');
	}
	handleNotebookClosed(notebookUri: vscode.Uri): void {
		throw new Error('Method not implemented.');
	}
}

export class ADSNotebookController implements vscode.NotebookController {
	private readonly _kernelData: INotebookKernelDto2;
	private _interruptHandler: (notebook: vscode.NotebookDocument) => void | Thenable<void>;

	private readonly _onDidChangeSelection = new Emitter<{ selected: boolean, notebook: vscode.NotebookDocument; }>();
	private readonly _onDidReceiveMessage = new Emitter<{ editor: vscode.NotebookEditor, message: any; }>();

	constructor(
		private _extension: IExtensionDescription,
		private _id: string,
		private _viewType: string,
		private _label: string,
		private _handler?: (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => void | Thenable<void>,
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

	public get id() { return this._id; }

	public get notebookType() { return this._viewType; }

	public get onDidChangeSelectedNotebooks() {
		return this._onDidChangeSelection.event;
	}

	public get onDidReceiveMessage() {
		return this._onDidReceiveMessage.event;
	}

	public get label() {
		return this._kernelData.label;
	}

	public set label(value) {
		this._kernelData.label = value ?? this._extension.displayName ?? this._extension.name;
	}

	public get detail() {
		return this._kernelData.detail ?? '';
	}

	public set detail(value) {
		this._kernelData.detail = value;
	}

	public get description() {
		return this._kernelData.description ?? '';
	}

	public set description(value) {
		this._kernelData.description = value;
	}

	public get supportedLanguages() {
		return this._kernelData.supportedLanguages;
	}

	public set supportedLanguages(value) {
		this._kernelData.supportedLanguages = value;
	}

	public get supportsExecutionOrder() {
		return this._kernelData.supportsExecutionOrder ?? false;
	}

	public set supportsExecutionOrder(value) {
		this._kernelData.supportsExecutionOrder = value;
	}

	public get rendererScripts() {
		return this._kernelData.preloads ? this._kernelData.preloads.map(extHostTypeConverters.NotebookRendererScript.to) : [];
	}

	public get executeHandler() {
		return this._handler;
	}

	public set executeHandler(value) {
		this._handler = value;
	}

	public get interruptHandler() {
		return this._interruptHandler;
	}

	public set interruptHandler(value) {
		this._interruptHandler = value;
		this._kernelData.supportsInterrupt = Boolean(value);
	}

	public createNotebookCellExecution(cell: vscode.NotebookCell): vscode.NotebookCellExecution {
		return new ADSNotebookCellExecution(cell);
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
	constructor(cell: vscode.NotebookCell) {

	}

	cell: vscode.NotebookCell;
	token: vscode.CancellationToken;
	executionOrder: number;
	start(startTime?: number): void {
		throw new Error('Method not implemented.');
	}
	end(success: boolean, endTime?: number): void {
		throw new Error('Method not implemented.');
	}
	clearOutput(cell?: vscode.NotebookCell): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	replaceOutput(out: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	appendOutput(out: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], cell?: vscode.NotebookCell): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	replaceOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	appendOutputItems(items: vscode.NotebookCellOutputItem | vscode.NotebookCellOutputItem[], output: vscode.NotebookCellOutput): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}
