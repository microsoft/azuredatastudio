'use strict';

import * as vscode from 'vscode';

import MainController from './controllers/mainController';
import { AppContext } from './appContext';
import ControllerBase from './controllers/controllerBase';
import { ApiWrapper } from './apiWrapper';

let controllers: ControllerBase[] = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(extensionContext: vscode.ExtensionContext) {
	let appContext = new AppContext(extensionContext, new ApiWrapper());
	let activations: Promise<boolean>[] = [];

	// Start the main controller
	let mainController = new MainController(appContext);
	controllers.push(mainController);
	extensionContext.subscriptions.push(mainController);
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

// this method is called when your extension is deactivated
export function deactivate() {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
