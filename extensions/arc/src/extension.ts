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
		const controllerUrl = '';
		const auth = new BasicAuth('', '');

		// Postgres information
		const dbNamespace = '';
		const dbName = '';

		const controllerModel = new ControllerModel(controllerUrl, auth);
		const databaseModel = new PostgresModel(controllerUrl, auth, dbNamespace, dbName);
		const postgresDashboard = new PostgresDashboard(loc.postgresDashboard, controllerModel, databaseModel);
		await postgresDashboard.showDashboard();
	});
}

export function deactivate(): void {
}
