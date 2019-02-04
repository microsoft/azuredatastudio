/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

let counter = 0;
const noNotebookVisible = localize('noNotebookVisible', 'No notebook editor is active');
export function activate(extensionContext: vscode.ExtensionContext) {
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.new', ( connectionId? : string) => {
		newNotebook(connectionId);
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', () => {
		openNotebook();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runactivecell', () => {
		runActiveCell();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcode', () => {
		addCell('code');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addtext', () => {
		addCell('markdown');
	}));

}

function newNotebook(connectionId: string) {
	let title = `Untitled-${counter++}`;
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);
	let options: sqlops.nb.NotebookShowOptions = connectionId ? {
		viewColumn: null,
		preserveFocus: true,
		preview: null,
		providerId: null,
		connectionId: connectionId,
		defaultKernel: null
	} : null;
	sqlops.nb.showNotebookDocument(untitledUri, options).then(success => {
	}, (err: Error) => {
		vscode.window.showErrorMessage(err.message);
	});
}

async function openNotebook(): Promise<void> {
	try {
		let filter = {};
		// TODO support querying valid notebook file types
		filter[localize('notebookFiles', 'Notebooks')] = ['ipynb'];
		let file = await vscode.window.showOpenDialog({
			filters: filter
		});
		if (file) {
			let doc = await vscode.workspace.openTextDocument(file[0]);
			vscode.window.showTextDocument(doc);
		}
	} catch (err) {
		vscode.window.showErrorMessage(err);
	}
}

async function runActiveCell(): Promise<void> {
	try {
		let notebook = sqlops.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.runCell();
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(err);
	}
}

async function addCell(cellType: sqlops.nb.CellType): Promise<void> {
	try {
		let notebook = sqlops.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.edit((editBuilder: sqlops.nb.NotebookEditorEdit) => {
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
		vscode.window.showErrorMessage(err);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
}
