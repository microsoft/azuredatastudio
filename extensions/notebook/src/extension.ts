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

export function activate(extensionContext: vscode.ExtensionContext) {
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.new', () => {
		let title = `Untitled-${counter++}`;
		let untitledUri = vscode.Uri.parse(`untitled:${title}`);
		sqlops.nb.showNotebookDocument(untitledUri).then(success => {

		}, (err: Error) => {
			vscode.window.showErrorMessage(err.message);
		});
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', () => {
		openNotebook();
	}));

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

// this method is called when your extension is deactivated
export function deactivate() {
}
