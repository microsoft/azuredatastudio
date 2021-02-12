/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import MainController from './controllers/mainController';
import { IProjectProvider } from 'dataworkspace';

let controllers: MainController[] = [];

export function activate(context: vscode.ExtensionContext): Promise<IProjectProvider> {
	// Start the main controller
	const mainController = new MainController(context);
	controllers.push(mainController);
	context.subscriptions.push(mainController);

	return mainController.activate();
}

export function deactivate(): void {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
