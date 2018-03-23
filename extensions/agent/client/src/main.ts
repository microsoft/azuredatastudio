/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import vscode = require('vscode');
import { MainController } from './mainController';
import { ApiWrapper } from './apiWrapper';
export let controller: MainController;

export function activate(context: vscode.ExtensionContext) {
	let apiWrapper = new ApiWrapper();
	controller = new MainController(context, apiWrapper);
	controller.activate();
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	if (controller) {
		controller.deactivate();
	}
}
