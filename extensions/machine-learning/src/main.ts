/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import MainController from './controllers/mainController';
import { ApiWrapper } from './common/apiWrapper';
import { QueryRunner } from './common/queryRunner';
import { ProcessService } from './common/processService';

let controllers: MainController[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {

	let apiWrapper = new ApiWrapper();
	let queryRunner = new QueryRunner(apiWrapper);
	let processService = new ProcessService();

	// Start the main controller
	//
	let mainController = new MainController(context, apiWrapper, queryRunner, processService);
	controllers.push(mainController);
	context.subscriptions.push(mainController);

	await mainController.activate();
}

export function deactivate(): void {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
