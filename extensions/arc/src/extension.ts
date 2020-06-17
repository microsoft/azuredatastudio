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

		try {
			const controllerModel = new ControllerModel(controllerUrl, auth);
			const postgresModel = new PostgresModel(controllerUrl, auth, dbNamespace, dbName);
			const postgresDashboard = new PostgresDashboard(loc.postgresDashboard, context, controllerModel, postgresModel);

			await Promise.all([
				postgresDashboard.showDashboard(),
				controllerModel.refresh(),
				postgresModel.refresh()
			]);
		} catch (error) {
			vscode.window.showErrorMessage(loc.failedToManagePostgres(`${dbNamespace}.${dbName}`, error));
		}
	});
}

export function deactivate(): void {
}
