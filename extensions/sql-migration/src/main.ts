/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MainController } from './controllers/mainController';
import { Controller } from './models/controller';

let controllers: Controller[] = [];

export async function activate(context: vscode.ExtensionContext) {
	let mainController = new MainController(context);
	controllers.push(mainController);

	await mainController.activate();

	// Push all the disposable controllers to the context
	controllers.forEach(c => context.subscriptions.push(c));
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	controllers.forEach(c => c.deactivate());
}
