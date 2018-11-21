/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(extensionContext: vscode.ExtensionContext) {
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.new', () => {
		// sqlops.nb.openNotebookDocument()
	}));

}

// this method is called when your extension is deactivated
export function deactivate() {
}
