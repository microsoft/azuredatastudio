/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { URI } from 'vs/base/common/uri';
import { asArray } from 'vs/base/common/arrays';
import { VSBuffer } from 'vs/base/common/buffer';
import { CellTypes, MimeTypes, OutputTypes } from 'sql/workbench/services/notebook/common/contracts';
import { NBFORMAT, NBFORMAT_MINOR } from 'sql/workbench/common/constants';
import { NotebookCellKind } from 'vs/workbench/api/common/extHostTypes';

const DotnetInteractiveJupyterKernelPrefix = '.net-';
export const DotnetInteractiveLanguagePrefix = 'dotnet-interactive.';
export const DotnetInteractiveDisplayName = '.NET Interactive';

export function convertToVSCodeNotebookCell(cellKind: azdata.nb.CellType, cellIndex: number, cellUri: URI, docUri: URI, cellLanguage: string, cellSource?: string | string[]): vscode.NotebookCell {
	// We only use this notebook field for .NET Interactive's intellisense, which only uses the notebook's URI
	let notebook = <vscode.NotebookDocument>{
		uri: docUri
	};
	return <vscode.NotebookCell>{
		kind: cellKind === CellTypes.Code ? NotebookCellKind.Code : NotebookCellKind.Markup,
		index: cellIndex,
		document: <vscode.TextDocument>{
			uri: cellUri,
			languageId: cellLanguage,
			getText: () => Array.isArray(cellSource) ? cellSource.join('') : (cellSource ?? ''),
			notebook: notebook
		},
		notebook: notebook,
		outputs: [],
		metadata: {},
		mime: undefined,
		executionSummary: undefined
	};
}

