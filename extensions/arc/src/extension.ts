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
import { ControllerDashboard } from './ui/dashboards/controller/controllerDashboard';
import { MiaaDashboard } from './ui/dashboards/miaa/miaaDashboard';
import { MiaaModel } from './models/miaaModel';
import { AzureArcTreeDataProvider } from './ui/tree/controllerTreeDataProvider';
import { ControllerTreeNode } from './ui/tree/controllerTreeNode';
import { TreeNode } from './ui/tree/treeNode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	IconPathHelper.setExtensionContext(context);

	const treeDataProvider = new AzureArcTreeDataProvider(context);
	vscode.window.registerTreeDataProvider('azureArc', treeDataProvider);

	vscode.commands.registerCommand('arc.addController', () => {
		// Controller information
		const controllerUrl = '';
		const auth = new BasicAuth('', '');

		const controllerModel = new ControllerModel(controllerUrl, auth);
		treeDataProvider.addController(controllerModel);
	});

	vscode.commands.registerCommand('arc.removeController', (controllerNode: ControllerTreeNode) => {
		treeDataProvider.removeController(controllerNode);
	});

	vscode.commands.registerCommand('arc.openDashboard', async (treeNode: TreeNode) => {
		await treeNode.openDashboard().catch(err => vscode.window.showErrorMessage(loc.openDashboardFailed(err)));
	});

	vscode.commands.registerCommand('arc.manageArcController', async () => {
		// Controller information
		const controllerUrl = '';
		const auth = new BasicAuth('', '');

		try {
			const controllerModel = new ControllerModel(controllerUrl, auth);
			const controllerDashboard = new ControllerDashboard(controllerModel);

			await Promise.all([
				controllerDashboard.showDashboard(),
				controllerModel.refresh()
			]);
		} catch (error) {
			// vscode.window.showErrorMessage(loc.failedToManagePostgres(`${dbNamespace}.${dbName}`, error));
		}
	});

	vscode.commands.registerCommand('arc.manageMiaa', async () => {
		// Controller information
		const controllerUrl = '';
		const auth = new BasicAuth('', '');
		const instanceNamespace = '';
		const instanceName = '';

		try {
			const controllerModel = new ControllerModel(controllerUrl, auth);
			const miaaModel = new MiaaModel(controllerUrl, auth, instanceNamespace, instanceName);
			const miaaDashboard = new MiaaDashboard(controllerModel, miaaModel);

			await Promise.all([
				miaaDashboard.showDashboard(),
				controllerModel.refresh()
			]);
		} catch (error) {
			// vscode.window.showErrorMessage(loc.failedToManagePostgres(`${dbNamespace}.${dbName}`, error));
		}
	});

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
			const postgresDashboard = new PostgresDashboard(context, controllerModel, postgresModel);

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
