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
	accountUpdated(account: azdata.Account): Thenable<void>;
	addAccount(providerId: string): Thenable<void>;
	getAccountProviderMetadata(): Thenable<azdata.AccountProviderMetadata[]>;
	getAccountsForProvider(providerId: string): Thenable<azdata.Account[]>;
	getAccounts(): Thenable<azdata.Account[]>;
	/**
	 * @deprecated
	 */
	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{ [key: string]: { token: string } }>;
	getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource): Thenable<{ token: string }>;
	removeAccount(accountKey: azdata.AccountKey): Thenable<boolean>;
	removeAccounts(): Thenable<boolean>;
	refreshAccount(account: azdata.Account): Thenable<azdata.Account>;

	// UI METHODS //////////////////////////////////////////////////////////
	openAccountListDialog(): Thenable<void>;
	beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void>;
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

// Enum matching the AzureResource enum from azdata.d.ts
export enum AzureResource {
	ResourceManagement = 0,
	Sql = 1,
	OssRdbms = 2,
	AzureKeyVault = 3
}

export interface IAccountStore {
	/**
	 * Adds the provided account if the account doesn't exist. Updates the account if it already exists
	 * @param account Account to add/update
	 * @return Results of the add/update operation
	 */
	addOrUpdate(account: azdata.Account): Thenable<AccountAdditionResult>;

	/**
	 * Retrieves all accounts, filtered by provider ID
	 * @param providerId ID of the provider to filter by
	 * @return Promise to return all accounts that belong to the provided provider
	 */
	getAccountsByProvider(providerId: string): Thenable<azdata.Account[]>;

	/**
	 * Retrieves all accounts in the store. Returns empty array if store is not initialized
	 * @return Promise to return all accounts
	 */
	getAllAccounts(): Thenable<azdata.Account[]>;

	/**
	 * Removes an account.
	 * Returns false if the account was not found.
	 * Otherwise, returns true.
	 * @param key - The key of an account.
	 * @returns	True if the account was removed, false if the account doesn't exist
	 */
	remove(key: azdata.AccountKey): Thenable<boolean>;

	/**
	 * Updates the custom properties stored with an account.
	 * Returns null if no account was found to update.
	 * Otherwise, returns a new updated account instance.
	 * @param key - The key of an account.
	 * @param updateOperation - Operation to perform on the matching account
	 * @returns True if the account was modified, false if the account doesn't exist
	 */
	update(key: azdata.AccountKey, updateOperation: (account: azdata.Account) => void): Thenable<boolean>;
}
