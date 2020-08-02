/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import MainController from './controllers/mainController';

let controllers: MainController[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Start the main controller
	const mainController = new MainController(context);
	controllers.push(mainController);
	context.subscriptions.push(mainController);

	await mainController.activate();
}

export function deactivate(): void {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
