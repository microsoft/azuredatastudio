/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { LoginDialog } from './ui/loginDialog';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import { TestObjectManagementService } from './objectManagementService';
import { getErrorMessage } from '../utils';
import { YesText } from './localizedConstants';
// import * as constants from '../constants';
// import { IObjectManagementService } from 'mssql';

enum ObjectType {
	Login = 'ServerLevelLogin',
	DatabaseUser = 'DatabaseUser'
}

async function refreshParentNode(connectionId: string, nodePath: string): Promise<void> {
	try {
		const node = await azdata.objectexplorer.getNode(connectionId, nodePath);
		const parentNode = await node?.getParent();
		await parentNode?.refresh();
	}
	catch (err) {
		await vscode.window.showErrorMessage(localize('mssql.refreshOEError', "An error occurred while trying to refresh the object explorer. {0}", getErrorMessage(err)));
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
			await vscode.window.showErrorMessage(localize('loginDialog.new.ErrorOpenDialog', "An error occurred while trying to the new login dialog. {0}", getErrorMessage(err)));
		}
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.deleteObject', async (context: azdata.ObjectExplorerContext) => {
		let additionalConfirmationMessage: string;
		switch (context.nodeInfo.nodeType) {
			case ObjectType.Login:
				additionalConfirmationMessage = localize('mssql.deleteLoginConfirmation', "Deleting server logins does not delete the database users associated with the logins. To complete the process, delete the users in each database. It may be necessary to first transfer the ownership of schemas to new users.");
				break;
			default:
				break;
		}
		let confirmMessage = localize('mssql.deleteObjectConfirmation', "Are you sure you want to delete the object?");
		if (additionalConfirmationMessage) {
			confirmMessage = `${additionalConfirmationMessage} ${confirmMessage}`;
		}
		const confirmResult = await vscode.window.showWarningMessage(confirmMessage, { modal: true }, YesText);
		if (confirmResult !== YesText) {
			return;
		}
		await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: localize('mssql.deletingObject', "Deleting object: {0}", context.nodeInfo.label) }, async () => {
			try {
				const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
				switch (context.nodeInfo.nodeType) {
					case ObjectType.Login:
						await service.deleteLogin(connectionUri, context.nodeInfo.label);
						break;
					default:
						return;
				}
			}
			catch (err) {
				await vscode.window.showErrorMessage(localize('mssql.deleteObjectError', "An error occurred while trying to delete the object: {0}.", context.nodeInfo.label));
				return;
			}
			await refreshParentNode(context.connectionProfile.id, context.nodeInfo.nodePath);
		});
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newUser', async (context: azdata.ObjectExplorerContext) => {

	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.objectProperties', async (context: azdata.ObjectExplorerContext) => {
		try {
			const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
			let dialog;
			switch (context.nodeInfo.nodeType) {
				case ObjectType.Login:
					dialog = new LoginDialog(service, connectionUri, false, context.nodeInfo.label);
					break;
				case ObjectType.DatabaseUser:
					break;
				default:
					break;
			}
			if (dialog) {
				await dialog.open();
			}
		}
		catch (err) {
			await vscode.window.showErrorMessage(localize('loginDialog.edit.ErroOpenDialog', "An error occurred while trying to open the properties dialog. {0}", getErrorMessage(err)));
		}
	}));
}
