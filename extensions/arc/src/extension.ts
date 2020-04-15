/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from './localizedConstants';
import { IconPathHelper } from './constants';
import { BasicAuth } from './controller/auth';
import { PostgresDashboard } from './ui/dashboards/postgres/postgresDashboard';
import { ControllerModel } from './models/controllerModel';
import { PostgresModel } from './models/postgresModel';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	IconPathHelper.setExtensionContext(context);

	vscode.commands.registerCommand('arc.managePostgres', async () => {
		// Controller information
		const controllerUrl = 'https://0.0.0.0:30080';
		const auth = new BasicAuth('username', 'password');

		// Postgres database information
		const dbNamespace = 'default';
		const dbName = 'my-postgres2';

		const controllerModel = new ControllerModel(controllerUrl, auth);
		const databaseModel = new PostgresModel(controllerUrl, auth, dbNamespace, dbName);
		const postgresDashboard = new PostgresDashboard(loc.postgresDashboard, controllerModel, databaseModel);

		try { await postgresDashboard.showDashboard(); }
		catch (error) {
			vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
			throw error;
		}
	});
}

export function deactivate(): void {
}
