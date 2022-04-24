/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { URI } from 'vs/base/common/uri';
import { asArray } from 'vs/base/common/arrays';
import { VSBuffer } from 'vs/base/common/buffer';
import { OutputTypes } from 'sql/workbench/services/notebook/common/contracts';
import { NBFORMAT, NBFORMAT_MINOR } from 'sql/workbench/common/constants';
import { NotebookCellKind } from 'vs/workbench/api/common/extHostTypes';

export function convertToVSCodeNotebookCell(cellSource: string | string[], index: number, uri: URI, language: string): vscode.NotebookCell {
	return <vscode.NotebookCell>{
		index: index,
		document: <vscode.TextDocument>{
			uri: uri,
			languageId: language,
			getText: () => Array.isArray(cellSource) ? cellSource.join('') : cellSource,
		},
		notebook: <vscode.NotebookDocument>{
			uri: uri
		}
	};
}

export function convertToADSCellOutput(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], executionOrder?: number): azdata.nb.IDisplayResult[] {
	return asArray(outputs).map(output => {
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
	});
}

export function convertToVSCodeCellOutput(output: azdata.nb.ICellOutput): vscode.NotebookCellOutput {
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

export function convertToADSNotebookContents(notebookData: vscode.NotebookData): azdata.nb.INotebookContents {
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
				outputs: cell.outputs ? convertToADSCellOutput(cell.outputs, executionOrder) : undefined
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

export function convertToVSCodeNotebookData(notebook: azdata.nb.INotebookContents): vscode.NotebookData {
	let result: vscode.NotebookData = {
		cells: notebook.cells?.map<vscode.NotebookCellData>(cell => {
			return {
				kind: cell.cell_type === 'code' ? NotebookCellKind.Code : NotebookCellKind.Markup,
				value: Array.isArray(cell.source) ? cell.source.join('\n') : cell.source,
				languageId: cell.metadata?.language,
				outputs: cell.outputs?.map<vscode.NotebookCellOutput>(output => convertToVSCodeCellOutput(output)),
				executionSummary: {
					executionOrder: cell.execution_count
				}
			};
		}),
		metadata: notebook.metadata
	};
	result.metadata.custom = {
		nbformat: notebook.nbformat,
		nbformat_minor: notebook.nbformat_minor
	};
	return result;
}
