/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from 'azureResource';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { getAvailableManagedInstanceProducts, getAvailableStorageAccounts, getBlobContainers, getFileShares, getMigrationControllers, getSubscriptions, MigrationController, SqlManagedInstance, startDatabaseMigration, StartDatabaseMigrationRequest, StorageAccount } from '../api/azure';
import { SKURecommendations } from './externalContract';
import * as constants from '../models/strings';
import { MigrationLocalStorage } from './migrationLocalStorage';

export enum State {
	INIT,
	COLLECTING_SOURCE_INFO,
	COLLECTION_SOURCE_INFO_ERROR,
	TARGET_SELECTION,
	TARGET_SELECTION_ERROR,
	AZURE_SERVER_SELECTION,
	AZURE_SERVER_SELECTION_ERROR,
	AZURE_DB_BACKUP,
	AZURE_DB_BACKUP_ERROR,
	MIGRATION_AGENT_CREATION,
	MIGRATION_AGENT_SELECTION,
	MIGRATION_AGENT_ERROR,
	MIGRATION_START,
	NO_AZURE_SERVER,
	EXIT,
}

export enum MigrationCutover {
	ONLINE,
	OFFLINE
}

export enum NetworkContainerType {
	FILE_SHARE,
	BLOB_CONTAINER,
	NETWORK_SHARE
}

export interface NetworkShare {
	networkShareLocation: string;
	windowsUser: string;
	password: string;
}

export interface DatabaseBackupModel {
	migrationCutover: MigrationCutover;
	networkContainerType: NetworkContainerType;
	networkShareLocation: string;
	windowsUser: string;
	password: string;
	subscription: azureResource.AzureResourceSubscription;
	storageAccount: StorageAccount;
	storageKey: string;
	azureSecurityToken: string;
	fileShare: azureResource.FileShare;
	blobContainer: azureResource.BlobContainer;
}
export interface Model {
	readonly sourceConnectionId: string;
	readonly currentState: State;
	gatheringInformationError: string | undefined;
	skuRecommendations: SKURecommendations | undefined;
	_azureAccount: azdata.Account | undefined;
	_databaseBackup: DatabaseBackupModel | undefined;
}

export interface StateChangeEvent {
	oldState: State;
	newState: State;
}

export class MigrationStateModel implements Model, vscode.Disposable {
	public _azureAccounts!: azdata.Account[];
	public _azureAccount!: azdata.Account;

	public _subscriptions!: azureResource.AzureResourceSubscription[];

	public _targetSubscription!: azureResource.AzureResourceSubscription;
	public _targetManagedInstances!: SqlManagedInstance[];
	public _targetManagedInstance!: SqlManagedInstance;

	public _databaseBackup!: DatabaseBackupModel;
	public _migrationDbs!: string[];
	public _storageAccounts!: StorageAccount[];
	public _fileShares!: azureResource.FileShare[];
	public _blobContainers!: azureResource.BlobContainer[];

	public _migrationController!: MigrationController;
	public _migrationControllers!: MigrationController[];
	public _nodeNames!: string[];

	private _stateChangeEventEmitter = new vscode.EventEmitter<StateChangeEvent>();
	private _currentState: State;
	private _gatheringInformationError: string | undefined;
	private _skuRecommendations: SKURecommendations | undefined;
	private _assessmentResults: mssql.SqlMigrationAssessmentResultItem[] | undefined;



	constructor(
		private readonly _extensionContext: vscode.ExtensionContext,
		private readonly _sourceConnectionId: string,
		public readonly migrationService: mssql.ISqlMigrationService
	) {
		this._currentState = State.INIT;
		this._databaseBackup = {} as DatabaseBackupModel;
	}

	public get sourceConnectionId(): string {
		return this._sourceConnectionId;
	}

	public get currentState(): State {
		return this._currentState;
	}

	public set currentState(newState: State) {
		const oldState = this.currentState;

		this._currentState = newState;

		this._stateChangeEventEmitter.fire({ oldState, newState: this.currentState });
	}

	public get assessmentResults(): mssql.SqlMigrationAssessmentResultItem[] | undefined {
		return this._assessmentResults;
	}

	public set assessmentResults(assessmentResults: mssql.SqlMigrationAssessmentResultItem[] | undefined) {
		this._assessmentResults = assessmentResults;
	}

	public get gatheringInformationError(): string | undefined {
		return this._gatheringInformationError;
	}

