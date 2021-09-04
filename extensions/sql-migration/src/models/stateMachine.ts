/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from 'azureResource';
import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { getAvailableManagedInstanceProducts, getAvailableStorageAccounts, getBlobContainers, getFileShares, getSqlMigrationServices, getSubscriptions, SqlMigrationService, SqlManagedInstance, startDatabaseMigration, StartDatabaseMigrationRequest, StorageAccount, getAvailableSqlVMs, SqlVMServer, getLocations, getResourceGroups, getLocationDisplayName, getSqlManagedInstanceDatabases } from '../api/azure';
import { SKURecommendations } from './externalContract';
import * as constants from '../constants/strings';
import { MigrationLocalStorage } from './migrationLocalStorage';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

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

export enum MigrationTargetType {
	SQLVM = 'AzureSqlVirtualMachine',
	SQLMI = 'AzureSqlManagedInstance',
	SQLDB = 'AzureSqlDatabase'
}

export enum MigrationSourceAuthenticationType {
	Integrated = 'WindowsAuthentication',
	Sql = 'SqlAuthentication'
}

export enum MigrationMode {
	ONLINE,
	OFFLINE
}

export enum NetworkContainerType {
	FILE_SHARE,
	BLOB_CONTAINER,
	NETWORK_SHARE
}

export interface DatabaseBackupModel {
	migrationMode: MigrationMode;
	networkContainerType: NetworkContainerType;
	networkShare: NetworkShare;
	subscription: azureResource.AzureResourceSubscription;
	blobs: Blob[];
}

export interface NetworkShare {
	networkShareLocation: string;
	windowsUser: string;
	password: string;
	resourceGroup: azureResource.AzureResourceResourceGroup;
	storageAccount: StorageAccount;
	storageKey: string;
}

export interface Blob {
	resourceGroup: azureResource.AzureResourceResourceGroup;
	storageAccount: StorageAccount;
	blobContainer: azureResource.BlobContainer;
	storageKey: string;
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
	public _accountTenants!: azurecore.Tenant[];

	public _connecionProfile!: azdata.connection.ConnectionProfile;
	public _authenticationType!: MigrationSourceAuthenticationType;
	public _sqlServerUsername!: string;
	public _sqlServerPassword!: string;

	public _subscriptions!: azureResource.AzureResourceSubscription[];

	public _targetSubscription!: azureResource.AzureResourceSubscription;
	public _locations!: azureResource.AzureLocation[];
	public _location!: azureResource.AzureLocation;
	public _resourceGroups!: azureResource.AzureResourceResourceGroup[];
	public _resourceGroup!: azureResource.AzureResourceResourceGroup;
	public _targetManagedInstances!: SqlManagedInstance[];
	public _targetSqlVirtualMachines!: SqlVMServer[];
	public _targetServerInstance!: SqlManagedInstance | SqlVMServer;
	public _databaseBackup!: DatabaseBackupModel;
	public _migrationDbs: string[] = [];
	public _storageAccounts!: StorageAccount[];
	public _fileShares!: azureResource.FileShare[];
	public _blobContainers!: azureResource.BlobContainer[];
	public _refreshNetworkShareLocation!: azureResource.BlobContainer[];
	public _targetDatabaseNames!: string[];
	public _serverDatabases!: string[];

	public _sqlMigrationServiceResourceGroup!: string;
	public _sqlMigrationService!: SqlMigrationService;
	public _sqlMigrationServices!: SqlMigrationService[];
	public _nodeNames!: string[];

	private _stateChangeEventEmitter = new vscode.EventEmitter<StateChangeEvent>();
	private _currentState: State;
	private _gatheringInformationError: string | undefined;

	private _skuRecommendations: SKURecommendations | undefined;
	public _assessmentResults!: ServerAssessement;
	public _vmDbs: string[] = [];
	public _miDbs: string[] = [];
	public _targetType!: MigrationTargetType;
	public refreshDatabaseBackupPage!: boolean;

