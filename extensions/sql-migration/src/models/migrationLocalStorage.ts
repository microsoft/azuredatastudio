/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as azurecore from 'azurecore';
import { azureResource } from 'azureResource';
import { DatabaseMigration, SqlMigrationService, getSubscriptions, getServiceMigrations } from '../api/azure';
import { deepClone } from '../api/utils';
import * as loc from '../constants/strings';

export class MigrationLocalStorage {
	private static context: vscode.ExtensionContext;
	private static mementoToken: string = 'sqlmigration.databaseMigrations';

	public static setExtensionContext(context: vscode.ExtensionContext): void {
		MigrationLocalStorage.context = context;
	}

	public static async getMigrationServiceContext(connectionProfile: azdata.connection.ConnectionProfile): Promise<MigrationServiceContext> {
		const serverContextKey = `${this.mementoToken}.${connectionProfile.serverName}.serviceContext`;
		return deepClone(await this.context.globalState.get(serverContextKey)) || {};
	}

	public static async saveMigrationServiceContext(connectionProfile: azdata.connection.ConnectionProfile, serviceContext: MigrationServiceContext): Promise<void> {
		const serverContextKey = `${this.mementoToken}.${connectionProfile.serverName}.serviceContext`;
		return await this.context.globalState.update(serverContextKey, deepClone(serviceContext));
	}

	public static async refreshMigrationAzureAccount(connectionProfile: azdata.connection.ConnectionProfile, serviceContext: MigrationServiceContext, migration: DatabaseMigration): Promise<void> {
		if (serviceContext.azureAccount?.isStale) {
			const accounts = await azdata.accounts.getAllAccounts();
			const account = accounts.find(a => !a.isStale && a.key.accountId === serviceContext.azureAccount?.key.accountId);
			if (account) {
				const subscriptions = await getSubscriptions(account);
				const subscription = subscriptions.find(s => s.id === serviceContext.subscription?.id);
				if (subscription) {
					serviceContext.azureAccount = account;
					await this.saveMigrationServiceContext(connectionProfile, serviceContext);
				}
			}
		}
	}
}

export function isServiceContextValid(serviceContext: MigrationServiceContext): boolean {
	return (serviceContext.azureAccount?.isStale === false &&
		serviceContext.location?.id !== undefined &&
		serviceContext.migrationService?.id !== undefined &&
		serviceContext.resourceGroup?.id !== undefined &&
		serviceContext.subscription?.id !== undefined &&
		serviceContext.tenant?.id !== undefined);
}

export async function getSelectedServiceStatus(): Promise<string> {
	const serviceContext = await getServiceContext();
	const serviceName = serviceContext?.migrationService?.name;
	return isServiceContextValid(serviceContext)
		? `Service: ${serviceName}`
		: loc.MIGRATION_SERVICE_SELECT_SERVICE_PROMPT;
}

export async function getServiceContext(): Promise<MigrationServiceContext> {
	const connectionProfile = await azdata.connection.getCurrentConnection();
	return await MigrationLocalStorage.getMigrationServiceContext(connectionProfile);
}

export async function getCurrentMigrations(): Promise<DatabaseMigration[]> {
	const serviceContext = await getServiceContext();
	return isServiceContextValid(serviceContext)
		? await getServiceMigrations(
			serviceContext.azureAccount!,
			serviceContext.subscription!,
			serviceContext.migrationService?.id!)
		: [];
}

export interface MigrationServiceContext {
	azureAccount?: azdata.Account,
	tenant?: azurecore.Tenant,
	subscription?: azureResource.AzureResourceSubscription,
	location?: azureResource.AzureLocation,
	resourceGroup?: azureResource.AzureResourceResourceGroup,
	migrationService?: SqlMigrationService,
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
