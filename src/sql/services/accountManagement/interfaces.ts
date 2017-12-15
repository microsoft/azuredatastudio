/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as data from 'data';
import Event from 'vs/base/common/event';
import { AccountAdditionResult, AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'accountManagementService';

export const IAccountManagementService = createDecorator<IAccountManagementService>(SERVICE_ID);

export interface IAccountManagementService {
	_serviceBrand: any;

	// ACCOUNT MANAGEMENT METHODS //////////////////////////////////////////
	accountUpdated(account: data.Account): Thenable<void>;
	addAccount(providerId: string): Thenable<void>;
	getAccountProviderMetadata(): Thenable<data.AccountProviderMetadata[]>;
	getAccountsForProvider(providerId: string): Thenable<data.Account[]>;
	getSecurityToken(account: data.Account): Thenable<{}>;
	removeAccount(accountKey: data.AccountKey): Thenable<boolean>;
	refreshAccount(account: data.Account): Thenable<data.Account>;

	// UI METHODS //////////////////////////////////////////////////////////
	openAccountListDialog(): Thenable<void>;
	beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void>;
	endAutoOAuthDeviceCode(): void;
	cancelAutoOAuthDeviceCode(providerId: string): void;
	copyUserCodeAndOpenBrowser(userCode: string, uri: string): void;

	// SERVICE MANAGEMENT METHODS /////////////////////////////////////////
	registerProvider(providerMetadata: data.AccountProviderMetadata, provider: data.AccountProvider): void;
	shutdown(): void;
	unregisterProvider(providerMetadata: data.AccountProviderMetadata): void;

	// EVENTING ////////////////////////////////////////////////////////////
	readonly addAccountProviderEvent: Event<AccountProviderAddedEventParams>;
	readonly removeAccountProviderEvent: Event<data.AccountProviderMetadata>;
	readonly updateAccountListEvent: Event<UpdateAccountListEventParams>;
}

export interface IAccountStore {
	/**
	 * Adds the provided account if the account doesn't exist. Updates the account if it already exists
	 * @param {Account} account Account to add/update
	 * @return {Thenable<AccountAdditionResult>} Results of the add/update operation
	 */
	addOrUpdate(account: data.Account): Thenable<AccountAdditionResult>;

	/**
	 * Retrieves all accounts, filtered by provider ID
	 * @param {string} providerId ID of the provider to filter by
	 * @return {Thenable<Account[]>} Promise to return all accounts that belong to the provided provider
	 */
	getAccountsByProvider(providerId: string): Thenable<data.Account[]>;

	/**
	 * Retrieves all accounts in the store. Returns empty array if store is not initialized
	 * @return {Thenable<Account[]>} Promise to return all accounts
	 */
	getAllAccounts(): Thenable<data.Account[]>;

	/**
	 * Removes an account.
	 * Returns false if the account was not found.
	 * Otherwise, returns true.
	 * @param key - The key of an account.
	 * @returns	True if the account was removed, false if the account doesn't exist
	 */
	remove(key: data.AccountKey): Thenable<boolean>;

	/**
	 * Updates the custom properties stored with an account.
	 * Returns null if no account was found to update.
	 * Otherwise, returns a new updated account instance.
	 * @param key - The key of an account.
	 * @param updateOperation - Operation to perform on the matching account
	 * @returns True if the account was modified, false if the account doesn't exist
	 */
	update(key: data.AccountKey, updateOperation: (account: data.Account) => void): Thenable<boolean>;
}
