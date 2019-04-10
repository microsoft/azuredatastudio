/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';

import ControllerBase from './controllers/controllerBase';
import MainController from './controllers/mainController';

let controllers: ControllerBase[] = [];

export function activate(context: vscode.ExtensionContext) {
	let activations: Promise<boolean>[] = [];

	// Start the main controller
	let mainController = new MainController(context);
	controllers.push(mainController);
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

export function deactivate() {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
