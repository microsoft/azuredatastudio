/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { logError, sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../telemtery';
import { DatabaseMigration, SqlMigrationService, SqlManagedInstance, getMigrationStatus, AzureAsyncOperationResource, getMigrationAsyncOperationDetails, SqlVMServer, getSubscriptions } from '../api/azure';
import * as azdata from 'azdata';

export class MigrationLocalStorage {
	private static context: vscode.ExtensionContext;
	private static mementoToken: string = 'sqlmigration.databaseMigrations';

	public static setExtensionContext(context: vscode.ExtensionContext): void {
		MigrationLocalStorage.context = context;
	}

	public static async getMigrationsBySourceConnections(connectionProfile: azdata.connection.ConnectionProfile, refreshStatus?: boolean): Promise<MigrationContext[]> {
		const undefinedSessionId = '{undefined}';
		const result: MigrationContext[] = [];
		const validMigrations: MigrationContext[] = [];
		const startTime = new Date().toString();
		// fetch saved migrations
		const migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
		for (let i = 0; i < migrationMementos.length; i++) {
			const migration = migrationMementos[i];
			migration.migrationContext = this.removeMigrationSecrets(migration.migrationContext);
			migration.sessionId = migration.sessionId ?? undefinedSessionId;
			if (migration.sourceConnectionProfile.serverName === connectionProfile.serverName) {
				// refresh migration status
				if (refreshStatus) {
					try {
						await this.refreshMigrationAzureAccount(migration);

						if (migration.asyncUrl) {
							migration.asyncOperationResult = await getMigrationAsyncOperationDetails(
								migration.azureAccount,
								migration.subscription,
								migration.asyncUrl,
								migration.sessionId!);
						}

						migration.migrationContext = await getMigrationStatus(
							migration.azureAccount,
							migration.subscription,
							migration.migrationContext,
							migration.sessionId!);
					}
					catch (e) {
						// Keeping only valid migrations in cache. Clearing all the migrations which return ResourceDoesNotExit error.
						switch (e.message) {
							case 'ResourceDoesNotExist':
							case 'NullMigrationId':
								continue;
							default:
								logError(TelemetryViews.MigrationLocalStorage, 'MigrationBySourceConnectionError', e);
						}
					}
				}
				result.push(migration);
			}
			validMigrations.push(migration);
		}

		await this.context.globalState.update(this.mementoToken, validMigrations);

		sendSqlMigrationActionEvent(
			TelemetryViews.MigrationLocalStorage,
			TelemetryAction.Done,
			{
				'startTime': startTime,
				'endTime': new Date().toString()
			},
			{
				'migrationCount': migrationMementos.length
			}
		);

		// only save updated migration context
		if (refreshStatus) {
			const migrations: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
			validMigrations.forEach(migration => {
				const idx = migrations.findIndex(m => m.migrationContext.id === migration.migrationContext.id);
				if (idx > -1) {
					migrations[idx] = migration;
				}
			});

			// check global state for migrations count mismatch, avoid saving
			// state if the count has changed when a migration may have been added
			const current: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
			if (current.length === migrations.length) {
				await this.context.globalState.update(this.mementoToken, migrations);
			}
		}
		return result;
	}

	public static async refreshMigrationAzureAccount(migration: MigrationContext): Promise<void> {
		if (migration.azureAccount.isStale) {
			const accounts = await azdata.accounts.getAllAccounts();
			const account = accounts.find(a => !a.isStale && a.key.accountId === migration.azureAccount.key.accountId);
			if (account) {
				const subscriptions = await getSubscriptions(account);
				const subscription = subscriptions.find(s => s.id === migration.subscription.id);
				if (subscription) {
					migration.azureAccount = account;
				}
			}
		}
	}

	public static async saveMigration(
		connectionProfile: azdata.connection.ConnectionProfile,
		migrationContext: DatabaseMigration,
		targetMI: SqlManagedInstance | SqlVMServer,
		azureAccount: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		controller: SqlMigrationService,
		asyncURL: string,
		sessionId: string): Promise<void> {
		try {
			let migrationMementos: MigrationContext[] = this.context.globalState.get(this.mementoToken) || [];
			migrationMementos = migrationMementos.filter(m => m.migrationContext.id !== migrationContext.id);
			migrationMementos.push({
				sourceConnectionProfile: connectionProfile,
				migrationContext: this.removeMigrationSecrets(migrationContext),
				targetManagedInstance: targetMI,
				subscription: subscription,
				azureAccount: azureAccount,
				controller: controller,
				asyncUrl: asyncURL,
				sessionId: sessionId
			});
			await this.context.globalState.update(this.mementoToken, migrationMementos);
		} catch (e) {
			logError(TelemetryViews.MigrationLocalStorage, 'CantSaveMigration', e);
		}
	}

	public static async clearMigrations(): Promise<void> {
		await this.context.globalState.update(this.mementoToken, ([] as MigrationContext[]));
	}

	public static removeMigrationSecrets(migration: DatabaseMigration): DatabaseMigration {
		// remove secrets from migration context
		if (migration.properties.sourceSqlConnection?.password) {
			migration.properties.sourceSqlConnection.password = '';
		}
		if (migration.properties.backupConfiguration?.sourceLocation?.fileShare?.password) {
			migration.properties.backupConfiguration.sourceLocation.fileShare.password = '';
		}
		if (migration.properties.backupConfiguration?.sourceLocation?.azureBlob?.accountKey) {
			migration.properties.backupConfiguration.sourceLocation.azureBlob.accountKey = '';
		}
		if (migration.properties.backupConfiguration?.targetLocation?.accountKey) {
			migration.properties.backupConfiguration.targetLocation.accountKey = '';
		}
		return migration;
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

export enum MigrationStatus {
	Failed = 'Failed',
	Succeeded = 'Succeeded',
	InProgress = 'InProgress',
	Canceled = 'Canceled',
	Completing = 'Completing',
	Creating = 'Creating',
	Canceling = 'Canceling'
}

export enum ProvisioningState {
	Failed = 'Failed',
	Succeeded = 'Succeeded',
	Creating = 'Creating'
}

export enum BackupFileInfoStatus {
	Arrived = 'Arrived',
	Uploading = 'Uploading',
	Uploaded = 'Uploaded',
	Restoring = 'Restoring',
	Restored = 'Restored',
	Canceled = 'Canceled',
	Ignored = 'Ignored'
}
