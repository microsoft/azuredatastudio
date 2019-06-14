/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { BookTreeViewProvider } from './bookTreeView';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate() {
	const bookTreeViewProvider = new BookTreeViewProvider(vscode.workspace.rootPath || '');
	vscode.window.registerTreeDataProvider('bookTreeView', bookTreeViewProvider);
	vscode.commands.registerCommand('bookTreeView.refreshEntry', () => bookTreeViewProvider.refresh());
	vscode.commands.registerCommand('bookTreeView.openNotebook', (resource) => bookTreeViewProvider.openNotebook(resource));
}
