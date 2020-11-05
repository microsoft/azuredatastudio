/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('hybridtoolkit.openNotebooks', () => {
		vscode.commands.executeCommand('notebook.command.openNotebookFolder', context.asAbsolutePath('notebooks'), undefined, undefined);
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}
