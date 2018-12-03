/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

let counter = 0;


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(extensionContext: vscode.ExtensionContext) {
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.new', () => {
		let title = `Untitled-${counter++}`;
		let untitledUri = vscode.Uri.parse(`untitled:${title}`);
		sqlops.nb.showNotebookDocument(untitledUri);
	}));

}

// this method is called when your extension is deactivated
export function deactivate() {
}
