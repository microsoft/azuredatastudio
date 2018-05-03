/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

import MainController from './controllers/mainController';

let mainController: MainController;

export function activate(context: vscode.ExtensionContext): Promise<boolean> {
	let activations: Promise<boolean>[] = [];

	// Start the main controller
	mainController = new MainController(context);
	context.subscriptions.push(mainController);
	activations.push(mainController.activate());

	return Promise.all(activations)
		.then((results: boolean[]) => {
			for (let result of results) {
				if (!result) {
					return false;
				}
			}
			return true;
		});
}

export function deactivate(): void {
	if (mainController) {
		mainController.deactivate();
	}
}
