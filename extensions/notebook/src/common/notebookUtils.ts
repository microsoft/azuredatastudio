/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as crypto from 'crypto';
import * as os from 'os';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getErrorMessage, isEditorTitleFree } from '../common/utils';

const localize = nls.loadMessageBundle();

const JUPYTER_NOTEBOOK_PROVIDER = 'jupyter';
const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', "This sample code loads the file into a data frame and shows the first 10 results.");
const noNotebookVisible = localize('noNotebookVisible', "No notebook editor is active");

/**
 * Creates a random token per https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback.
 * Defaults to 24 bytes, which creates a 48-char hex string
 */
export function getRandomToken(size: number = 24): Promise<string> {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(size, (err, buffer) => {
			if (err) {
				reject(err);
			}
			let token = buffer.toString('hex');
			resolve(token);
		});
	});
}

export async function newNotebook(connectionProfile?: azdata.IConnectionProfile): Promise<azdata.nb.NotebookEditor> {
	const title = findNextUntitledEditorName();
	const untitledUri = vscode.Uri.parse(`untitled:${title}`);
	const options: azdata.nb.NotebookShowOptions = connectionProfile ? {
		viewColumn: null,
		preserveFocus: true,
		preview: null,
		providerId: null,
		connectionProfile: connectionProfile,
		defaultKernel: null
	} : null;
	return azdata.nb.showNotebookDocument(untitledUri, options);
}

function findNextUntitledEditorName(): string {
	let nextVal = 0;
	// Note: this will go forever if it's coded wrong, or you have infinite Untitled notebooks!
	while (true) {
		let title = `Notebook-${nextVal}`;
		if (isEditorTitleFree(title)) {
			return title;
		}
		nextVal++;
	}
}

export async function openNotebook(): Promise<void> {
	try {
		let filter: { [key: string]: Array<string> } = {};
		// TODO support querying valid notebook file types
		filter[localize('notebookFiles', "Notebooks")] = ['ipynb'];
		let file = await vscode.window.showOpenDialog({
			filters: filter
		});
		if (file) {
			let doc = await vscode.workspace.openTextDocument(file[0]);
			vscode.window.showTextDocument(doc);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

export async function runActiveCell(): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.runCell();
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

export async function clearActiveCellOutput(): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.clearOutput();
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

export async function runAllCells(startCell?: azdata.nb.NotebookCell, endCell?: azdata.nb.NotebookCell): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.runAllCells(startCell, endCell);
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

export async function addCell(cellType: azdata.nb.CellType): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
				// TODO should prompt and handle cell placement
				editBuilder.insertCell({
					cell_type: cellType,
					source: ''
				});
			});
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

export async function analyzeNotebook(oeContext?: azdata.ObjectExplorerContext): Promise<void> {
	// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
	// to handle this. We should look into improving this in the future
	let title = findNextUntitledEditorName();
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);

	let editor = await azdata.nb.showNotebookDocument(untitledUri, {
		connectionProfile: oeContext ? oeContext.connectionProfile : undefined,
		providerId: JUPYTER_NOTEBOOK_PROVIDER,
		preview: false,
		defaultKernel: {
			name: 'pysparkkernel',
			display_name: 'PySpark',
			language: 'python'
		}
	});
	if (oeContext && oeContext.nodeInfo && oeContext.nodeInfo.nodePath) {
		// Get the file path after '/HDFS'
		let hdfsPath: string = oeContext.nodeInfo.nodePath.substring(oeContext.nodeInfo.nodePath.indexOf('/HDFS') + '/HDFS'.length);
		if (hdfsPath.length > 0) {
			let analyzeCommand = '#' + msgSampleCodeDataFrame + os.EOL + 'df = (spark.read.option("inferSchema", "true")'
				+ os.EOL + '.option("header", "true")' + os.EOL + '.csv("{0}"))' + os.EOL + 'df.show(10)';

			editor.edit(editBuilder => {
				editBuilder.insertCell({
					cell_type: 'code',
					source: analyzeCommand.replace('{0}', hdfsPath)
				}, 0);
			});
		}
	}
}
