/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import type * as vscode from 'vscode';
import { URI } from 'vs/base/common/uri';
import { OutputTypes } from 'sql/workbench/services/notebook/common/contracts';
import { VSBuffer } from 'vs/base/common/buffer';
import { asArray } from 'vs/base/common/arrays';

export function convertToVSCodeNotebookDocument(notebook: azdata.nb.NotebookDocument): vscode.NotebookDocument {
	return {
		get uri() { return notebook.uri; },
		get version() { return undefined; },
		get notebookType() { return notebook.providerId; },
		get isDirty() { return notebook.isDirty; },
		get isUntitled() { return notebook.isUntitled; },
		get isClosed() { return notebook.isClosed; },
		get metadata() { return {}; },
		get cellCount() { return notebook.cells?.length; },
		cellAt(index) {
			if (notebook.cells) {
				if (index < 0) {
					index = 0;
				} else if (index >= notebook.cells.length) {
					index = notebook.cells.length - 1;
				}
				return convertToVSCodeNotebookCell(notebook.cells[index].contents.source, index, notebook.uri, notebook.kernelSpec.language);
			}
			return undefined;
		},
		getCells(range) {
			let cells: azdata.nb.NotebookCell[] = [];
			if (range) {
				cells = notebook.cells?.slice(range.start, range.end);
			} else {
				cells = notebook.cells;
			}
			return cells?.map((cell, index) => convertToVSCodeNotebookCell(cell.contents.source, index, notebook.uri, notebook.kernelSpec.language));
		},
		save() {
			return notebook.save();
		}
	};
}

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
