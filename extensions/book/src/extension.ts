/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { BookTreeViewProvider, Notebook } from './bookTreeView';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('hahahahahahahahahahahahahahahahahahahaha');
    // c:\Users\t-luz\Desktop\lucyzhang929.github.io
    const bookTreeViewProvider = new BookTreeViewProvider(vscode.workspace.rootPath);
    vscode.window.registerTreeDataProvider('bookTreeView', bookTreeViewProvider);
    vscode.commands.registerCommand('bookTreeView.refreshEntry', () => bookTreeViewProvider.refresh());
    vscode.commands.registerCommand('extension.openPackageOnNpm', moduleName => vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`https://www.npmjs.com/package/${moduleName}`)));
    vscode.commands.registerCommand('bookTreeView.addEntry', () => vscode.window.showInformationMessage(`Successfully called add entry.`));
    vscode.commands.registerCommand('bookTreeView.editEntry', (node: Notebook) => vscode.window.showInformationMessage(`Successfully called edit entry on ${node.label}.`));
    vscode.commands.registerCommand('bookTreeView.deleteEntry', (node: Notebook) => vscode.window.showInformationMessage(`Successfully called delete entry on ${node.label}.`));
}

/*     // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('extension.showCurrentConnection', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        sqlops.connection.getCurrentConnection().then(connection => {
            let connectionId = connection ? connection.connectionId : 'No connection found!';
            vscode.window.showInformationMessage(connectionId);
        }, error => {
             console.info(error);
        });
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}*/