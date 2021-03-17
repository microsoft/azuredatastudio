/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { DatabaseMigration, SqlMigrationService, SqlManagedInstance, getDatabaseMigration } from '../api/azure';
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
						migration.migrationContext = await getDatabaseMigration(
							migration.azureAccount,
							migration.subscription,
							migration.targetManagedInstance.location,
							migration.migrationContext.id
						);
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
		targetMI: SqlManagedInstance,
		azureAccount: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		controller: SqlMigrationService): void {
		try {
			const migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
			migrationMementos.push({
				sourceConnectionProfile: connectionProfile,
				migrationContext: migrationContext,
				targetManagedInstance: targetMI,
				subscription: subscription,
				azureAccount: azureAccount,
				controller: controller
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
	targetManagedInstance: SqlManagedInstance,
	azureAccount: azdata.Account,
	subscription: azureResource.AzureResourceSubscription,
	controller: SqlMigrationService
}
