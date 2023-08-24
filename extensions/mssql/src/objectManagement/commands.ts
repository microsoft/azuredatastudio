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
import { FolderType, TelemetryActions, ObjectManagementViewName } from './constants';
import * as objectManagementLoc from './localizedConstants';
import * as uiLoc from '../ui/localizedConstants';
import { UserDialog } from './ui/userDialog';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as constants from '../constants';
import { refreshParentNode, escapeSingleQuotes } from './utils';
import { TelemetryReporter } from '../telemetry';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './ui/objectManagementDialogBase';
import { ServerRoleDialog } from './ui/serverRoleDialog';
import { DatabaseRoleDialog } from './ui/databaseRoleDialog';
import { ApplicationRoleDialog } from './ui/applicationRoleDialog';
import { DatabaseDialog } from './ui/databaseDialog';
import { ServerPropertiesDialog } from './ui/serverPropertiesDialog';
import { DetachDatabaseDialog } from './ui/detachDatabaseDialog';
import { DropDatabaseDialog as DropDatabaseDialog } from './ui/dropDatabaseDialog';

export function registerObjectManagementCommands(appContext: AppContext) {
	// Notes: Change the second parameter to false to use the actual object management service.
	const service = getObjectManagementService(appContext, false);
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newObject', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.objectProperties', async (context: azdata.ObjectExplorerContext) => {
		await handleObjectPropertiesDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.dropObject', async (context: azdata.ObjectExplorerContext) => {
		await handleDropObjectCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.renameObject', async (context: azdata.ObjectExplorerContext) => {
		await handleRenameObjectCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.detachDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleDetachDatabase(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.dropDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleDropDatabase(context, service);
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
	let objectType: ObjectManagement.NodeType;
	switch (context.nodeInfo!.objectType) {
		case FolderType.ApplicationRoles:
			objectType = ObjectManagement.NodeType.ApplicationRole;
			break;
		case FolderType.DatabaseRoles:
			objectType = ObjectManagement.NodeType.DatabaseRole;
			break;
		case FolderType.ServerLevelLogins:
			objectType = ObjectManagement.NodeType.ServerLevelLogin;
			break;
		case FolderType.ServerLevelServerRoles:
			objectType = ObjectManagement.NodeType.ServerLevelServerRole;
			break;
		case FolderType.Users:
			objectType = ObjectManagement.NodeType.User;
			break;
		case FolderType.Databases:
			objectType = ObjectManagement.NodeType.Database;
			break;
	}
	// Fall back to node type in case the user right clicked on an object instead of a folder
	if (!objectType) {
		switch (context.nodeInfo!.nodeType) {
			case ObjectManagement.NodeType.ApplicationRole:
			case ObjectManagement.NodeType.DatabaseRole:
			case ObjectManagement.NodeType.ServerLevelLogin:
			case ObjectManagement.NodeType.ServerLevelServerRole:
			case ObjectManagement.NodeType.User:
			case ObjectManagement.NodeType.Database:
				objectType = context.nodeInfo!.nodeType as ObjectManagement.NodeType;
				break;
			default:
				throw new Error(objectManagementLoc.NoDialogFoundError(context.nodeInfo!.nodeType, context.nodeInfo!.objectType));
		}
	}

	try {
		const parentUrn = await getParentUrn(context);
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: true,
			database: context.connectionProfile!.databaseName!,
			objectType: objectType,
			objectName: '',
			parentUrn: parentUrn,
			objectExplorerContext: context
		};
		const dialog = getDialog(service, options);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenNewObjectDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenNewObjectDialogError(objectManagementLoc.getNodeTypeDisplayName(objectType), getErrorMessage(err)));
	}
}

async function handleObjectPropertiesDialogCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	try {
		const parentUrn = context.isConnectionNode ? undefined : await getParentUrn(context);
		const objectType = context.nodeInfo ? context.nodeInfo.nodeType as ObjectManagement.NodeType : (context.connectionProfile.databaseName === '' ? ObjectManagement.NodeType.Server : ObjectManagement.NodeType.Database);
		const objectName = context.nodeInfo ? context.nodeInfo.label : (!context.connectionProfile.databaseName ? context.connectionProfile.serverName : context.connectionProfile.databaseName);
		const objectUrn = context.nodeInfo ? context.nodeInfo!.metadata!.urn : (context.connectionProfile.databaseName === '' ? 'Server' : `Server/Database[@Name='${escapeSingleQuotes(context.connectionProfile.databaseName)}']`);

		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: false,
			database: context.connectionProfile!.databaseName!,
			objectType: objectType,
			objectName: objectName,
			parentUrn: parentUrn,
			objectUrn: objectUrn,
			objectExplorerContext: context
		};
		const dialog = getDialog(service, options);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenPropertiesDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenObjectPropertiesDialogError(objectManagementLoc.getNodeTypeDisplayName(context.nodeInfo!.nodeType), context.nodeInfo!.label, getErrorMessage(err)));
	}
}

