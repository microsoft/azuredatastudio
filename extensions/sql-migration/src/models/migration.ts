/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { DatabaseMigration, SqlManagedInstance } from '../api/azure';
import * as azdata from 'azdata';


export class Migrations {
	private static context: vscode.ExtensionContext;
	private static mementoToken: string = 'sqlmigration.databaseMigrations';

	public static setExtensionContext(context: vscode.ExtensionContext): void {
		Migrations.context = context;
	}

	public static getMigrations(connectionProfile: azdata.connection.ConnectionProfile): MigrationContext[] {

		let dataBaseMigrations: MigrationContext[] = [];
		try {
			const migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];

			dataBaseMigrations = migrationMementos.filter((memento) => {
				return memento.connection.serverName === connectionProfile.serverName;
			}).map((memento) => {
				return memento;
			});
		} catch (e) {
			console.log(e);
		}


		return dataBaseMigrations;
	}

	public static saveMigration(connection: azdata.connection.ConnectionProfile, migration: DatabaseMigration, targetMI: SqlManagedInstance, azureAccount: azdata.Account, subscription: azureResource.AzureResourceSubscription): void {
		try {
			const migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
			migrationMementos.push({
				connection: connection,
				migration: migration,
				targetMI: targetMI,
				subscription: subscription,
				azureAccount: azureAccount
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
	connection: azdata.connection.ConnectionProfile,
	migration: DatabaseMigration,
	targetMI: SqlManagedInstance,
	azureAccount: azdata.Account,
	subscription: azureResource.AzureResourceSubscription
}
