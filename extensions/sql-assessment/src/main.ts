/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

<<<<<<< HEAD:extensions/sql-assessment/src/main.ts
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
=======
.monaco-editor .blockDecorations-container {
	position: absolute;
	top: 0;
}

.monaco-editor .blockDecorations-block {
	position: absolute;
	box-sizing: border-box;
>>>>>>> 268c941bf0fd8255d4dd7c106c22e9b911772916:src/vs/editor/browser/viewParts/blockDecorations/blockDecorations.css
}
