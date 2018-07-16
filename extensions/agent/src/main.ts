/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import vscode = require('vscode');
import { MainController } from './mainController';
export let controller: MainController;

export function activate(context: vscode.ExtensionContext) {
	controller = new MainController(context);
	controller.activate();
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	if (controller) {
		controller.deactivate();
	}
}
