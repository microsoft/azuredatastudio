/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { DatabaseMigration, MigrationController, SqlManagedInstance } from '../api/azure';
import * as azdata from 'azdata';


export class MigrationLocalStorage {
	private static context: vscode.ExtensionContext;
	private static mementoToken: string = 'sqlmigration.databaseMigrations';

	public static setExtensionContext(context: vscode.ExtensionContext): void {
		MigrationLocalStorage.context = context;
	}

	public static getMigrations(connectionProfile: azdata.connection.ConnectionProfile): MigrationContext[] {

		let dataBaseMigrations: MigrationContext[] = [];
		try {
			const migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];

			dataBaseMigrations = migrationMementos.filter((memento) => {
				return memento.sourceConnectionProfile.serverName === connectionProfile.serverName;
			}).map((memento) => {
				return memento;
			});
		} catch (e) {
			console.log(e);
		}


		return dataBaseMigrations;
	}

	public static saveMigration(
		connectionProfile: azdata.connection.ConnectionProfile,
		migrationContext: DatabaseMigration,
		targetMI: SqlManagedInstance,
		azureAccount: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		controller: MigrationController): void {
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
	controller: MigrationController
}