export function convertToADSCellOutput(outputs: vscode.NotebookCellOutput | vscode.NotebookCellOutput[], executionOrder?: number): azdata.nb.IDisplayResult[] {
	return asArray(outputs).map(output => {
		let outputData = {};
		for (let item of output.items) {
			outputData[item.mime] = VSBuffer.wrap(item.data).toString();
		}
		return {
			output_type: OutputTypes.ExecuteResult,
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
				mime: MimeTypes.HTML,
				data: VSBuffer.fromString(Array.isArray(streamOutput.text) ? streamOutput.text.join('') : streamOutput.text).buffer
			}];
			break;
		case OutputTypes.Error:
			let errorOutput = output as azdata.nb.IErrorResult;
			let errorString = errorOutput.ename + ': ' + errorOutput.evalue + (errorOutput.traceback ? '\n' + errorOutput.traceback?.join('\n') : '');
			convertedOutputItems = [{
				mime: MimeTypes.HTML,
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

export function convertToADSNotebookContents(notebookData: vscode.NotebookData | undefined): azdata.nb.INotebookContents {
	let result = {
		cells: notebookData?.cells?.map<azdata.nb.ICellContents>(cell => {
			let executionOrder = cell.executionSummary?.executionOrder;
			let convertedCell: azdata.nb.ICellContents = {
				cell_type: cell.kind === NotebookCellKind.Code ? CellTypes.Code : CellTypes.Markdown,
				source: cell.value,
				execution_count: executionOrder,
				outputs: cell.outputs ? convertToADSCellOutput(cell.outputs, executionOrder) : undefined
			};
			convertedCell.metadata = cell.metadata?.custom?.metadata ?? {};
			if (!convertedCell.metadata.language) {
				convertedCell.metadata.language = cell.languageId;
			}
			return convertedCell;
		}),
		metadata: notebookData?.metadata?.custom?.metadata ?? {},
		nbformat: notebookData?.metadata?.custom?.nbformat ?? NBFORMAT,
		nbformat_minor: notebookData?.metadata?.custom?.nbformat_minor ?? NBFORMAT_MINOR
	};
	return result;
}

export function convertToVSCodeNotebookData(notebook: azdata.nb.INotebookContents): vscode.NotebookData {
	let result: vscode.NotebookData = {
		cells: notebook.cells?.map<vscode.NotebookCellData>(cell => {
			return {
				kind: cell.cell_type === CellTypes.Code ? NotebookCellKind.Code : NotebookCellKind.Markup,
				value: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
				languageId: cell.metadata?.language ?? notebook.metadata.language_info?.name,
				outputs: cell.outputs?.map<vscode.NotebookCellOutput>(output => convertToVSCodeCellOutput(output)),
				executionSummary: {
					executionOrder: cell.execution_count
				},
				metadata: {
					custom: {
						metadata: cell.metadata
					}
				}
			};
		}),
		metadata: {
			custom: {
				metadata: notebook.metadata,
				nbformat: notebook.nbformat,
				nbformat_minor: notebook.nbformat_minor
			}
		}
	};
	return result;
}

// #region .NET Interactive Kernel Metadata Conversion

/*
Since ADS relies on notebook kernelSpecs for provider metadata in a lot of places, we have to convert
a .NET Interactive notebook's Jupyter kernelSpec to an internal representation so that it matches up with
the contributed .NET Interactive notebook provider from the Jupyter extension. When saving a notebook, we
then need to restore the original kernelSpec state so that it will work with other notebook apps like
VS Code. VS Code does something similar by shifting a Jupyter notebook's original metadata over to a new
"custom" field, which is then shifted back when saving the notebook.

This is an example of an internal kernel representation we use to get compatibility working (C#, in this case):
kernelSpec: {
	name: 'jupyter-notebook', // Matches the name of the notebook provider from the Jupyter extension
	language: 'dotnet-interactive.csharp', // Matches the contributed languages from the .NET Interactive extension
	display_name: '.NET Interactive' // The kernel name we need to show in our dropdown to match VS Code's kernel dropdown
}

This is how that C# kernel spec would need to be saved to work in VS Code:
kernelSpec: {
	name: '.net-csharp',
	language: 'C#',
	display_name: '.NET (C#)'
}
*/

/**
 * Stores equivalent external kernel metadata in a newly created .NET Interactive notebook, which is used as the default metadata when saving the notebook. This is so that ADS notebooks are still usable in other apps.
 * @param kernelSpec The notebook kernel metadata to be modified.
 */
export function addExternalInteractiveKernelMetadata(kernelSpec: azdata.nb.IKernelSpec): void {
	if (kernelSpec.name === 'jupyter-notebook' && kernelSpec.display_name === DotnetInteractiveDisplayName && kernelSpec.language) {
		let language = kernelSpec.language.replace(DotnetInteractiveLanguagePrefix, '');
		let displayLanguage: string;
		switch (language) {
			case 'csharp':
				displayLanguage = 'C#';
				break;
			case 'fsharp':
				displayLanguage = 'F#';
				break;
			case 'pwsh':
				displayLanguage = 'PowerShell';
				break;
			default:
				displayLanguage = language;
		}
		if (!kernelSpec.oldName) {
			kernelSpec.oldName = `${DotnetInteractiveJupyterKernelPrefix}${language}`;
		}
		if (!kernelSpec.oldDisplayName) {
			kernelSpec.oldDisplayName = `.NET (${displayLanguage})`;
		}
		if (!kernelSpec.oldLanguage) {
			kernelSpec.oldLanguage = displayLanguage;
		}
	}
}

/**
 * Converts a .NET Interactive notebook's metadata to an internal representation needed for VS Code notebook compatibility. This metadata is then restored when saving the notebook.
 * @param metadata The notebook metadata to be modified.
 */
export function convertToInternalInteractiveKernelMetadata(metadata: azdata.nb.INotebookMetadata | undefined): void {
	if (metadata?.kernelspec?.name?.startsWith(DotnetInteractiveJupyterKernelPrefix)) {
		metadata.kernelspec.oldDisplayName = metadata.kernelspec.display_name;
		metadata.kernelspec.display_name = DotnetInteractiveDisplayName;

		let kernelName = metadata.kernelspec.name;
		let baseLanguageName = kernelName.replace(DotnetInteractiveJupyterKernelPrefix, '');
		if (baseLanguageName === 'powershell') {
			baseLanguageName = 'pwsh';
		}
		let languageName = `${DotnetInteractiveLanguagePrefix}${baseLanguageName}`;

		metadata.kernelspec.oldLanguage = metadata.kernelspec.language;
		metadata.kernelspec.language = languageName;

		metadata.language_info.oldName = metadata.language_info.name;
		metadata.language_info.name = languageName;
	}
}

// #endregion
