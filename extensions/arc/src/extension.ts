/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { IconPathHelper } from './constants';
import { BasicAuth } from './controller/auth';
import { PostgresDashboard } from './postgresDashboard';
import { ControllerModel } from './models/controllerModel';
import { DatabaseModel } from './models/databaseModel';

// Controller information
let controllerUrl: string;
let auth: BasicAuth;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	controllerUrl = 'https://0.0.0.0:30080';
	auth = new BasicAuth('username', 'password');

	const dbNamespace = 'default';
	const dbName = 'my-postgres2';

	IconPathHelper.setExtensionContext(context);

	const controllerModel = new ControllerModel(controllerUrl, auth);
	const databaseModel = new DatabaseModel(controllerUrl, auth, dbNamespace, dbName);
	const postgresDashboard = new PostgresDashboard(controllerModel, databaseModel);

	const dashboard: azdata.window.ModelViewDashboard = azdata.window.createModelViewDashboard('Azure Arc - Postgres');
	dashboard.registerTabs(async (view: azdata.ModelView) => {
		try { return await postgresDashboard.dashboard(view); }
		catch (error) {
			vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
			throw error;
		}
	});
	return await dashboard.open();
}

export function deactivate(): void {
}
