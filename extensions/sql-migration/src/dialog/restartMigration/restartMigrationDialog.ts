/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as features from '../../service/features';
import { azureResource } from 'azurecore';
import { getLocations, getResourceGroupFromId, getBlobContainerId, getFullResourceGroupFromId, getResourceName, DatabaseMigration, getMigrationTargetInstance } from '../../api/azure';
import { MigrationMode, MigrationStateModel, NetworkContainerType, SavedInfo } from '../../models/stateMachine';
import { MigrationServiceContext } from '../../models/migrationLocalStorage';
import { WizardController } from '../../wizard/wizardController';
import { getMigrationModeEnum, getMigrationTargetTypeEnum } from '../../constants/helper';
import * as constants from '../../constants/strings';
import { ServiceContextChangeEvent } from '../../dashboard/tabBase';
import { migrationServiceProvider } from '../../service/provider';
import { getSourceConnectionProfile } from '../../api/sqlUtils';

export class RestartMigrationDialog {

	constructor(
		private readonly _context: vscode.ExtensionContext,
		private readonly _serviceContext: MigrationServiceContext,
		private readonly _migration: DatabaseMigration,
		private readonly _serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>) {
	}

	private async createMigrationStateModel(
		serviceContext: MigrationServiceContext,
		migration: DatabaseMigration,
		serverName: string,
		migrationService: features.SqlMigrationService,
		location: azureResource.AzureLocation): Promise<MigrationStateModel> {

		const stateModel = new MigrationStateModel(this._context, migrationService);
		const sourceDatabaseName = migration.properties.sourceDatabaseName;
		const savedInfo: SavedInfo = {
			closedPage: 0,

			// DatabaseSelector
			databaseAssessment: [sourceDatabaseName],

			// SKURecommendation
			databaseList: [sourceDatabaseName],
			databaseInfoList: [],
			serverAssessment: null,
			skuRecommendation: null,
			migrationTargetType: getMigrationTargetTypeEnum(migration)!,

			// TargetSelection
			azureAccount: serviceContext.azureAccount!,
			azureTenant: serviceContext.tenant!,
			subscription: serviceContext.subscription!,
			location: location,
			resourceGroup: {
				id: getFullResourceGroupFromId(migration.id),
				name: getResourceGroupFromId(migration.id),
				subscription: serviceContext.subscription!,
			},
			targetServerInstance: await getMigrationTargetInstance(
				serviceContext.azureAccount!,
				serviceContext.subscription!,
				migration),

			// MigrationMode
			migrationMode: getMigrationModeEnum(migration),

			// DatabaseBackup
			targetDatabaseNames: [migration.name],
			networkContainerType: null,
			networkShares: [],
			blobs: [],

			// Integration Runtime
			sqlMigrationService: serviceContext.migrationService,
			serviceSubscription: null,
			serviceResourceGroup: null,
			xEventsFilesFolderPath: null,
			collectAdhocQueries: null
		};

		const getStorageAccountResourceGroup = (storageAccountResourceId: string): azureResource.AzureResourceResourceGroup => {
			return {
				id: getFullResourceGroupFromId(storageAccountResourceId!),
				name: getResourceGroupFromId(storageAccountResourceId!),
				subscription: this._serviceContext.subscription!
			};
		};
		const getStorageAccount = (storageAccountResourceId: string): azureResource.AzureGraphResource => {
			const storageAccountName = getResourceName(storageAccountResourceId);
			return {
				type: 'microsoft.storage/storageaccounts',
				id: storageAccountResourceId!,
				tenantId: savedInfo.azureTenant?.id!,
				subscriptionId: this._serviceContext.subscription?.id!,
				name: storageAccountName,
				location: savedInfo.location!.name,
			};
		};

		const sourceLocation = migration.properties.backupConfiguration?.sourceLocation;
		if (sourceLocation?.fileShare) {
			savedInfo.networkContainerType = NetworkContainerType.NETWORK_SHARE;
			const storageAccountResourceId = migration.properties.backupConfiguration?.targetLocation?.storageAccountResourceId!;
			savedInfo.networkShares = [
				{
					password: '',
					networkShareLocation: sourceLocation?.fileShare?.path!,
					windowsUser: sourceLocation?.fileShare?.username!,
					storageAccount: getStorageAccount(storageAccountResourceId!),
					resourceGroup: getStorageAccountResourceGroup(storageAccountResourceId!),
					storageKey: ''
				}
			];
		} else if (sourceLocation?.azureBlob) {
			savedInfo.networkContainerType = NetworkContainerType.BLOB_CONTAINER;
			const storageAccountResourceId = sourceLocation?.azureBlob?.storageAccountResourceId!;
			savedInfo.blobs = [
				{
					blobContainer: {
						id: getBlobContainerId(getFullResourceGroupFromId(storageAccountResourceId!), getResourceName(storageAccountResourceId!), sourceLocation?.azureBlob.blobContainerName),
						name: sourceLocation?.azureBlob.blobContainerName,
						subscription: this._serviceContext.subscription!
					},
					lastBackupFile: getMigrationModeEnum(migration) === MigrationMode.OFFLINE ? migration.properties.offlineConfiguration?.lastBackupName! : undefined,
					storageAccount: getStorageAccount(storageAccountResourceId!),
					resourceGroup: getStorageAccountResourceGroup(storageAccountResourceId!),
					storageKey: ''
				}
			];
		}

		stateModel.restartMigration = true;
		stateModel.savedInfo = savedInfo;
		stateModel.serverName = serverName;
		return stateModel;
	}

	public async openDialog(dialogName?: string) {
		const locations = await getLocations(
			this._serviceContext.azureAccount!,
			this._serviceContext.subscription!);

		const targetInstance = await getMigrationTargetInstance(
			this._serviceContext.azureAccount!,
			this._serviceContext.subscription!,
			this._migration);

		let location: azureResource.AzureLocation;
		locations.forEach(azureLocation => {
			if (azureLocation.name === targetInstance.location) {
				location = azureLocation;
			}
		});

		const activeConnection = await getSourceConnectionProfile();
		let serverName: string = '';
		if (!activeConnection) {
			const connection = await azdata.connection.openConnectionDialog();
			if (connection) {
				serverName = connection.options.server;
			}
		} else {
			serverName = activeConnection.serverName;
		}

		const migrationService = <features.SqlMigrationService>await migrationServiceProvider.getService(features.ApiType.SqlMigrationProvider)!;
		const stateModel = await this.createMigrationStateModel(this._serviceContext, this._migration, serverName, migrationService, location!);

		if (await stateModel.loadSavedInfo()) {
			const wizardController = new WizardController(
				this._context,
				stateModel,
				this._serviceContextChangedEvent);
			await wizardController.openWizard();
		} else {
			void vscode.window.showInformationMessage(constants.MIGRATION_CANNOT_RESTART);
		}
	}
}