	public set gatheringInformationError(error: string | undefined) {
		this._gatheringInformationError = error;
	}

	public get skuRecommendations(): SKURecommendations | undefined {
		return this._skuRecommendations;
	}

	public set skuRecommendations(recommendations: SKURecommendations | undefined) {
		this._skuRecommendations = recommendations;
	}

	public get stateChangeEvent(): vscode.Event<StateChangeEvent> {
		return this._stateChangeEventEmitter.event;
	}

	dispose() {
		this._stateChangeEventEmitter.dispose();
	}

	public getExtensionPath(): string {
		return this._extensionContext.extensionPath;
	}

	public async getAccountValues(): Promise<azdata.CategoryValue[]> {
		let accountValues: azdata.CategoryValue[] = [];
		try {
			this._azureAccounts = await azdata.accounts.getAllAccounts();
			if (this._azureAccounts.length === 0) {
				accountValues = [{
					displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,
					name: ''
				}];
			}
			accountValues = this._azureAccounts.map((account): azdata.CategoryValue => {
				return {
					displayName: account.displayInfo.displayName,
					name: account.displayInfo.userId
				};
			});
		} catch (e) {
			console.log(e);
			accountValues = [{
				displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,
				name: ''
			}];
		}
		return accountValues;
	}

	public getAccount(index: number): azdata.Account {
		return this._azureAccounts[index];
	}

