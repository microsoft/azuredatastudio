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
import { FolderType, NodeType, TelemetryActions, TelemetryViews } from './constants';
import * as localizedConstants from './localizedConstants';
import { UserDialog } from './ui/userDialog';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as constants from '../constants';
import { getNodeTypeDisplayName, refreshParentNode } from './utils';
import { TelemetryReporter } from '../telemetry';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './ui/objectManagementDialogBase';

export function registerObjectManagementCommands(appContext: AppContext) {
	// Notes: Change the second parameter to false to use the actual object management service.
	const service = getObjectManagementService(appContext, false);
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newObject', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
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
}

function getObjectManagementService(appContext: AppContext, useTestService: boolean): IObjectManagementService {
	if (useTestService) {
		return new TestObjectManagementService();
	} else {
		return appContext.getService<IObjectManagementService>(constants.ObjectManagementService);
	}
}

async function handleNewObjectDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	let newObjectType: NodeType;
	switch (context.nodeInfo!.objectType) {
		case FolderType.ServerLevelLogins:
			newObjectType = NodeType.ServerLevelLogin;
			break;
		case FolderType.Users:
			newObjectType = NodeType.User;
			break;
		default:
			throw new Error(`Unsupported folder type: ${context.nodeInfo!.objectType}`);
	}

	try {
		const parentUrn = await getParentUrn(context);
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: true,
			database: context.connectionProfile!.databaseName!,
			objectType: newObjectType,
			objectName: '',
			parentUrn: parentUrn,
			objectExplorerContext: context
		};
		const dialog = getDialog(service, options);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, TelemetryActions.OpenNewObjectDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		await vscode.window.showErrorMessage(localizedConstants.OpenNewObjectDialogError(localizedConstants.LoginTypeDisplayName, getErrorMessage(err)));
	}
}

async function handleObjectPropertiesDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	const nodeTypeDisplayName = getNodeTypeDisplayName(context.nodeInfo!.nodeType);
	try {
		const parentUrn = await getParentUrn(context);
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: false,
			database: context.connectionProfile!.databaseName!,
			objectType: context.nodeInfo.nodeType as NodeType,
			objectName: '',
			parentUrn: parentUrn,
			objectUrn: context.nodeInfo!.metadata!.urn,
			objectExplorerContext: context
		};
		const dialog = getDialog(service, options);
		await dialog.open();
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
		case NodeType.ServerLevelLogin:
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

function getDialog(service: IObjectManagementService, dialogOptions: ObjectManagementDialogOptions): ObjectManagementDialogBase<ObjectManagement.SqlObject, ObjectManagement.ObjectViewInfo<ObjectManagement.SqlObject>> {
	switch (dialogOptions.objectType) {
		case NodeType.ServerLevelLogin:
			return new LoginDialog(service, dialogOptions);
		case NodeType.User:
			return new UserDialog(service, dialogOptions);
		default:
			throw new Error(`Unsupported object type: ${dialogOptions.objectType}`);
	}
}

async function getConnectionUri(context: azdata.ObjectExplorerContext): Promise<string> {
	const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile!.id);
	if (!connectionUri) {
		await vscode.window.showErrorMessage(localizedConstants.FailedToRetrieveConnectionInfoErrorMessage, { modal: true });
	}
	return connectionUri;
}

async function getParentUrn(context: azdata.ObjectExplorerContext): Promise<string> {
	let node = undefined;
	let currentNodePath = context.nodeInfo!.parentNodePath;
	do {
		node = await azdata.objectexplorer.getNode(context.connectionProfile!.id, currentNodePath);
		currentNodePath = node?.parentNodePath;
	} while (node && currentNodePath && !node.metadata?.urn);
	return node?.metadata?.urn;
}
