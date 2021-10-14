/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arc from 'arc';
import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { InputValueType } from '../../resource-deployment/src/ui/modelViewUtils';
import { arcApi } from './common/api';
import { IconPathHelper, refreshActionId } from './constants';
import * as loc from './localizedConstants';
import { ArcControllersOptionsSourceProvider } from './providers/arcControllersOptionsSourceProvider';
import { ConnectToControllerDialog } from './ui/dialogs/connectControllerDialog';
import { AzureArcTreeDataProvider } from './ui/tree/azureArcTreeDataProvider';
import { ControllerTreeNode } from './ui/tree/controllerTreeNode';
import { TreeNode } from './ui/tree/treeNode';
import * as pricing from './common/pricingUtils';

export async function activate(context: vscode.ExtensionContext): Promise<arc.IExtension> {
	IconPathHelper.setExtensionContext(context);

	await vscode.commands.executeCommand('setContext', 'arc.loaded', false);

	const treeDataProvider = new AzureArcTreeDataProvider(context);
	vscode.window.registerTreeDataProvider('azureArc', treeDataProvider);

	vscode.commands.registerCommand('arc.createController', async () => {
		await vscode.commands.executeCommand('azdata.resource.deploy', 'arc-controller', ['arc-controller']);
	});

	vscode.commands.registerCommand('arc.connectToController', async () => {
		const dialog = new ConnectToControllerDialog(treeDataProvider);
		dialog.showDialog();
		const model = await dialog.waitForClose();
		if (model) {
			await treeDataProvider.addOrUpdateController(model.controllerModel);
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
		dialog.showDialog(treeNode.model.info);
		const model = await dialog.waitForClose();
		if (model) {
			await treeDataProvider.addOrUpdateController(model.controllerModel, true);
		}
	});

	// register option sources
	const rdApi = <rd.IExtension>vscode.extensions.getExtension(rd.extension.name)?.exports;
	context.subscriptions.push(rdApi.registerOptionsSourceProvider(new ArcControllersOptionsSourceProvider(treeDataProvider)));
	context.subscriptions.push(rdApi.registerValueProvider({
		id: 'params-to-estimated-cost',
		getValue: async (mapping: string | { [key: string]: InputValueType }) => {
			// cast it to an object right away (may need to do same for the string one)

			// Mapping looks like:
			// { "AZDATA_NB_VAR_SERVICE_TIER": "General Purpose",
			//   "AZDATA_NB_VAR_DEV_USE_ONLY": true
			// }
			// pricing.total();

			// use try catch, if wrong return error
			return '$999.00'; // try this for now
		}
	}));

	return arcApi(treeDataProvider);
}

export function deactivate(): void {
}