async function handleDropObjectCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	let additionalConfirmationMessage: string | undefined = undefined;
	switch (context.nodeInfo!.nodeType) {
		case ObjectManagement.NodeType.ServerLevelLogin:
			additionalConfirmationMessage = objectManagementLoc.DropLoginConfirmationText;
			break;
		default:
			break;
	}
	const nodeTypeDisplayName = objectManagementLoc.getNodeTypeDisplayName(context.nodeInfo!.nodeType);
	let confirmMessage = objectManagementLoc.DropObjectConfirmationText(nodeTypeDisplayName, context.nodeInfo!.label);
	if (additionalConfirmationMessage) {
		confirmMessage = `${additionalConfirmationMessage} ${confirmMessage}`;
	}
	const confirmResult = await vscode.window.showWarningMessage(confirmMessage, { modal: true }, uiLoc.YesText);
	if (confirmResult !== uiLoc.YesText) {
		return;
	}
	azdata.tasks.startBackgroundOperation({
		displayName: objectManagementLoc.DropObjectOperationDisplayName(nodeTypeDisplayName, context.nodeInfo!.label),
		description: '',
		isCancelable: false,
		operation: async (operation) => {
			try {
				const startTime = Date.now();
				await service.drop(connectionUri, context.nodeInfo.nodeType as ObjectManagement.NodeType, context.nodeInfo!.metadata!.urn);
				TelemetryReporter.sendTelemetryEvent(TelemetryActions.DropObject, {
					objectType: context.nodeInfo!.nodeType
				}, {
					elapsedTimeMs: Date.now() - startTime
				});
			}
			catch (err) {
				operation.updateStatus(azdata.TaskStatus.Failed, objectManagementLoc.DropObjectError(nodeTypeDisplayName, context.nodeInfo!.label, getErrorMessage(err)));
				TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.DropObject, err).withAdditionalProperties({
					objectType: context.nodeInfo!.nodeType
				}).send();
				console.error(err);
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
	const nodeTypeDisplayName = objectManagementLoc.getNodeTypeDisplayName(context.nodeInfo!.nodeType);
	const originalName = context.nodeInfo!.metadata!.name;
	const newName = await vscode.window.showInputBox({
		title: objectManagementLoc.RenameObjectDialogTitle,
		value: originalName,
		validateInput: (value: string): string | undefined => {
			if (!value) {
				return objectManagementLoc.NameCannotBeEmptyError;
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
		displayName: objectManagementLoc.RenameObjectOperationDisplayName(nodeTypeDisplayName, originalName, newName),
		description: '',
		isCancelable: false,
		operation: async (operation) => {
			try {
				const startTime = Date.now();
				await service.rename(connectionUri, context.nodeInfo.nodeType as ObjectManagement.NodeType, context.nodeInfo!.metadata!.urn, newName);
				TelemetryReporter.sendTelemetryEvent(TelemetryActions.RenameObject, {
					objectType: context.nodeInfo!.nodeType
				}, {
					elapsedTimeMs: Date.now() - startTime
				});
			}
			catch (err) {
				operation.updateStatus(azdata.TaskStatus.Failed, objectManagementLoc.RenameObjectError(nodeTypeDisplayName, originalName, newName, getErrorMessage(err)));
				TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.RenameObject, err).withAdditionalProperties({
					objectType: context.nodeInfo!.nodeType
				}).send();
				console.error(err);
				return;
			}
			operation.updateStatus(azdata.TaskStatus.Succeeded);
			await refreshParentNode(context);
		}
	});
}

async function handleDetachDatabase(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	try {
		const parentUrn = await getParentUrn(context);
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: false,
			database: context.connectionProfile!.databaseName!,
			objectType: context.nodeInfo.nodeType as ObjectManagement.NodeType,
			objectName: context.nodeInfo.label,
			parentUrn: parentUrn,
			objectUrn: context.nodeInfo!.metadata!.urn,
			objectExplorerContext: context
		};
		const dialog = new DetachDatabaseDialog(service, options);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenDetachDatabaseDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenDetachDatabaseDialogError(getErrorMessage(err)));
	}
}

async function handleDropDatabase(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	try {
		const parentUrn = await getParentUrn(context);
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: false,
			database: context.connectionProfile!.databaseName!,
			objectType: context.nodeInfo.nodeType as ObjectManagement.NodeType,
			objectName: context.nodeInfo.label,
			parentUrn: parentUrn,
			objectUrn: context.nodeInfo!.metadata!.urn,
			objectExplorerContext: context
		};
		const dialog = new DropDatabaseDialog(service, options);
		await dialog.open();
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenDropDatabaseDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenDropDatabaseDialogError(getErrorMessage(err)));
	}
}

function getDialog(service: IObjectManagementService, dialogOptions: ObjectManagementDialogOptions): ObjectManagementDialogBase<ObjectManagement.SqlObject, ObjectManagement.ObjectViewInfo<ObjectManagement.SqlObject>> {
	switch (dialogOptions.objectType) {
		case ObjectManagement.NodeType.ApplicationRole:
			return new ApplicationRoleDialog(service, dialogOptions);
		case ObjectManagement.NodeType.DatabaseRole:
			return new DatabaseRoleDialog(service, dialogOptions);
		case ObjectManagement.NodeType.ServerLevelLogin:
			return new LoginDialog(service, dialogOptions);
		case ObjectManagement.NodeType.ServerLevelServerRole:
			return new ServerRoleDialog(service, dialogOptions);
		case ObjectManagement.NodeType.Server:
			return new ServerPropertiesDialog(service, dialogOptions);
		case ObjectManagement.NodeType.User:
			return new UserDialog(service, dialogOptions);
		case ObjectManagement.NodeType.Database:
			return new DatabaseDialog(service, dialogOptions);
		default:
			throw new Error(`Unsupported object type: ${dialogOptions.objectType}`);
	}
}

async function getConnectionUri(context: azdata.ObjectExplorerContext): Promise<string> {
	const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile!.id);
	if (!connectionUri) {
		await vscode.window.showErrorMessage(objectManagementLoc.FailedToRetrieveConnectionInfoErrorMessage, { modal: true });
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
