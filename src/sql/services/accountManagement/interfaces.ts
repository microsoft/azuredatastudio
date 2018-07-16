/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import Event from 'vs/base/common/event';
import { AccountAdditionResult, AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'accountManagementService';

export const IAccountManagementService = createDecorator<IAccountManagementService>(SERVICE_ID);

export interface IAccountManagementService {
	_serviceBrand: any;

	// ACCOUNT MANAGEMENT METHODS //////////////////////////////////////////
	accountUpdated(account: sqlops.Account): Thenable<void>;
	addAccount(providerId: string): Thenable<void>;
	getAccountProviderMetadata(): Thenable<sqlops.AccountProviderMetadata[]>;
	getAccountsForProvider(providerId: string): Thenable<sqlops.Account[]>;
	getSecurityToken(account: sqlops.Account): Thenable<{}>;
	removeAccount(accountKey: sqlops.AccountKey): Thenable<boolean>;
	refreshAccount(account: sqlops.Account): Thenable<sqlops.Account>;

	// UI METHODS //////////////////////////////////////////////////////////
	openAccountListDialog(): Thenable<void>;
	beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void>;
	endAutoOAuthDeviceCode(): void;
	cancelAutoOAuthDeviceCode(providerId: string): void;
	copyUserCodeAndOpenBrowser(userCode: string, uri: string): void;

	// SERVICE MANAGEMENT METHODS /////////////////////////////////////////
	registerProvider(providerMetadata: sqlops.AccountProviderMetadata, provider: sqlops.AccountProvider): void;
	shutdown(): void;
	unregisterProvider(providerMetadata: sqlops.AccountProviderMetadata): void;

	// EVENTING ////////////////////////////////////////////////////////////
	readonly addAccountProviderEvent: Event<AccountProviderAddedEventParams>;
	readonly removeAccountProviderEvent: Event<sqlops.AccountProviderMetadata>;
	readonly updateAccountListEvent: Event<UpdateAccountListEventParams>;
}

export interface IAccountStore {
	/**
	 * Adds the provided account if the account doesn't exist. Updates the account if it already exists
	 * @param {Account} account Account to add/update
	 * @return {Thenable<AccountAdditionResult>} Results of the add/update operation
	 */
	addOrUpdate(account: sqlops.Account): Thenable<AccountAdditionResult>;

	/**
	 * Retrieves all accounts, filtered by provider ID
	 * @param {string} providerId ID of the provider to filter by
	 * @return {Thenable<Account[]>} Promise to return all accounts that belong to the provided provider
	 */
	getAccountsByProvider(providerId: string): Thenable<sqlops.Account[]>;

	/**
	 * Retrieves all accounts in the store. Returns empty array if store is not initialized
	 * @return {Thenable<Account[]>} Promise to return all accounts
	 */
	getAllAccounts(): Thenable<sqlops.Account[]>;

	/**
	 * Removes an account.
	 * Returns false if the account was not found.
	 * Otherwise, returns true.
	 * @param key - The key of an account.
	 * @returns	True if the account was removed, false if the account doesn't exist
	 */
	remove(key: sqlops.AccountKey): Thenable<boolean>;

	/**
	 * Updates the custom properties stored with an account.
	 * Returns null if no account was found to update.
	 * Otherwise, returns a new updated account instance.
	 * @param key - The key of an account.
	 * @param updateOperation - Operation to perform on the matching account
	 * @returns True if the account was modified, false if the account doesn't exist
	 */
	update(key: sqlops.AccountKey, updateOperation: (account: sqlops.Account) => void): Thenable<boolean>;
}
