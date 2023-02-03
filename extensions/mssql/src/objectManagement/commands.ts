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
import { NodeType } from './constants';
import * as localizedConstants from './localizedConstants';
import { UserDialog } from './ui/userDialog';
import { IObjectManagementService } from 'mssql';
import * as constants from '../constants';

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
	// Notes: Change the second parameter to false to use the actual object management service.
	const service = getObjectManagementService(appContext, true);
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newLogin', async (context: azdata.ObjectExplorerContext) => {
		await handleNewLoginDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newUser', async (context: azdata.ObjectExplorerContext) => {
		await handleNewUserDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.objectProperties', async (context: azdata.ObjectExplorerContext) => {
		await handleObjectPropertiesDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.deleteObject', async (context: azdata.ObjectExplorerContext) => {
		await handleDeleteObjectCommand(context, service);
	}));
}

function getObjectManagementService(appContext: AppContext, useTestService: boolean): IObjectManagementService {
	if (useTestService) {
		return new TestObjectManagementService();
	} else {
		return appContext.getService<IObjectManagementService>(constants.ObjectManagementService);
	}
}

async function handleNewLoginDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	try {
		const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
		const dialog = new LoginDialog(service, connectionUri, true);
		await dialog.open();
	}
	catch (err) {
		await vscode.window.showErrorMessage(localizedConstants.OpenNewObjectDialogError(localizedConstants.LoginTypeDisplayName, getErrorMessage(err)));
	}
}

async function handleNewUserDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	try {
		const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
		const dialog = new UserDialog(service, connectionUri, context.connectionProfile.databaseName, true);
		await dialog.open();
	}
	catch (err) {
		await vscode.window.showErrorMessage(localizedConstants.OpenNewObjectDialogError(localizedConstants.UserTypeDisplayName, getErrorMessage(err)));
	}
}

async function handleObjectPropertiesDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const nodeTypeDisplayName = localizedConstants.getNodeTypeDisplayName(context.nodeInfo.nodeType);
	try {
		const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
		let dialog;
		switch (context.nodeInfo.nodeType) {
			case NodeType.Login:
				dialog = new LoginDialog(service, connectionUri, false, context.nodeInfo.label);
				break;
			case NodeType.User:
				dialog = new UserDialog(service, connectionUri, context.connectionProfile.databaseName, false, context.nodeInfo.label);
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
}

async function handleDeleteObjectCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	let additionalConfirmationMessage: string;
	switch (context.nodeInfo.nodeType) {
		case NodeType.Login:
			additionalConfirmationMessage = localizedConstants.DeleteLoginConfirmationText;
			break;
		default:
			break;
	}
	const nodeTypeDisplayName = localizedConstants.getNodeTypeDisplayName(context.nodeInfo.nodeType);
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
					case NodeType.User:
						await service.deleteUser(connectionUri, context.connectionProfile.databaseName, context.nodeInfo.label);
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
			operation.updateStatus(azdata.TaskStatus.Succeeded);
		}
	});
}
