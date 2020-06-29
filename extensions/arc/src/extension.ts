/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from './localizedConstants';
import { IconPathHelper, refreshActionId } from './constants';
import { AzureArcTreeDataProvider } from './ui/tree/azureArcTreeDataProvider';
import { ControllerTreeNode } from './ui/tree/controllerTreeNode';
import { TreeNode } from './ui/tree/treeNode';
import { ConnectToControllerDialog } from './ui/dialogs/connectControllerDialog';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	IconPathHelper.setExtensionContext(context);

	await vscode.commands.executeCommand('setContext', 'arc.loaded', false);

	const treeDataProvider = new AzureArcTreeDataProvider(context);
	vscode.window.registerTreeDataProvider('azureArc', treeDataProvider);

	vscode.commands.registerCommand('arc.createController', async () => {
		await vscode.commands.executeCommand('azdata.resource.deploy', 'arc.control.create', ['arc.control.create']);
	});

	vscode.commands.registerCommand('arc.connectToController', async () => {
		const dialog = new ConnectToControllerDialog(treeDataProvider);
		dialog.showDialog();
		const model = await dialog.waitForClose();
		if (model) {
			await treeDataProvider.addOrUpdateController(model.controllerModel, model.password);
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

	await checkArcDeploymentExtension();
}

export function deactivate(): void {
}

async function checkArcDeploymentExtension(): Promise<void> {
	const version = vscode.extensions.getExtension('Microsoft.arcdeployment')?.packageJSON.version;
	if (version && version !== '0.3.2') {
		// If we have an older verison of the deployment extension installed then uninstall it now since it's replaced
		// by this extension. (the latest version of the Arc Deployment extension will uninstall itself so don't do
		// anything here if that's already updated)
		await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'Microsoft.arcdeployment');
		vscode.window.showInformationMessage(loc.arcDeploymentDeprecation);
	}
}
