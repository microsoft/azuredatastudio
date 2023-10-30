/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import ControllerBase from './controllers/controllerBase';
import MainController from './controllers/mainController';
import { TelemetryReporter } from './services/telemetry';

let controllers: ControllerBase[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {

	// Start the main controller
	let mainController = new MainController(context);
	controllers.push(mainController);
	context.subscriptions.push(mainController);

	await mainController.activate();
	context.subscriptions.push(TelemetryReporter);
}

export function deactivate() {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
