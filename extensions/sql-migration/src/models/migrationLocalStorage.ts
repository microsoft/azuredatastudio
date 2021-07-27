/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { DatabaseMigration, SqlMigrationService, SqlManagedInstance, getMigrationStatus, AzureAsyncOperationResource, getMigrationAsyncOperationDetails, SqlVMServer } from '../api/azure';
import * as azdata from 'azdata';

export class MigrationLocalStorage {
	private static context: vscode.ExtensionContext;
	private static mementoToken: string = 'sqlmigration.databaseMigrations';

	public static setExtensionContext(context: vscode.ExtensionContext): void {
		MigrationLocalStorage.context = context;
	}

	public static async getMigrationsBySourceConnections(connectionProfile: azdata.connection.ConnectionProfile, refreshStatus?: boolean): Promise<MigrationContext[]> {

		const result: MigrationContext[] = [];
		const validMigrations: MigrationContext[] = [];

		const migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
		for (let i = 0; i < migrationMementos.length; i++) {
			const migration = migrationMementos[i];
			if (migration.sourceConnectionProfile.serverName === connectionProfile.serverName) {
				if (refreshStatus) {
					try {
						const backupConfiguration = migration.migrationContext.properties.backupConfiguration;
						const sourceDatabase = migration.migrationContext.properties.sourceDatabaseName;
						migration.migrationContext = await getMigrationStatus(
							migration.azureAccount,
							migration.subscription,
							migration.migrationContext
						);
						migration.migrationContext.properties.sourceDatabaseName = sourceDatabase;
						migration.migrationContext.properties.backupConfiguration = backupConfiguration;
						if (migration.asyncUrl) {
							migration.asyncOperationResult = await getMigrationAsyncOperationDetails(
								migration.azureAccount,
								migration.subscription,
								migration.asyncUrl
							);
						}
					}
					catch (e) {
						// Keeping only valid migrations in cache. Clearing all the migrations which return ResourceDoesNotExit error.
						if (e.message === 'ResourceDoesNotExist') {
							continue;
						} else {
							console.log(e);
						}
					}
				}
				result.push(migration);
			}
			validMigrations.push(migration);
		}
		this.context.globalState.update(this.mementoToken, validMigrations);
		return result;
	}

	public static saveMigration(
		connectionProfile: azdata.connection.ConnectionProfile,
		migrationContext: DatabaseMigration,
		targetMI: SqlManagedInstance | SqlVMServer,
		azureAccount: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		controller: SqlMigrationService,
		asyncURL: string,
		sessionId: string): void {
		try {
			let migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
			migrationMementos = migrationMementos.filter(m => m.migrationContext.id !== migrationContext.id);
			migrationMementos.push({
				sourceConnectionProfile: connectionProfile,
				migrationContext: migrationContext,
				targetManagedInstance: targetMI,
				subscription: subscription,
				azureAccount: azureAccount,
				controller: controller,
				asyncUrl: asyncURL,
				sessionId: sessionId
			});
			this.context.globalState.update(this.mementoToken, migrationMementos);
		} catch (e) {
			console.log(e);
		}
	}

	public static clearMigrations() {
		this.context.globalState.update(this.mementoToken, ([] as MigrationContext[]));
	}
}

export interface MigrationContext {
	sourceConnectionProfile: azdata.connection.ConnectionProfile,
	migrationContext: DatabaseMigration,
	targetManagedInstance: SqlManagedInstance | SqlVMServer,
	azureAccount: azdata.Account,
	subscription: azureResource.AzureResourceSubscription,
	controller: SqlMigrationService,
	asyncUrl: string,
	asyncOperationResult?: AzureAsyncOperationResource,
	sessionId?: string
}
