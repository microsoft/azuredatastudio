/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arc from 'arc';
import * as vscode from 'vscode';
import { UserCancelledError } from './common/utils';
import { IconPathHelper, refreshActionId } from './constants';
import * as loc from './localizedConstants';
import { ConnectToControllerDialog, PasswordToControllerDialog } from './ui/dialogs/connectControllerDialog';
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

	vscode.commands.registerCommand('arc.editConnection', async (treeNode: ControllerTreeNode) => {
		const dialog = new ConnectToControllerDialog(treeDataProvider);
		dialog.showDialog(treeNode.model.info, await treeDataProvider.getPassword(treeNode.model.info));
		const model = await dialog.waitForClose();
		if (model) {
			await treeDataProvider.addOrUpdateController(model.controllerModel, model.password, true);
		}
	});

	await checkArcDeploymentExtension();

	return {
		getRegisteredDataControllers: async () => (await treeDataProvider.getChildren())
			.filter(node => node instanceof ControllerTreeNode)
			.map(node => ({
				label: (node as ControllerTreeNode).model.label,
				info: (node as ControllerTreeNode).model.info
			})),
		getControllerPassword: async (controllerInfo: arc.ControllerInfo) => {
			return await treeDataProvider.getPassword(controllerInfo);
		},
		reacquireControllerPassword: async (controllerInfo: arc.ControllerInfo) => {
			let model;
			const dialog = new PasswordToControllerDialog(treeDataProvider);
			dialog.showDialog(controllerInfo);
			model = await dialog.waitForClose();
			if (!model) {
				throw new UserCancelledError();
			}
			return model.password;
		}
	};
}

export function deactivate(): void {
}

async function checkArcDeploymentExtension(): Promise<void> {
	const version = vscode.extensions.getExtension('Microsoft.arcdeployment')?.packageJSON.version;
	if (version && version !== '0.3.2') {
		// If we have an older version of the deployment extension installed then uninstall it now since it's replaced
		// by this extension. (the latest version of the Arc Deployment extension will uninstall itself so don't do
		// anything here if that's already updated)
		await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'Microsoft.arcdeployment');
		vscode.window.showInformationMessage(loc.arcDeploymentDeprecation);
	}
}
