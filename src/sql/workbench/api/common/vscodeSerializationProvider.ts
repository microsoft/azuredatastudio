/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { VSBuffer } from 'vs/base/common/buffer';
import { NotebookCellKind } from 'vs/workbench/api/common/extHostTypes';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { OutputTypes } from 'sql/workbench/services/notebook/common/contracts';
import { NBFORMAT, NBFORMAT_MINOR } from 'sql/workbench/common/constants';

/**
 * A Notebook Content Manager that is used as part of converting VS Code notebook extension APIs into ADS equivalents.
 */
export class VSCodeContentManager implements azdata.nb.ContentManager {
	constructor(private readonly _serializer: vscode.NotebookSerializer) {
	}

	public static convertToADSCellOutput(output: vscode.NotebookCellOutput, executionOrder?: number): azdata.nb.IExecuteResult {
		let outputData = {};
		for (let item of output.items) {
			outputData[item.mime] = VSBuffer.wrap(item.data).toString();
		}
		return {
			output_type: 'execute_result',
			data: outputData,
			execution_count: executionOrder,
			metadata: output.metadata,
			id: output.id
		};
	}

	public async deserializeNotebook(contents: string): Promise<azdata.nb.INotebookContents> {
		let buffer = VSBuffer.fromString(contents);
		let notebookData = await this._serializer.deserializeNotebook(buffer.buffer, new CancellationTokenSource().token);
		let result = {
			cells: notebookData.cells?.map<azdata.nb.ICellContents>(cell => {
				let executionOrder = cell.executionSummary?.executionOrder;
				return {
					cell_type: cell.kind === NotebookCellKind.Code ? 'code' : 'markdown',
					source: cell.value,
					metadata: {
						language: cell.languageId
					},
					execution_count: executionOrder,
					outputs: cell.outputs?.map<azdata.nb.IExecuteResult>(output => VSCodeContentManager.convertToADSCellOutput(output, executionOrder))
				};
			}),
			metadata: notebookData.metadata ?? {},
			nbformat: notebookData.metadata?.custom?.nbformat ?? NBFORMAT,
			nbformat_minor: notebookData.metadata?.custom?.nbformat_minor ?? NBFORMAT_MINOR
		};

		// Clear out extra lingering vscode custom metadata
		delete result.metadata.custom;

		return result;
	}

	public static convertToVSCodeCellOutput(output: azdata.nb.ICellOutput): vscode.NotebookCellOutput {
		let convertedOutputItems: vscode.NotebookCellOutputItem[];
		switch (output.output_type) {
			case OutputTypes.ExecuteResult:
			case OutputTypes.DisplayData:
			case OutputTypes.UpdateDisplayData:
				let displayOutput = output as azdata.nb.IDisplayResult;
				convertedOutputItems = Object.keys(displayOutput.data).map<vscode.NotebookCellOutputItem>(key => {
					return {
						mime: key,
						data: VSBuffer.fromString(displayOutput.data[key]).buffer
					};
				});
				break;
			case OutputTypes.Stream:
				let streamOutput = output as azdata.nb.IStreamResult;
				convertedOutputItems = [{
					mime: 'text/html',
					data: VSBuffer.fromString(Array.isArray(streamOutput.text) ? streamOutput.text.join('') : streamOutput.text).buffer
				}];
				break;
			case OutputTypes.Error:
				let errorOutput = output as azdata.nb.IErrorResult;
				let errorString = errorOutput.ename + ': ' + errorOutput.evalue + (errorOutput.traceback ? '\n' + errorOutput.traceback?.join('\n') : '');
				convertedOutputItems = [{
					mime: 'text/html',
					data: VSBuffer.fromString(errorString).buffer
				}];
				break;
		}
		return {
			items: convertedOutputItems,
			metadata: output.metadata,
			id: output.id
		};
	}

	public async serializeNotebook(notebook: azdata.nb.INotebookContents): Promise<string> {
		let notebookData: vscode.NotebookData = {
			cells: notebook.cells?.map<vscode.NotebookCellData>(cell => {
				return {
					kind: cell.cell_type === 'code' ? NotebookCellKind.Code : NotebookCellKind.Markup,
					value: Array.isArray(cell.source) ? cell.source.join('\n') : cell.source,
					languageId: cell.metadata?.language,
					outputs: cell.outputs?.map<vscode.NotebookCellOutput>(output => VSCodeContentManager.convertToVSCodeCellOutput(output)),
					executionSummary: {
						executionOrder: cell.execution_count
					}
				};
			}),
			metadata: notebook.metadata
		};
		notebookData.metadata.custom = {
			nbformat: notebook.nbformat,
			nbformat_minor: notebook.nbformat_minor
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

/**
 * A Notebook Serialization Provider that is used to convert VS Code notebook extension APIs into ADS equivalents.
 */
export class VSCodeSerializationProvider implements azdata.nb.NotebookSerializationProvider {
	private _manager: VSCodeSerializationManager;

	constructor(public readonly providerId: string, serializer: vscode.NotebookSerializer) {
		this._manager = new VSCodeSerializationManager(serializer);
	}

	public getSerializationManager(notebookUri: vscode.Uri): Thenable<azdata.nb.SerializationManager> {
		return Promise.resolve(this._manager);
	}
}