	public async getSubscriptionsDropdownValues(): Promise<azdata.CategoryValue[]> {
		let subscriptionsValues: azdata.CategoryValue[] = [];
		try {
			if (!this._subscriptions) {
				this._subscriptions = await getSubscriptions(this._azureAccount);
			}
			this._subscriptions.forEach((subscription) => {
				subscriptionsValues.push({
					name: subscription.id,
					displayName: `${subscription.name} - ${subscription.id}`
				});
			});

			if (subscriptionsValues.length === 0) {
				subscriptionsValues = [
					{
						displayName: constants.NO_SUBSCRIPTIONS_FOUND,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			subscriptionsValues = [
				{
					displayName: constants.NO_SUBSCRIPTIONS_FOUND,
					name: ''
				}
			];
		}

		return subscriptionsValues;
	}

	public getSubscription(index: number): azureResource.AzureResourceSubscription {
		return this._subscriptions[index];
	}

	public async getManagedInstanceValues(subscription: azureResource.AzureResourceSubscription): Promise<azdata.CategoryValue[]> {
		let managedInstanceValues: azdata.CategoryValue[] = [];
		try {
			this._targetManagedInstances = await getAvailableManagedInstanceProducts(this._azureAccount, subscription);
			this._targetManagedInstances.forEach((managedInstance) => {
				managedInstanceValues.push({
					name: managedInstance.id,
					displayName: `${managedInstance.name}`
				});
			});

			if (managedInstanceValues.length === 0) {
				managedInstanceValues = [
					{
						displayName: constants.NO_MANAGED_INSTANCE_FOUND,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			managedInstanceValues = [
				{
					displayName: constants.NO_MANAGED_INSTANCE_FOUND,
					name: ''
				}
			];
		}
		return managedInstanceValues;
	}

	public getManagedInstance(index: number): SqlManagedInstance {
		return this._targetManagedInstances[index];
	}

	public async getStorageAccountValues(subscription: azureResource.AzureResourceSubscription): Promise<azdata.CategoryValue[]> {
		let storageAccountValues: azdata.CategoryValue[] = [];
		try {
			this._storageAccounts = await getAvailableStorageAccounts(this._azureAccount, subscription);
			this._storageAccounts.forEach((storageAccount) => {
				storageAccountValues.push({
					name: storageAccount.id,
					displayName: `${storageAccount.name}`
				});
			});

			if (storageAccountValues.length === 0) {
				storageAccountValues = [
					{
						displayName: constants.NO_STORAGE_ACCOUNT_FOUND,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			storageAccountValues = [
				{
					displayName: constants.NO_STORAGE_ACCOUNT_FOUND,
					name: ''
				}
			];
		}
		return storageAccountValues;
	}

	public getStorageAccount(index: number): StorageAccount {
		return this._storageAccounts[index];
	}

	public async getFileShareValues(subscription: azureResource.AzureResourceSubscription, storageAccount: StorageAccount): Promise<azdata.CategoryValue[]> {
		let fileShareValues: azdata.CategoryValue[] = [];
		try {
			this._fileShares = await getFileShares(this._azureAccount, subscription, storageAccount);
			this._fileShares.forEach((fileShare) => {
				fileShareValues.push({
					name: fileShare.id,
					displayName: `${fileShare.name}`
				});
			});

			if (fileShareValues.length === 0) {
				fileShareValues = [
					{
						displayName: constants.NO_FILESHARES_FOUND,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			fileShareValues = [
				{
					displayName: constants.NO_FILESHARES_FOUND,
					name: ''
				}
			];
		}
		return fileShareValues;
	}

	public getFileShare(index: number): azureResource.FileShare {
		return this._fileShares[index];
	}

	public async getBlobContainerValues(subscription: azureResource.AzureResourceSubscription, storageAccount: StorageAccount): Promise<azdata.CategoryValue[]> {
		let blobContainerValues: azdata.CategoryValue[] = [];
		try {
			this._blobContainers = await getBlobContainers(this._azureAccount, subscription, storageAccount);
			this._blobContainers.forEach((blobContainer) => {
				blobContainerValues.push({
					name: blobContainer.id,
					displayName: `${blobContainer.name}`
				});
			});

			if (blobContainerValues.length === 0) {
				blobContainerValues = [
					{
						displayName: constants.NO_BLOBCONTAINERS_FOUND,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			blobContainerValues = [
				{
					displayName: constants.NO_BLOBCONTAINERS_FOUND,
					name: ''
				}
			];
		}
		return blobContainerValues;
	}

	public getBlobContainer(index: number): azureResource.BlobContainer {
		return this._blobContainers[index];
	}


	public async getMigrationControllerValues(subscription: azureResource.AzureResourceSubscription, managedInstance: SqlManagedInstance): Promise<azdata.CategoryValue[]> {
		let migrationControllerValues: azdata.CategoryValue[] = [];
		try {
			this._migrationControllers = await getMigrationControllers(this._azureAccount, subscription, managedInstance.resourceGroup!, managedInstance.location);
			this._migrationControllers.forEach((migrationController) => {
				migrationControllerValues.push({
					name: migrationController.id,
					displayName: `${migrationController.name}`
				});
			});

			if (migrationControllerValues.length === 0) {
				migrationControllerValues = [
					{
						displayName: constants.MIGRATION_CONTROLLER_NOT_FOUND_ERROR,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			migrationControllerValues = [
				{
					displayName: constants.MIGRATION_CONTROLLER_NOT_FOUND_ERROR,
					name: ''
				}
			];
		}
		return migrationControllerValues;
	}

	public getMigrationController(index: number): MigrationController {
		return this._migrationControllers[index];
	}

	public async startMigration() {
		const sqlConnections = await azdata.connection.getConnections();
		const currentConnection = sqlConnections.find((value) => {
			if (value.connectionId === this.sourceConnectionId) {
				return true;
			} else {
				return false;
			}
		});
		const connectionPassword = await azdata.connection.getCredentials(this.sourceConnectionId);

		const requestBody: StartDatabaseMigrationRequest = {
			location: this._migrationController?.properties.location!,
			properties: {
				SourceDatabaseName: currentConnection?.databaseName!,
				MigrationController: this._migrationController?.id!,
				BackupConfiguration: {
					TargetLocation: {
						StorageAccountResourceId: this._databaseBackup.storageAccount.id,
						AccountKey: this._databaseBackup.storageKey,
					},
					SourceLocation: {
						FileShare: {
							Path: this._databaseBackup.networkShareLocation,
							Username: this._databaseBackup.windowsUser,
							Password: this._databaseBackup.password,
						}
					},
				},
				SourceSqlConnection: {
					DataSource: currentConnection?.serverName!,
					Username: currentConnection?.userName!,
					Password: connectionPassword.password
				},
				Scope: this._targetManagedInstance.id
			}
		};

		const response = await startDatabaseMigration(
			this._azureAccount,
			this._targetSubscription,
			this._targetManagedInstance.resourceGroup!,
			this._migrationController?.properties.location!,
			this._targetManagedInstance.name,
			this._migrationController?.name!,
			requestBody
		);

		if (response.status === 201) {
			MigrationLocalStorage.saveMigration(
				currentConnection!,
				response.databaseMigration,
				this._targetManagedInstance,
				this._azureAccount,
				this._targetSubscription,
				this._migrationController
			);
		}

		vscode.window.showInformationMessage(constants.MIGRATION_STARTED);
	}
}
