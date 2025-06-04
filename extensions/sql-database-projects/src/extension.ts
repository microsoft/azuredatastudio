/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from './common/constants';
import { getAzdataApi } from './common/utils';
import MainController from './controllers/mainController';
import { SqlDatabaseProjectProvider } from './projectProvider/projectProvider';
import { TelemetryReporter } from './common/telemetry';
import { SqlDatabaseProjectTaskProvider } from './tasks/sqlDatabaseProjectTaskProvider';

let controllers: MainController[] = [];

export function activate(context: vscode.ExtensionContext): Promise<SqlDatabaseProjectProvider> {
	void vscode.commands.executeCommand('setContext', 'azdataAvailable', !!getAzdataApi());

	// Start the main controller
	const mainController = new MainController(context);
	controllers.push(mainController);
	context.subscriptions.push(mainController);
	context.subscriptions.push(TelemetryReporter);

	// Register the Sql project task provider
	const taskProvider = vscode.tasks.registerTaskProvider(constants.sqlProjTaskType, new SqlDatabaseProjectTaskProvider());
	context.subscriptions.push(taskProvider);

	return mainController.activate();
}

export function deactivate(): void {
	for (let controller of controllers) {
		controller.deactivate();
	}
}
