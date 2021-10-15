/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../../mssql';
import { azureResource } from 'azureResource';
import { getLocations, getResourceGroupFromId } from '../../api/azure';
import { MigrationMode, MigrationStateModel, NetworkContainerType, SavedInfo, Page } from '../../models/stateMachine';
import { MigrationContext } from '../../models/migrationLocalStorage';
import { WizardController } from '../../wizard/wizardController';
import { getBlobContainerId, getMigrationModeEnum, getMigrationTargetTypeEnum, getResourceGroupId, getResourceName } from '../../constants/helper';

export class RetryMigrationDialog {
	private _context: vscode.ExtensionContext;
	private _migration: MigrationContext;

	constructor(context: vscode.ExtensionContext, migration: MigrationContext) {
		this._context = context;
		this._migration = migration;
	}

	private createMigrationStateModel(migration: MigrationContext, connectionId: string, serverName: string, api: mssql.IExtension, location: azureResource.AzureLocation): MigrationStateModel {
		let stateModel = new MigrationStateModel(this._context, connectionId, api.sqlMigration);

		const sourceDatabaseName = migration.migrationContext.properties.sourceDatabaseName;
		let savedInfo: SavedInfo;
		savedInfo = {
			closedPage: Page.AzureAccount,

			// AzureAccount
			azureAccount: migration.azureAccount,
			azureTenant: migration.azureAccount.properties.tenants[0],

			// DatabaseSelector
			selectedDatabases: [],

			// SKURecommendation
			databaseAssessment: [sourceDatabaseName],
			databaseList: [sourceDatabaseName],
			migrationDatabases: [],
			serverAssessment: null,

			migrationTargetType: getMigrationTargetTypeEnum(migration)!,
			subscription: migration.subscription,
			location: location,
			resourceGroup: {
				id: getResourceGroupId(migration.targetManagedInstance.id),
				name: getResourceGroupFromId(migration.targetManagedInstance.id),
				subscription: migration.subscription
			},
			targetServerInstance: migration.targetManagedInstance,

			// MigrationMode
			migrationMode: getMigrationModeEnum(migration),

			// DatabaseBackup
			targetSubscription: migration.subscription,
			targetDatabaseNames: [migration.migrationContext.name],
			networkContainerType: null,
			networkShare: null,
			blobs: [],

			// Integration Runtime
			migrationServiceId: migration.migrationContext.properties.migrationService,
		};

		const getStorageAccountResourceGroup = (storageAccountResourceId: string) => {
			return {
				id: getResourceGroupId(storageAccountResourceId!),
				name: getResourceGroupFromId(storageAccountResourceId!),
				subscription: migration.subscription
			};
		};
		const getStorageAccount = (storageAccountResourceId: string) => {
			const storageAccountName = getResourceName(storageAccountResourceId);
			return {
				type: 'microsoft.storage/storageaccounts',
				id: storageAccountResourceId!,
				tenantId: savedInfo.azureTenant?.id!,
				subscriptionId: migration.subscription.id,
				name: storageAccountName,
				location: savedInfo.location!.name,
			};
		};

		const sourceLocation = migration.migrationContext.properties.backupConfiguration.sourceLocation;
		if (sourceLocation?.fileShare) {
			savedInfo.networkContainerType = NetworkContainerType.NETWORK_SHARE;
			const storageAccountResourceId = migration.migrationContext.properties.backupConfiguration.targetLocation?.storageAccountResourceId!;
			savedInfo.networkShare = {
				password: '',
				networkShareLocation: sourceLocation?.fileShare?.path!,
				windowsUser: sourceLocation?.fileShare?.username!,
				storageAccount: getStorageAccount(storageAccountResourceId!),
				resourceGroup: getStorageAccountResourceGroup(storageAccountResourceId!),
				storageKey: ''
			};
		} else if (sourceLocation?.azureBlob) {
			savedInfo.networkContainerType = NetworkContainerType.BLOB_CONTAINER;
			const storageAccountResourceId = sourceLocation?.azureBlob?.storageAccountResourceId!;
			savedInfo.blobs = [
				{
					blobContainer: {
						id: getBlobContainerId(getResourceGroupId(storageAccountResourceId!), getResourceName(storageAccountResourceId!), sourceLocation?.azureBlob.blobContainerName),
						name: sourceLocation?.azureBlob.blobContainerName,
						subscription: migration.subscription
					},
					lastBackupFile: getMigrationModeEnum(migration) === MigrationMode.OFFLINE ? migration.migrationContext.properties.offlineConfiguration.lastBackupName! : undefined,
					storageAccount: getStorageAccount(storageAccountResourceId!),
					resourceGroup: getStorageAccountResourceGroup(storageAccountResourceId!),
					storageKey: ''
				}
			];
		}

		stateModel.retryMigration = true;
		stateModel.savedInfo = savedInfo;
		stateModel.serverName = serverName;
		return stateModel;
	}

	public async openDialog(dialogName?: string) {
		const locations = await getLocations(this._migration.azureAccount, this._migration.subscription);
		let location: azureResource.AzureLocation;
		locations.forEach(azureLocation => {
			if (azureLocation.name === this._migration.targetManagedInstance.location) {
				location = azureLocation;
			}
		});

		let activeConnection = await azdata.connection.getCurrentConnection();
		let connectionId: string = '';
		let serverName: string = '';
		if (!activeConnection) {
			const connection = await azdata.connection.openConnectionDialog();
			if (connection) {
				connectionId = connection.connectionId;
				serverName = connection.options.server;
			}
		} else {
			connectionId = activeConnection.connectionId;
			serverName = activeConnection.serverName;
		}

		const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
		const stateModel = this.createMigrationStateModel(this._migration, connectionId, serverName, api, location!);

		const wizardController = new WizardController(this._context, stateModel);
		await wizardController.openWizard(stateModel.sourceConnectionId);
	}
}
