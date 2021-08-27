/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Event } from 'vs/base/common/event';
import { AccountAdditionResult, AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'accountManagementService';

export const IAccountManagementService = createDecorator<IAccountManagementService>(SERVICE_ID);

export interface IAccountManagementService {
	_serviceBrand: undefined;

	// ACCOUNT MANAGEMENT METHODS //////////////////////////////////////////
	accountUpdated(account: azdata.Account): Promise<void>;
	addAccount(providerId: string): Promise<void>;
	getAccountProviderMetadata(): Promise<azdata.AccountProviderMetadata[]>;
	getAccountsForProvider(providerId: string): Promise<azdata.Account[]>;
	getAccounts(): Promise<azdata.Account[]>;
	/**
	 * @deprecated
	 */
	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<{ [key: string]: { token: string } } | undefined>;
	getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource): Promise<{ token: string, azureAccountTokenExpiresOn: number } | undefined>;
	removeAccount(accountKey: azdata.AccountKey): Promise<boolean>;
	removeAccounts(): Promise<boolean>;
	refreshAccount(account: azdata.Account): Promise<azdata.Account>;

	// UI METHODS //////////////////////////////////////////////////////////
	openAccountListDialog(): Promise<void>;
	beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Promise<void>;
	endAutoOAuthDeviceCode(): void;
	cancelAutoOAuthDeviceCode(providerId: string): void;
	copyUserCodeAndOpenBrowser(userCode: string, uri: string): void;

	// SERVICE MANAGEMENT METHODS /////////////////////////////////////////
	registerProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): void;
	unregisterProvider(providerMetadata: azdata.AccountProviderMetadata): void;

	// EVENTING ////////////////////////////////////////////////////////////
	readonly addAccountProviderEvent: Event<AccountProviderAddedEventParams>;
	readonly removeAccountProviderEvent: Event<azdata.AccountProviderMetadata>;
	readonly updateAccountListEvent: Event<UpdateAccountListEventParams>;
}

// API sqlExtHostTypes.ts > AzureResource should also be updated
// Enum matching the AzureResource enum from azdata.d.ts
export enum AzureResource {
	ResourceManagement = 0,
	Sql = 1,
	OssRdbms = 2,
	AzureKeyVault = 3,
	Graph = 4,
	MicrosoftResourceManagement = 5,
	AzureDevOps = 6,
	MsGraph = 7,
	AzureLogAnalytics = 8
}

export interface IAccountStore {
	/**
	 * Adds the provided account if the account doesn't exist. Updates the account if it already exists
	 * @param account Account to add/update
	 * @return Results of the add/update operation
	 */
	addOrUpdate(account: azdata.Account): Promise<AccountAdditionResult>;

	/**
	 * Retrieves all accounts, filtered by provider ID
	 * @param providerId ID of the provider to filter by
	 * @return Promise to return all accounts that belong to the provided provider
	 */
	getAccountsByProvider(providerId: string): Promise<azdata.Account[]>;

	/**
	 * Retrieves all accounts in the store. Returns empty array if store is not initialized
	 * @return Promise to return all accounts
	 */
	getAllAccounts(): Promise<azdata.Account[]>;

	/**
	 * Removes an account.
	 * Returns false if the account was not found.
	 * Otherwise, returns true.
	 * @param key - The key of an account.
	 * @returns	True if the account was removed, false if the account doesn't exist
	 */
	remove(key: azdata.AccountKey): Promise<boolean>;

	/**
	 * Updates the custom properties stored with an account.
	 * Returns null if no account was found to update.
	 * Otherwise, returns a new updated account instance.
	 * @param key - The key of an account.
	 * @param updateOperation - Operation to perform on the matching account
	 * @returns True if the account was modified, false if the account doesn't exist
	 */
	update(key: azdata.AccountKey, updateOperation: (account: azdata.Account) => void): Promise<boolean>;
}
