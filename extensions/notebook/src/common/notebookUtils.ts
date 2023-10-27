/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getErrorMessage } from '../common/utils';

const localize = nls.loadMessageBundle();

const noNotebookVisible = localize('noNotebookVisible', "No notebook editor is active");

export class NotebookUtils {

	constructor() { }

	public async openNotebook(): Promise<void> {
		try {
			let filter: { [key: string]: Array<string> } = {};
			// TODO support querying valid notebook file types
			filter[localize('notebookFiles', "Notebooks")] = ['ipynb'];
			let file = await vscode.window.showOpenDialog({
				filters: filter
			});
			if (file && file.length > 0) {
				await azdata.nb.showNotebookDocument(file[0]);
			}
		} catch (err) {
			void vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	public async runActiveCell(): Promise<void> {
		try {
			let notebook = azdata.nb.activeNotebookEditor;
			if (notebook) {
				await notebook.runCell();
			} else {
				throw new Error(noNotebookVisible);
			}
		} catch (err) {
			void vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	public async clearActiveCellOutput(): Promise<void> {
		try {
			let notebook = azdata.nb.activeNotebookEditor;
			if (notebook) {
				await notebook.clearOutput();
			} else {
				throw new Error(noNotebookVisible);
			}
		} catch (err) {
			void vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	public async runAllCells(startCell?: azdata.nb.NotebookCell, endCell?: azdata.nb.NotebookCell): Promise<void> {
		try {
			let notebook = azdata.nb.activeNotebookEditor;
			if (notebook) {
				await notebook.runAllCells(startCell, endCell);
			} else {
				throw new Error(noNotebookVisible);
			}
		} catch (err) {
			void vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	public async addCell(cellType: azdata.nb.CellType): Promise<void> {
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
			void vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	public async toggleMarkdownStyle(style: string, showUI?: boolean, value?: string): Promise<void> {
		return vscode.commands.executeCommand(style, showUI, value);
	}
}
