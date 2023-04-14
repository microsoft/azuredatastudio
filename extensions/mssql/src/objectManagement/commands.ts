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
import { NodeType, TelemetryActions, TelemetryViews } from './constants';
import * as localizedConstants from './localizedConstants';
import { UserDialog } from './ui/userDialog';
import { IObjectManagementService } from 'mssql';
import * as constants from '../constants';
import { getNodeTypeDisplayName, refreshParentNode } from './utils';
import { TelemetryReporter } from '../telemetry';

export function registerObjectManagementCommands(appContext: AppContext) {
	// Notes: Change the second parameter to false to use the actual object management service.
	const service = getObjectManagementService(appContext, false);
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
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.renameObject', async (context: azdata.ObjectExplorerContext) => {
		await handleRenameObjectCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.createDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleCreateDatabaseDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.deleteDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleDeleteDatabaseDialogCommand(context, service);
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
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}

	try {
		const dialog = new LoginDialog(service, connectionUri, true, undefined, context);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, TelemetryActions.OpenNewObjectDialog, err).withAdditionalProperties({
			objectType: NodeType.Login
		}).send();
		await vscode.window.showErrorMessage(localizedConstants.OpenNewObjectDialogError(localizedConstants.LoginTypeDisplayName, getErrorMessage(err)));
	}
}

async function handleNewUserDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	try {
		const dialog = new UserDialog(service, connectionUri, context.connectionProfile!.databaseName!, true, undefined, context);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, TelemetryActions.OpenNewObjectDialog, err).withAdditionalProperties({
			objectType: NodeType.User
		}).send();
		await vscode.window.showErrorMessage(localizedConstants.OpenNewObjectDialogError(localizedConstants.UserTypeDisplayName, getErrorMessage(err)));
	}
}

async function handleObjectPropertiesDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	const nodeTypeDisplayName = getNodeTypeDisplayName(context.nodeInfo!.nodeType);
	try {
		let dialog;
		switch (context.nodeInfo!.nodeType) {
			case NodeType.Login:
				dialog = new LoginDialog(service, connectionUri, false, context.nodeInfo!.label);
				break;
			case NodeType.User:
				dialog = new UserDialog(service, connectionUri, context.connectionProfile!.databaseName!, false, context.nodeInfo!.label);
				break;
			default:
				break;
		}
		if (dialog) {
			await dialog.open();
		}
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, TelemetryActions.OpenPropertiesDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		await vscode.window.showErrorMessage(localizedConstants.OpenObjectPropertiesDialogError(nodeTypeDisplayName, context.nodeInfo!.label, getErrorMessage(err)));
	}
}

async function handleDeleteObjectCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	let additionalConfirmationMessage: string | undefined = undefined;
	switch (context.nodeInfo!.nodeType) {
		case NodeType.Login:
			additionalConfirmationMessage = localizedConstants.DeleteLoginConfirmationText;
			break;
		default:
			break;
	}
	const nodeTypeDisplayName = getNodeTypeDisplayName(context.nodeInfo!.nodeType);
	let confirmMessage = localizedConstants.DeleteObjectConfirmationText(nodeTypeDisplayName, context.nodeInfo!.label);
	if (additionalConfirmationMessage) {
		confirmMessage = `${additionalConfirmationMessage} ${confirmMessage}`;
	}
	const confirmResult = await vscode.window.showWarningMessage(confirmMessage, { modal: true }, localizedConstants.YesText);
	if (confirmResult !== localizedConstants.YesText) {
		return;
	}
	azdata.tasks.startBackgroundOperation({
		displayName: localizedConstants.DeleteObjectOperationDisplayName(nodeTypeDisplayName, context.nodeInfo!.label),
		description: '',
		isCancelable: false,
		operation: async (operation) => {
			try {
				const startTime = Date.now();
				await service.drop(connectionUri, context.nodeInfo!.metadata!.urn);
				TelemetryReporter.sendTelemetryEvent(TelemetryActions.DeleteObject, {
					objectType: context.nodeInfo!.nodeType
				}, {
					elapsedTimeMs: Date.now() - startTime
				});
			}
			catch (err) {
				operation.updateStatus(azdata.TaskStatus.Failed, localizedConstants.DeleteObjectError(nodeTypeDisplayName, context.nodeInfo!.label, getErrorMessage(err)));
				TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, TelemetryActions.DeleteObject, err).withAdditionalProperties({
					objectType: context.nodeInfo!.nodeType
				}).send();
				return;
			}
			operation.updateStatus(azdata.TaskStatus.Succeeded);
			await refreshParentNode(context);
		}
	});
}

async function handleRenameObjectCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	const nodeTypeDisplayName = getNodeTypeDisplayName(context.nodeInfo!.nodeType);
	const originalName = context.nodeInfo!.metadata!.name;
	const newName = await vscode.window.showInputBox({
		title: localizedConstants.RenameObjectDialogTitle,
		value: originalName,
		validateInput: (value: string): string | undefined => {
			if (!value) {
				return localizedConstants.NameCannotBeEmptyError;
			} else {
				// valid
				return undefined;
			}
		}
	});

	// return if no change was made or the dialog was canceled.
	if (newName === originalName || !newName) {
		return;
	}

	azdata.tasks.startBackgroundOperation({
		displayName: localizedConstants.RenameObjectOperationDisplayName(nodeTypeDisplayName, originalName, newName),
		description: '',
		isCancelable: false,
		operation: async (operation) => {
			try {
				const startTime = Date.now();
				await service.rename(connectionUri, context.nodeInfo!.metadata!.urn, newName);
				TelemetryReporter.sendTelemetryEvent(TelemetryActions.RenameObject, {
					objectType: context.nodeInfo!.nodeType
				}, {
					elapsedTimeMs: Date.now() - startTime
				});
			}
			catch (err) {
				operation.updateStatus(azdata.TaskStatus.Failed, localizedConstants.RenameObjectError(nodeTypeDisplayName, originalName, newName, getErrorMessage(err)));
				TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, TelemetryActions.RenameObject, err).withAdditionalProperties({
					objectType: context.nodeInfo!.nodeType
				}).send();
				return;
			}
			operation.updateStatus(azdata.TaskStatus.Succeeded);
			await refreshParentNode(context);
		}
	});
}

async function getConnectionUri(context: azdata.ObjectExplorerContext): Promise<string> {
	const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile!.id);
	if (!connectionUri) {
		await vscode.window.showErrorMessage(localizedConstants.FailedToRetrieveConnectionInfoErrorMessage, { modal: true });
	}
	return connectionUri;
}

async function handleCreateDatabaseDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}

	try {
		const dialog = new CreateDatabaseDialog(service, connectionUri, context);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(TelemetryViews.Admin, TelemetryActions.CreateDatabaseDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		await vscode.window.showErrorMessage(localizedConstants.OpenCreateDatabaseDialogError(getErrorMessage(err)));
	}
}

async function handleDeleteDatabaseDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}

	try {
		const dialog = new DeleteDatabaseDialog(service, connectionUri, context);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(TelemetryViews.Admin, TelemetryActions.DeleteDatabaseDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		await vscode.window.showErrorMessage(localizedConstants.OpenDeleteDatabaseDialogError(getErrorMessage(err)));
	}
}
