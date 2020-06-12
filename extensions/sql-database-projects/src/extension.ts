/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import MainController from './controllers/mainController';
import { ApiWrapper } from './common/apiWrapper';

let controllers: MainController[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Start the main controller
	const mainController = new MainController(context, new ApiWrapper());
	controllers.push(mainController);
	context.subscriptions.push(mainController);

	console.log(`Sql-database-projects activate start time:${new Date().getTime()}`);
	await mainController.activate();
	console.log(`Sql-database-projects activate end time:${new Date().getTime()}`);
}

export function deactivate(): void {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