	constructor(
		private readonly _extensionContext: vscode.ExtensionContext,
		private readonly _sourceConnectionId: string,
		public readonly migrationService: mssql.ISqlMigrationService
	) {
		this._currentState = State.INIT;
		this._databaseBackup = {} as DatabaseBackupModel;
		this._databaseBackup.networkShare = {} as NetworkShare;
		this._databaseBackup.blobs = [];
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

	public async getServerAssessments(): Promise<ServerAssessement> {
		const excludeDbs: string[] = [
			'master',
			'tempdb',
			'msdb',
			'model'
		];

		const ownerUri = await azdata.connection.getUriForConnection(this.sourceConnectionId);

		const assessmentResults = await this.migrationService.getAssessments(
			ownerUri
		);
		this._serverDatabases = await (await azdata.connection.listDatabases(this.sourceConnectionId)).filter((name) => !excludeDbs.includes(name));
		const dbAssessments = assessmentResults?.assessmentResult.databases.filter(d => !excludeDbs.includes(d.name)).map(d => {
			return {
				name: d.name,
				issues: d.items.filter(i => i.appliesToMigrationTargetPlatform === MigrationTargetType.SQLMI) ?? []
			};
		});

		this._assessmentResults = {
			issues: assessmentResults?.assessmentResult.items?.filter(i => i.appliesToMigrationTargetPlatform === MigrationTargetType.SQLMI) ?? [],
			databaseAssessments: dbAssessments! ?? []
		};

		return this._assessmentResults;
	}

	public getDatabaseAssessments(databaseName: string): mssql.SqlMigrationAssessmentResultItem[] | undefined {
		return this._assessmentResults.databaseAssessments.find(databaseAsssessment => databaseAsssessment.name === databaseName)?.issues;
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

	public getTenantValues(): azdata.CategoryValue[] {
		return this._accountTenants.map(tenant => {
			return {
				displayName: tenant.displayName,
				name: tenant.id
			};
		});
	}

	public getTenant(index: number): azurecore.Tenant {
		return this._accountTenants[index];
	}

	public async getSourceConnectionProfile(): Promise<azdata.connection.ConnectionProfile> {
		const sqlConnections = await azdata.connection.getConnections();
		return sqlConnections.find((value) => {
			if (value.connectionId === this.sourceConnectionId) {
				return true;
			} else {
				return false;
			}
		})!;
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

	public async getAzureLocationDropdownValues(subscription: azureResource.AzureResourceSubscription): Promise<azdata.CategoryValue[]> {
		let locationValues: azdata.CategoryValue[] = [];
		try {
			this._locations = await getLocations(this._azureAccount, subscription);
			this._locations.forEach((loc) => {
				locationValues.push({
					name: loc.name,
					displayName: loc.displayName
				});
			});

			if (locationValues.length === 0) {
				locationValues = [
					{
						displayName: constants.INVALID_LOCATION_ERROR,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			locationValues = [
				{
					displayName: constants.INVALID_LOCATION_ERROR,
					name: ''
				}
			];
		}

		return locationValues;
	}

	public getLocation(index: number): azureResource.AzureLocation {
		return this._locations[index];
	}

	public getLocationDisplayName(location: string): Promise<string> {
		return getLocationDisplayName(location);
	}

	public async getAzureResourceGroupDropdownValues(subscription: azureResource.AzureResourceSubscription): Promise<azdata.CategoryValue[]> {
		let resourceGroupValues: azdata.CategoryValue[] = [];
		try {
			this._resourceGroups = await getResourceGroups(this._azureAccount, subscription);
			this._resourceGroups.forEach((rg) => {
				resourceGroupValues.push({
					name: rg.id,
					displayName: rg.name
				});
			});

			if (resourceGroupValues.length === 0) {
				resourceGroupValues = [
					{
						displayName: constants.RESOURCE_GROUP_NOT_FOUND,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			resourceGroupValues = [
				{
					displayName: constants.RESOURCE_GROUP_NOT_FOUND,
					name: ''
				}
			];
		}
		return resourceGroupValues;
	}

	public getAzureResourceGroup(index: number): azureResource.AzureResourceResourceGroup {
		return this._resourceGroups[index];
	}


	public async getManagedInstanceValues(subscription: azureResource.AzureResourceSubscription, location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {
		let managedInstanceValues: azdata.CategoryValue[] = [];
		if (!this._azureAccount) {
			return managedInstanceValues;
		}
		try {
			this._targetManagedInstances = (await getAvailableManagedInstanceProducts(this._azureAccount, subscription)).filter((mi) => {
				if (mi.location.toLowerCase() === location.name.toLowerCase() && mi.resourceGroup?.toLowerCase() === resourceGroup.name.toLowerCase()) {
					return true;
				}
				return false;
			});
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

	public async getManagedDatabases(): Promise<string[]> {
		return (await getSqlManagedInstanceDatabases(this._azureAccount,
			this._targetSubscription,
			<SqlManagedInstance>this._targetServerInstance)).map(t => t.name);
	}

	public async getSqlVirtualMachineValues(subscription: azureResource.AzureResourceSubscription, location: azureResource.AzureLocation, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {
		let virtualMachineValues: azdata.CategoryValue[] = [];
		try {
			this._targetSqlVirtualMachines = (await getAvailableSqlVMs(this._azureAccount, subscription, resourceGroup)).filter((virtualMachine) => {
				if (virtualMachine.location === location.name) {
					if (virtualMachine.properties.sqlImageOffer) {
						return virtualMachine.properties.sqlImageOffer.toLowerCase().includes('-ws'); //filtering out all non windows sql vms.
					}
					return true; // Returning all VMs that don't have this property as we don't want to accidentally skip valid vms.
				}
				return false;
			});
			virtualMachineValues = this._targetSqlVirtualMachines.map((virtualMachine) => {
				return {
					name: virtualMachine.id,
					displayName: `${virtualMachine.name}`
				};
			});

			if (virtualMachineValues.length === 0) {
				virtualMachineValues = [
					{
						displayName: constants.NO_VIRTUAL_MACHINE_FOUND,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			virtualMachineValues = [
				{
					displayName: constants.NO_VIRTUAL_MACHINE_FOUND,
					name: ''
				}
			];
		}
		return virtualMachineValues;
	}

	public getVirtualMachine(index: number): SqlVMServer {
		return this._targetSqlVirtualMachines[index];
	}

	public async getStorageAccountValues(subscription: azureResource.AzureResourceSubscription, resourceGroup: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {
		let storageAccountValues: azdata.CategoryValue[] = [];
		if (!resourceGroup) {
			return storageAccountValues;
		}
		try {
			const storageAccount = (await getAvailableStorageAccounts(this._azureAccount, subscription));
			this._storageAccounts = storageAccount.filter(sa => {
				return sa.location.toLowerCase() === this._targetServerInstance.location.toLowerCase() && sa.resourceGroup?.toLowerCase() === resourceGroup.name.toLowerCase();
			});
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


	public async getSqlMigrationServiceValues(subscription: azureResource.AzureResourceSubscription, managedInstance: SqlManagedInstance, resourceGroupName: string): Promise<azdata.CategoryValue[]> {
		let sqlMigrationServiceValues: azdata.CategoryValue[] = [];
		try {
			this._sqlMigrationServices = (await getSqlMigrationServices(this._azureAccount, subscription, managedInstance.location)).filter(sms => sms.location.toLowerCase() === this._targetServerInstance.location.toLowerCase() && sms.properties.resourceGroup.toLowerCase() === resourceGroupName?.toLowerCase());
			this._sqlMigrationServices.forEach((sqlMigrationService) => {
				sqlMigrationServiceValues.push({
					name: sqlMigrationService.id,
					displayName: `${sqlMigrationService.name}`
				});
			});

			if (sqlMigrationServiceValues.length === 0) {
				sqlMigrationServiceValues = [
					{
						displayName: constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR,
						name: ''
					}
				];
			}
		} catch (e) {
			console.log(e);
			sqlMigrationServiceValues = [
				{
					displayName: constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR,
					name: ''
				}
			];
		}
		return sqlMigrationServiceValues;
	}

	public getMigrationService(index: number): SqlMigrationService {
		return this._sqlMigrationServices[index];
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

		const requestBody: StartDatabaseMigrationRequest = {
			location: this._sqlMigrationService?.location!,
			properties: {
				sourceDatabaseName: '',
				migrationService: this._sqlMigrationService?.id!,
				backupConfiguration: {},
				sourceSqlConnection: {
					dataSource: currentConnection?.serverName!,
					authentication: this._authenticationType,
					username: this._sqlServerUsername,
					password: this._sqlServerPassword
				},
				scope: this._targetServerInstance.id
			}
		};

		for (let i = 0; i < this._migrationDbs.length; i++) {
			try {
				switch (this._databaseBackup.networkContainerType) {
					case NetworkContainerType.BLOB_CONTAINER:
						requestBody.properties.backupConfiguration = {
							targetLocation: undefined!,
							sourceLocation: {
								azureBlob: {
									storageAccountResourceId: this._databaseBackup.blobs[i].storageAccount.id,
									accountKey: this._databaseBackup.blobs[i].storageKey,
									blobContainerName: this._databaseBackup.blobs[i].blobContainer.name
								}
							}
						};
						break;
					case NetworkContainerType.NETWORK_SHARE:
						requestBody.properties.backupConfiguration = {
							targetLocation: {
								storageAccountResourceId: this._databaseBackup.networkShare.storageAccount.id,
								accountKey: this._databaseBackup.networkShare.storageKey,
							},
							sourceLocation: {
								fileShare: {
									path: this._databaseBackup.networkShare.networkShareLocation,
									username: this._databaseBackup.networkShare.windowsUser,
									password: this._databaseBackup.networkShare.password,
								}
							}
						};
						break;
				}
				requestBody.properties.sourceDatabaseName = this._migrationDbs[i];
				const response = await startDatabaseMigration(
					this._azureAccount,
					this._targetSubscription,
					this._sqlMigrationService?.location!,
					this._targetServerInstance,
					this._targetDatabaseNames[i],
					requestBody
				);
				response.databaseMigration.properties.sourceDatabaseName = this._migrationDbs[i];
				response.databaseMigration.properties.backupConfiguration = requestBody.properties.backupConfiguration!;
				if (response.status === 201 || response.status === 200) {
					MigrationLocalStorage.saveMigration(
						currentConnection!,
						response.databaseMigration,
						this._targetServerInstance,
						this._azureAccount,
						this._targetSubscription,
						this._sqlMigrationService,
						response.asyncUrl
					);
					vscode.window.showInformationMessage(localize("sql.migration.starting.migration.message", 'Starting migration for database {0} to {1} - {2}', this._migrationDbs[i], this._targetServerInstance.name, this._targetDatabaseNames[i]));
				}
			} catch (e) {
				vscode.window.showErrorMessage(
					localize('sql.migration.starting.migration.error', "An error occurred while starting the migration: '{0}'", e.message));
				console.log(e);
			}

			vscode.commands.executeCommand('sqlmigration.refreshMigrationTiles');
		}
	}
}

export interface ServerAssessement {
	issues: mssql.SqlMigrationAssessmentResultItem[];
	databaseAssessments: {
		name: string;
		issues: mssql.SqlMigrationAssessmentResultItem[];
	}[];
}
