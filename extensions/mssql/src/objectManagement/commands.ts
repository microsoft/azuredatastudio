/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { DropDatabaseDialog } from './ui/dropDatabaseDialog';
import { AttachDatabaseDialog } from './ui/attachDatabaseDialog';
import { RestoreDatabaseDialog } from './ui/restoreDatabaseDialog';
import { BackupDatabaseDialog } from './ui/backupDatabaseDialog';
import { IConnectionProfile } from 'azdata';

export function registerObjectManagementCommands(appContext: AppContext) {
	// Notes: Change the second parameter to false to use the actual object management service.
	const service = getObjectManagementService(appContext, false);
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newObject', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newDatabaseRole', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newApplicationRole', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newLogin', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newUser', async (context: azdata.ObjectExplorerContext) => {
		await handleNewObjectDialogCommand(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newServerRole', async (context: azdata.ObjectExplorerContext) => {
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
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.attachDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleAttachDatabase(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.backupDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleBackupDatabaseCmd(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.restoreDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleRestoreDatabaseCmd(context, service);
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.dropDatabase', async (context: azdata.ObjectExplorerContext) => {
		await handleDropDatabase(context, service);
	}));

	// Database dashboard buttons
	appContext.extensionContext.subscriptions.push(azdata.tasks.registerTask('mssql.backupDatabaseTask', async (profile: azdata.IConnectionProfile) => {
		await handleBackupDatabaseTask(profile, service);
	}));
	appContext.extensionContext.subscriptions.push(azdata.tasks.registerTask('mssql.restoreDatabaseTask', async (profile: azdata.IConnectionProfile) => {
		await handleRestoreDatabaseTask(profile, service);
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
	if (context.nodeInfo) {
		switch (context.nodeInfo.objectType) {
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
			switch (context.nodeInfo.nodeType) {
				case ObjectManagement.NodeType.ApplicationRole:
				case ObjectManagement.NodeType.DatabaseRole:
				case ObjectManagement.NodeType.ServerLevelLogin:
				case ObjectManagement.NodeType.ServerLevelServerRole:
				case ObjectManagement.NodeType.User:
				case ObjectManagement.NodeType.Database:
					objectType = context.nodeInfo.nodeType as ObjectManagement.NodeType;
					break;
				default:
					throw new Error(objectManagementLoc.NoDialogFoundError(context.nodeInfo.nodeType, context.nodeInfo.objectType));
			}
		}
	} else {
		// Node info will be missing for top level connection items like servers and databases, so make a best guess here based on connection info.
		// If we don't have a database name, then we have to assume it's a server node, which isn't valid for the New Object command.
		if (context.connectionProfile?.databaseName?.length > 0) {
			objectType = ObjectManagement.NodeType.Database;
		} else {
			throw new Error(objectManagementLoc.NotSupportedError(ObjectManagement.NodeType.Server));
		}
	}

	try {
		const parentUrn = await getParentUrn(context);
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: true,
			database: context.connectionProfile?.databaseName,
			objectType: objectType,
			objectName: '',
			parentUrn: parentUrn,
			objectExplorerContext: context
		};
		const dialog = getDialog(service, options);
		const startTime = Date.now();
		await dialog.open();
		TelemetryReporter.sendTelemetryEvent(TelemetryActions.OpenNewObjectDialog, {
			objectType: objectType
		}, {
			elapsedTimeMs: Date.now() - startTime
		});
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenNewObjectDialog, err).withAdditionalProperties({
			objectType: objectType
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
	const object = await getObjectInfoForContext(context);
	try {
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: false,
			database: context.connectionProfile?.databaseName,
			objectType: object.type,
			objectName: object.name,
			parentUrn: object.parentUrn,
			objectUrn: object.urn,
			objectExplorerContext: context
		};
		const dialog = getDialog(service, options);
		const startTime = Date.now();
		await dialog.open();
		TelemetryReporter.sendTelemetryEvent(TelemetryActions.OpenPropertiesDialog, {
			objectType: object.type
		}, {
			elapsedTimeMs: Date.now() - startTime
		});
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenPropertiesDialog, err).withAdditionalProperties({
			objectType: object.type
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenObjectPropertiesDialogError(objectManagementLoc.getNodeTypeDisplayName(object.type), object.name, getErrorMessage(err)));
	}
}

async function handleDropObjectCommand(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}

	const object = await getObjectInfoForContext(context);
	let additionalConfirmationMessage: string | undefined = undefined;
	switch (object.type) {
		case ObjectManagement.NodeType.ServerLevelLogin:
			additionalConfirmationMessage = objectManagementLoc.DropLoginConfirmationText;
			break;
		default:
			break;
	}
	const nodeTypeDisplayName = objectManagementLoc.getNodeTypeDisplayName(object.type);
	let confirmMessage = objectManagementLoc.DropObjectConfirmationText(nodeTypeDisplayName, object.name);
	if (additionalConfirmationMessage) {
		confirmMessage = `${additionalConfirmationMessage} ${confirmMessage}`;
	}
	const confirmResult = await vscode.window.showWarningMessage(confirmMessage, { modal: true }, uiLoc.YesText);
	if (confirmResult !== uiLoc.YesText) {
		return;
	}
	azdata.tasks.startBackgroundOperation({
		displayName: objectManagementLoc.DropObjectOperationDisplayName(nodeTypeDisplayName, object.name),
		description: '',
		isCancelable: false,
		operation: async (operation) => {
			try {
				const startTime = Date.now();
				await service.drop(connectionUri, object.type, object.urn);
				TelemetryReporter.sendTelemetryEvent(TelemetryActions.DropObject, {
					objectType: object.type
				}, {
					elapsedTimeMs: Date.now() - startTime
				});
			}
			catch (err) {
				operation.updateStatus(azdata.TaskStatus.Failed, objectManagementLoc.DropObjectError(nodeTypeDisplayName, object.name, getErrorMessage(err)));
				TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.DropObject, err).withAdditionalProperties({
					objectType: object.type
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

	const object = await getObjectInfoForContext(context);
	const nodeTypeDisplayName = objectManagementLoc.getNodeTypeDisplayName(object.type);
	const newName = await vscode.window.showInputBox({
		title: objectManagementLoc.RenameObjectDialogTitle,
		value: object.name,
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
	if (newName === object.name || !newName) {
		return;
	}

	azdata.tasks.startBackgroundOperation({
		displayName: objectManagementLoc.RenameObjectOperationDisplayName(nodeTypeDisplayName, object.name, newName),
		description: '',
		isCancelable: false,
		operation: async (operation) => {
			try {
				const startTime = Date.now();
				await service.rename(connectionUri, object.type, object.urn, newName);
				TelemetryReporter.sendTelemetryEvent(TelemetryActions.RenameObject, {
					objectType: object.type
				}, {
					elapsedTimeMs: Date.now() - startTime
				});
			}
			catch (err) {
				operation.updateStatus(azdata.TaskStatus.Failed, objectManagementLoc.RenameObjectError(nodeTypeDisplayName, object.name, newName, getErrorMessage(err)));
				TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.RenameObject, err).withAdditionalProperties({
					objectType: object.type
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
	const object = await getObjectInfoForContext(context);
	try {
		if (object.type !== ObjectManagement.NodeType.Database) {
			throw new Error(objectManagementLoc.NotSupportedError(ObjectManagement.NodeType.Database));
		}
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: false,
			database: object.name,
			objectType: object.type,
			objectName: object.name,
			parentUrn: object.parentUrn,
			objectUrn: object.urn,
			objectExplorerContext: context
		};
		const dialog = new DetachDatabaseDialog(service, options);
		const startTime = Date.now();
		await dialog.open();
		TelemetryReporter.sendTelemetryEvent(TelemetryActions.OpenDetachDatabaseDialog, {
			objectType: object.type
		}, {
			elapsedTimeMs: Date.now() - startTime
		});
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenDetachDatabaseDialog, err).withAdditionalProperties({
			objectType: object.type
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenDetachDatabaseDialogError(getErrorMessage(err)));
	}
}

async function handleAttachDatabase(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	try {
		const parentUrn = await getParentUrn(context);
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: true,
			database: context.connectionProfile!.databaseName!,
			objectType: ObjectManagement.NodeType.Database,
			objectName: '',
			parentUrn: parentUrn,
			objectExplorerContext: context
		};
		const dialog = new AttachDatabaseDialog(service, options);
		const startTime = Date.now();
		await dialog.open();
		TelemetryReporter.sendTelemetryEvent(TelemetryActions.OpenAttachDatabaseDialog, {
			objectType: ObjectManagement.NodeType.Database
		}, {
			elapsedTimeMs: Date.now() - startTime
		});
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenAttachDatabaseDialog, err).withAdditionalProperties({
			objectType: context.nodeInfo!.nodeType
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenAttachDatabaseDialogError(getErrorMessage(err)));
	}
}

async function handleBackupDatabase(options: ObjectManagementDialogOptions, service: IObjectManagementService): Promise<void> {
	try {
		const dialog = new BackupDatabaseDialog(service, options);
		const startTime = Date.now();
		await dialog.open();
		TelemetryReporter.sendTelemetryEvent(TelemetryActions.OpenBackupDatabaseDialog, {
			objectType: options.objectType
		}, {
			elapsedTimeMs: Date.now() - startTime
		});
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenBackupDatabaseDialog, err).withAdditionalProperties({
			objectType: options.objectType
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenBackupDatabaseDialogError(getErrorMessage(err)));
	}
}

async function handleBackupDatabaseCmd(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const object = await getObjectInfoForContext(context);
	if (object.type !== ObjectManagement.NodeType.Database) {
		throw new Error(objectManagementLoc.NotSupportedError(ObjectManagement.NodeType.Database));
	}
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	const options: ObjectManagementDialogOptions = {
		connectionUri: connectionUri,
		isNewObject: false,
		database: object.name,
		objectType: object.type,
		objectName: object.name,
		parentUrn: object.parentUrn,
		objectUrn: object.urn,
		objectExplorerContext: context
	};
	await handleBackupDatabase(options, service);
}

async function handleBackupDatabaseTask(profile: azdata.IConnectionProfile, service: IObjectManagementService): Promise<void> {
	let connectionUri = await azdata.connection.getUriForConnection(profile.id);
	const options: ObjectManagementDialogOptions = {
		connectionUri: connectionUri,
		isNewObject: false,
		database: profile.databaseName,
		objectType: ObjectManagement.NodeType.Database,
		objectName: profile.databaseName,
		parentUrn: undefined,
		objectUrn: undefined,
		objectExplorerContext: undefined
	};
	await handleBackupDatabase(options, service);
}

async function handleDropDatabase(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}
	const object = await getObjectInfoForContext(context);
	try {
		if (object.type !== ObjectManagement.NodeType.Database) {
			throw new Error(objectManagementLoc.NotSupportedError(ObjectManagement.NodeType.Database));
		}
		const options: ObjectManagementDialogOptions = {
			connectionUri: connectionUri,
			isNewObject: false,
			database: object.name,
			objectType: object.type,
			objectName: object.name,
			parentUrn: object.parentUrn,
			objectUrn: object.urn,
			objectExplorerContext: context
		};
		const dialog = new DropDatabaseDialog(service, options);
		const startTime = Date.now();
		await dialog.open();
		TelemetryReporter.sendTelemetryEvent(TelemetryActions.OpenDropDatabaseDialog, {
			objectType: object.type
		}, {
			elapsedTimeMs: Date.now() - startTime
		});
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenDropDatabaseDialog, err).withAdditionalProperties({
			objectType: object.type
		}).send();
		console.error(err);
		await vscode.window.showErrorMessage(objectManagementLoc.OpenDropDatabaseDialogError(getErrorMessage(err)));
	}
}

async function handleRestoreDatabase(options: ObjectManagementDialogOptions, service: IObjectManagementService): Promise<void> {
	try {
		const dialog = new RestoreDatabaseDialog(service, options);
		const startTime = Date.now();
		await dialog.open();
		TelemetryReporter.sendTelemetryEvent(TelemetryActions.OpenRestoreDatabaseDialog, {
			objectType: ObjectManagement.NodeType.Database
		}, {
			elapsedTimeMs: Date.now() - startTime
		});
	}
	catch (err) {
		TelemetryReporter.createErrorEvent2(ObjectManagementViewName, TelemetryActions.OpenRestoreDatabaseDialog, err).withAdditionalProperties({
			objectType: options.objectType
		}).send();
		console.error(err);
		void vscode.window.showErrorMessage(objectManagementLoc.OpenRestoreDatabaseDialogError(getErrorMessage(err)));
	}
}

async function handleRestoreDatabaseCmd(context: azdata.ObjectExplorerContext, service: IObjectManagementService): Promise<void> {
	const connectionUri = await getConnectionUri(context);
	if (!connectionUri) {
		return;
	}

	const parentUrn = await getParentUrn(context);
	const options: ObjectManagementDialogOptions = {
		connectionUri: connectionUri,
		isNewObject: false,
		database: context.connectionProfile!.databaseName!,
		objectType: ObjectManagement.NodeType.Database,
		objectName: '',
		parentUrn: parentUrn,
		objectExplorerContext: context
	};
	await handleRestoreDatabase(options, service)
}

async function handleRestoreDatabaseTask(profile: IConnectionProfile, service: IObjectManagementService): Promise<void> {
	let connectionUri = await azdata.connection.getUriForConnection(profile.id);
	const options: ObjectManagementDialogOptions = {
		connectionUri: connectionUri,
		isNewObject: false,
		database: profile.databaseName,
		objectType: ObjectManagement.NodeType.Database,
		objectName: profile.databaseName,
		parentUrn: undefined,
		objectUrn: undefined,
		objectExplorerContext: undefined
	};
	await handleRestoreDatabase(options, service)
}

function getDialog(service: IObjectManagementService, dialogOptions: ObjectManagementDialogOptions): ObjectManagementDialogBase<ObjectManagement.SqlObject, ObjectManagement.ObjectViewInfo<ObjectManagement.SqlObject>> {
	const verticalTabsDialogWidth = '750px';
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
			dialogOptions.width = dialogOptions.isNewObject ? undefined : verticalTabsDialogWidth;
			return new ServerPropertiesDialog(service, dialogOptions);
		case ObjectManagement.NodeType.User:
			return new UserDialog(service, dialogOptions);
		case ObjectManagement.NodeType.Database:
			dialogOptions.width = dialogOptions.isNewObject ? undefined : verticalTabsDialogWidth;
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

async function getParentUrn(context: azdata.ObjectExplorerContext): Promise<string | undefined> {
	let parentUrn: string = undefined;
	if (context.nodeInfo) {
		let node = undefined;
		let currentNodePath = context.nodeInfo.parentNodePath;
		do {
			node = await azdata.objectexplorer.getNode(context.connectionProfile!.id, currentNodePath);
			currentNodePath = node?.parentNodePath;
		} while (node && currentNodePath && !node.metadata?.urn);
		parentUrn = node?.metadata?.urn;
	}
	return parentUrn;
}

interface ObjectInfo {
	parentUrn: string;
	name: string;
	type: ObjectManagement.NodeType;
	urn: string;
}

async function getObjectInfoForContext(context: azdata.ObjectExplorerContext): Promise<ObjectInfo> {
	let nodeType: ObjectManagement.NodeType;
	let objectName: string;
	let objectUrn: string;
	if (context.nodeInfo) {
		nodeType = context.nodeInfo.nodeType as ObjectManagement.NodeType;
		objectName = context.nodeInfo.metadata?.name;
		objectUrn = context.nodeInfo.metadata?.urn;
	} else {
		// Node info will be missing for top level connection items like servers and databases, so make a best guess here based on connection info.
		if (context.connectionProfile?.databaseName?.length > 0) {
			nodeType = ObjectManagement.NodeType.Database;
			objectName = context.connectionProfile.databaseName;
			objectUrn = `Server/Database[@Name='${escapeSingleQuotes(objectName)}']`;
		} else {
			nodeType = ObjectManagement.NodeType.Server;
			objectName = context.connectionProfile.serverName;
			objectUrn = 'Server';
		}
	}
	let parentUrn = await getParentUrn(context);
	return {
		parentUrn: parentUrn,
		name: objectName,
		type: nodeType,
		urn: objectUrn
	}
}
