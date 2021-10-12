/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { VSBuffer } from 'vs/base/common/buffer';
import { NotebookCellKind } from 'vs/workbench/api/common/extHostTypes';
import { CancellationTokenSource } from 'vs/base/common/cancellation';

class VSCodeContentManager implements azdata.nb.ContentManager {
	constructor(private readonly _serializer: vscode.NotebookSerializer) {
	}

	public async deserializeNotebook(contents: string): Promise<azdata.nb.INotebookContents> {
		let buffer = VSBuffer.fromString(contents);
		let notebookData = await this._serializer.deserializeNotebook(buffer.buffer, new CancellationTokenSource().token);
		return {
			cells: notebookData.cells.map<azdata.nb.ICellContents>(cell => {
				return {
					cell_type: cell.kind === NotebookCellKind.Code ? 'code' : 'markdown',
					source: cell.value,
					metadata: {
						language: cell.languageId
					},
					execution_count: cell.executionSummary?.executionOrder,
					outputs: cell.outputs?.map<azdata.nb.IExecuteResult>(output => {
						let outputData = {};
						for (let item of output.items) {
							outputData[item.mime] = item.data;
						}
						return {
							output_type: 'execute_result',
							data: outputData,
							execution_count: cell.executionSummary?.executionOrder,
							metadata: output.metadata,
							id: output.id
						};
					})
				};
			}),
			metadata: {},
			nbformat: notebookData.metadata ? notebookData.metadata['nbformat'] : undefined,
			nbformat_minor: notebookData.metadata ? notebookData.metadata['nbformat_minor'] : undefined
		};
	}

	public async serializeNotebook(notebook: azdata.nb.INotebookContents): Promise<string> {
		let notebookData: vscode.NotebookData = {
			cells: notebook.cells.map<vscode.NotebookCellData>(cell => {
				return {
					kind: cell.cell_type === 'code' ? NotebookCellKind.Code : NotebookCellKind.Markup,
					value: Array.isArray(cell.source) ? cell.source.join('\n') : cell.source,
					languageId: cell.metadata?.language,
					outputs: cell.outputs.map<vscode.NotebookCellOutput>(output => {
						return {
							items: [],
							metadata: output.metadata,
							id: output.id
						};
					})
				};
			})
		};
		let bytes = await this._serializer.serializeNotebook(notebookData, new CancellationTokenSource().token);
		let buffer = VSBuffer.wrap(bytes);
		return buffer.toString();
	}
}

class VSCodeSerializationManager implements azdata.nb.SerializationManager {
	private _manager: VSCodeContentManager;

	constructor(serializer: vscode.NotebookSerializer) {
		this._manager = new VSCodeContentManager(serializer);
	}

	public get contentManager(): azdata.nb.ContentManager {
		return this._manager;
	}
}

export class VSCodeSerializationProvider implements azdata.nb.NotebookSerializationProvider {
	private _manager: VSCodeSerializationManager;

	constructor(private readonly _providerId: string, serializer: vscode.NotebookSerializer) {
		this._manager = new VSCodeSerializationManager(serializer);
	}

	public get providerId(): string {
		return this._providerId;
	}

	public getSerializationManager(notebookUri: vscode.Uri): Thenable<azdata.nb.SerializationManager> {
		return Promise.resolve(this._manager);
	}
}
