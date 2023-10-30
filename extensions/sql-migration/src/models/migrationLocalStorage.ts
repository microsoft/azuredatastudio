/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as azurecore from 'azurecore';
import { DatabaseMigration, SqlMigrationService, getSubscriptions, getServiceMigrations } from '../api/azure';
import { deepClone, isAccountTokenStale } from '../api/utils';
import * as loc from '../constants/strings';
import { ServiceContextChangeEvent } from '../dashboard/tabBase';
import { getSourceConnectionProfile } from '../api/sqlUtils';

export class MigrationLocalStorage {
	private static context: vscode.ExtensionContext;
	private static mementoToken: string = 'sqlmigration.databaseMigrations';

	public static setExtensionContext(context: vscode.ExtensionContext): void {
		MigrationLocalStorage.context = context;
	}

	public static async getMigrationServiceContext(): Promise<MigrationServiceContext> {
		const connectionProfile = await getSourceConnectionProfile();
		if (connectionProfile) {
			const serverContextKey = `${this.mementoToken}.${connectionProfile.serverName}.serviceContext`;
			return deepClone(await this.context.globalState.get(serverContextKey)) || {};
		}
		return {};
	}

	public static async saveMigrationServiceContext(serviceContext: MigrationServiceContext, serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>): Promise<void> {
		const connectionProfile = await getSourceConnectionProfile();
		if (connectionProfile) {
			const serverContextKey = `${this.mementoToken}.${connectionProfile.serverName}.serviceContext`;
			await this.context.globalState.update(serverContextKey, deepClone(serviceContext));
			serviceContextChangedEvent.fire({ connectionId: connectionProfile.connectionId });
		}
	}

	public static async refreshMigrationAzureAccount(serviceContext: MigrationServiceContext, migration: DatabaseMigration, serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>): Promise<void> {
		if (isAccountTokenStale(serviceContext.azureAccount)) {
			const accounts = await azdata.accounts.getAllAccounts();
			const account = accounts.find(a => !isAccountTokenStale(a) && a.key.accountId === serviceContext.azureAccount?.key.accountId);
			if (account) {
				const subscriptions = await getSubscriptions(account);
				const subscription = subscriptions.find(s => s.id === serviceContext.subscription?.id);
				if (subscription) {
					serviceContext.azureAccount = account;
					await this.saveMigrationServiceContext(serviceContext, serviceContextChangedEvent);
				}
			}
		}
	}
}

export function isServiceContextValid(serviceContext: MigrationServiceContext): boolean {
	return (
		!isAccountTokenStale(serviceContext.azureAccount) &&
		serviceContext.location?.id !== undefined &&
		serviceContext.migrationService?.id !== undefined &&
		serviceContext.resourceGroup?.id !== undefined &&
		serviceContext.subscription?.id !== undefined &&
		serviceContext.tenant?.id !== undefined
	);
}

export async function getSelectedServiceStatus(): Promise<string> {
	const serviceContext = await MigrationLocalStorage.getMigrationServiceContext();
	const serviceName = serviceContext?.migrationService?.name;
	return serviceName && isServiceContextValid(serviceContext)
		? loc.MIGRATION_SERVICE_SERVICE_PROMPT(serviceName)
		: loc.MIGRATION_SERVICE_SELECT_SERVICE_PROMPT;
}

export async function getCurrentMigrations(): Promise<DatabaseMigration[]> {
	const serviceContext = await MigrationLocalStorage.getMigrationServiceContext();
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
	subscription?: azurecore.azureResource.AzureResourceSubscription,
	location?: azurecore.azureResource.AzureLocation,
	resourceGroup?: azurecore.azureResource.AzureResourceResourceGroup,
	migrationService?: SqlMigrationService,
}
