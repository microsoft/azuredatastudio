/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arc from 'arc';
import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { arcApi } from './common/api';
import { IconPathHelper, refreshActionId } from './constants';
import * as loc from './localizedConstants';
import { ArcControllersOptionsSourceProvider } from './providers/arcControllersOptionsSourceProvider';
import { ConnectToControllerDialog } from './ui/dialogs/connectControllerDialog';
import { AzureArcTreeDataProvider } from './ui/tree/azureArcTreeDataProvider';
import { ControllerTreeNode } from './ui/tree/controllerTreeNode';
import { TreeNode } from './ui/tree/treeNode';

export async function activate(context: vscode.ExtensionContext): Promise<arc.IExtension> {
	IconPathHelper.setExtensionContext(context);

	await vscode.commands.executeCommand('setContext', 'arc.loaded', false);

	const treeDataProvider = new AzureArcTreeDataProvider(context);
	vscode.window.registerTreeDataProvider('azureArc', treeDataProvider);

	vscode.commands.registerCommand('arc.createController', async () => {
		await vscode.commands.executeCommand('azdata.resource.deploy', 'arc.control.create', ['arc.control.create']);
	});

	vscode.commands.registerCommand('arc.connectToController', async () => {
		const nodes = await treeDataProvider.getChildren();
		if (nodes.length > 0) {
			const response = await vscode.window.showErrorMessage(loc.onlyOneControllerSupported, loc.yes, loc.no);
			if (response !== loc.yes) {
				return;
			}
			await treeDataProvider.removeController(nodes[0] as ControllerTreeNode);
		}
		const dialog = new ConnectToControllerDialog(treeDataProvider);
		dialog.showDialog();
		try {
			const model = await dialog.waitForClose();
			await treeDataProvider.addOrUpdateController(model.controllerModel, model.password);
		} catch (err) {
			console.log(`Error connecting to Controller dashboard ${err}`);
		}
	});

	vscode.commands.registerCommand('arc.removeController', async (controllerNode: ControllerTreeNode) => {
		await treeDataProvider.removeController(controllerNode);
	});

	vscode.commands.registerCommand(refreshActionId, async (treeNode: TreeNode) => {
		treeDataProvider.refreshNode(treeNode);
	});

	vscode.commands.registerCommand('arc.openDashboard', async (treeNode: TreeNode) => {
		await treeNode.openDashboard().catch(err => vscode.window.showErrorMessage(loc.openDashboardFailed(err)));
	});

	vscode.commands.registerCommand('arc.editConnection', async (treeNode: ControllerTreeNode) => {
		const dialog = new ConnectToControllerDialog(treeDataProvider);
		dialog.showDialog(treeNode.model.info, await treeDataProvider.getPassword(treeNode.model.info));
		try {
			const model = await dialog.waitForClose();
			await treeDataProvider.addOrUpdateController(model.controllerModel, model.password, true);
		} catch (err) {
			console.log(`Error connecting to Controller dashboard ${err}`);
		}
	});

	// register option sources
	const rdApi = <rd.IExtension>vscode.extensions.getExtension(rd.extension.name)?.exports;
	rdApi.registerOptionsSourceProvider(new ArcControllersOptionsSourceProvider(treeDataProvider));

	return arcApi(treeDataProvider);
}

export function deactivate(): void {
}
