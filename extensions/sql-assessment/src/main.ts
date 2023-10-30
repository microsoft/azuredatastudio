/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import MainController from './maincontroller';
import { TelemetryReporter } from './telemetry';

let mainController: MainController;

export async function activate(context: vscode.ExtensionContext) {
	mainController = new MainController(context);
	await mainController.activate();
	context.subscriptions.push(TelemetryReporter);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	mainController?.deactivate();
}
