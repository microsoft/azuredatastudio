/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { LoginDialog } from './ui/loginDialog';
import { TestObjectManagementService } from './objectManagementService';
import { getErrorMessage } from '../utils';
import { getNodeTypeDisplayName, NodeType } from './constants';
import * as localizedConstants from './localizedConstants';
// import * as constants from '../constants';
// import { IObjectManagementService } from 'mssql';

async function refreshParentNode(connectionId: string, nodePath: string): Promise<void> {
	try {
		const node = await azdata.objectexplorer.getNode(connectionId, nodePath);
		const parentNode = await node?.getParent();
		await parentNode?.refresh();
	}
	catch (err) {
		await vscode.window.showErrorMessage(localizedConstants.RefreshObjectExplorerError(getErrorMessage(err)));
	}
}

export function registerObjectManagementCommands(appContext: AppContext) {
	// const service = appContext.getService<IObjectManagementService>(constants.ObjectManagementService);
	const service = new TestObjectManagementService();
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newLogin', async (context: azdata.ObjectExplorerContext) => {
		try {
			const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
			const dialog = new LoginDialog(service, connectionUri, true);
			await dialog.open();
		}
		catch (err) {
			await vscode.window.showErrorMessage(localizedConstants.OpenNewObjectDialogError(localizedConstants.LoginTypeDisplayName, getErrorMessage(err)));
		}
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.deleteObject', async (context: azdata.ObjectExplorerContext) => {
		let additionalConfirmationMessage: string;
		switch (context.nodeInfo.nodeType) {
			case NodeType.Login:
				additionalConfirmationMessage = localizedConstants.DeleteLoginConfirmationText;
				break;
			default:
				break;
		}
		const nodeTypeDisplayName = getNodeTypeDisplayName(context.nodeInfo.nodeType);
		let confirmMessage = localizedConstants.DeleteObjectConfirmationText(nodeTypeDisplayName, context.nodeInfo.label);
		if (additionalConfirmationMessage) {
			confirmMessage = `${additionalConfirmationMessage} ${confirmMessage}`;
		}
		const confirmResult = await vscode.window.showWarningMessage(confirmMessage, { modal: true }, localizedConstants.YesText);
		if (confirmResult !== localizedConstants.YesText) {
			return;
		}
		azdata.tasks.startBackgroundOperation({
			displayName: localizedConstants.DeleteObjectOperationDisplayName(nodeTypeDisplayName, context.nodeInfo.label),
			description: '',
			isCancelable: false,
			operation: async (operation) => {
				try {
					const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
					switch (context.nodeInfo.nodeType) {
						case NodeType.Login:
							await service.deleteLogin(connectionUri, context.nodeInfo.label);
							break;
						default:
							return;
					}
				}
				catch (err) {
					operation.updateStatus(azdata.TaskStatus.Failed, localizedConstants.DeleteObjectError(nodeTypeDisplayName, context.nodeInfo.label, getErrorMessage(err)));
					return;
				}
				await refreshParentNode(context.connectionProfile.id, context.nodeInfo.nodePath);
			}
		});
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newUser', async (context: azdata.ObjectExplorerContext) => {

	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.objectProperties', async (context: azdata.ObjectExplorerContext) => {
		const nodeTypeDisplayName = getNodeTypeDisplayName(context.nodeInfo.nodeType);
		try {
			const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
			let dialog;
			switch (context.nodeInfo.nodeType) {
				case NodeType.Login:
					dialog = new LoginDialog(service, connectionUri, false, context.nodeInfo.label);
					break;
				case NodeType.DatabaseUser:
					break;
				default:
					break;
			}
			if (dialog) {
				await dialog.open();
			}
		}
		catch (err) {
			await vscode.window.showErrorMessage(localizedConstants.OpenObjectPropertiesDialogError(nodeTypeDisplayName, context.nodeInfo.label, getErrorMessage(err)));
		}
	}));
}
