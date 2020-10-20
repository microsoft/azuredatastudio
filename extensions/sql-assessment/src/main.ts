/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import MainController from './maincontroller';

let mainController: MainController;

export function activate(context: vscode.ExtensionContext) {
	mainController = new MainController(context);
	mainController.activate();
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	mainController?.deactivate();
}
