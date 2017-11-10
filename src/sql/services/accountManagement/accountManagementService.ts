/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as data from 'data';
import * as nls from 'vs/nls';
import * as platform from 'vs/platform/registry/common/platform';
import * as statusbar from 'vs/workbench/browser/parts/statusbar/statusbar';
import AccountStore from 'sql/services/accountManagement/accountStore';
import Event, { Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { Memento, Scope as MementoScope } from 'vs/workbench/common/memento';
import { ISqlOAuthService } from 'sql/common/sqlOAuthService';
import { AccountDialogController } from 'sql/parts/accountManagement/accountDialog/accountDialogController';
import { AccountListStatusbarItem } from 'sql/parts/accountManagement/accountListStatusbar/accountListStatusbarItem';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { warn } from 'sql/base/common/log';

export class AccountManagementService implements IAccountManagementService {
	// CONSTANTS ///////////////////////////////////////////////////////////
	private static ACCOUNT_MEMENTO = 'AccountManagement';

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	public _providers: { [id: string]: AccountProviderWithMetadata } = {};
	public _serviceBrand: any;
	private _accountStore: AccountStore;
	private _accountDialogController: AccountDialogController;
	private _mementoContext: Memento;
	private _oAuthCallbacks: { [eventId: string]: { resolve, reject } } = {};
	private _oAuthEventId: number = 0;

	// EVENT EMITTERS //////////////////////////////////////////////////////
	private _addAccountProviderEmitter: Emitter<AccountProviderAddedEventParams>;
	public get addAccountProviderEvent(): Event<AccountProviderAddedEventParams> { return this._addAccountProviderEmitter.event; }

	private _removeAccountProviderEmitter: Emitter<data.AccountProviderMetadata>;
	public get removeAccountProviderEvent(): Event<data.AccountProviderMetadata> { return this._removeAccountProviderEmitter.event; }

	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		private _mementoObj: object,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService private _storageService: IStorageService,
		@ISqlOAuthService private _oAuthService: ISqlOAuthService
	) {
		let self = this;

		// Create the account store
		if (!this._mementoObj) {
			this._mementoContext = new Memento(AccountManagementService.ACCOUNT_MEMENTO);
			this._mementoObj = this._mementoContext.getMemento(this._storageService, MementoScope.GLOBAL);
		}
		this._accountStore = this._instantiationService.createInstance(AccountStore, this._mementoObj);

		// Setup the event emitters
		this._addAccountProviderEmitter = new Emitter<AccountProviderAddedEventParams>();
		this._removeAccountProviderEmitter = new Emitter<data.AccountProviderMetadata>();
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		// Register status bar item
		// FEATURE FLAG TOGGLE
		if (process.env['VSCODE_DEV']) {
			let statusbarDescriptor = new statusbar.StatusbarItemDescriptor(
				AccountListStatusbarItem,
				statusbar.StatusbarAlignment.LEFT,
				15000 /* Highest Priority */
			);
			(<statusbar.IStatusbarRegistry>platform.Registry.as(statusbar.Extensions.Statusbar)).registerStatusbarItem(statusbarDescriptor);
		}

		// Register event handler for OAuth completion
		this._oAuthService.registerOAuthCallback((event, args) => {
			self.onOAuthResponse(args);
		});
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Asks the requested provider to prompt for an account
	 * @param {string} providerId ID of the provider to ask to prompt for an account
	 * @return {Thenable<Account>} Promise to return an account
	 */
	public addAccount(providerId: string): Thenable<data.Account> {
		let self = this;

		return this.doWithProvider(providerId, (provider) => {
			return provider.provider.prompt()
				.then(account => self._accountStore.addOrUpdate(account))
				.then(result => {
					if (result.accountAdded) {
						// Add the account to the list
						provider.accounts.push(result.changedAccount);
					}
					if (result.accountModified) {
						// Find the updated account and splice the updated on in
						let indexToRemove: number = provider.accounts.findIndex(account => {
							return account.key.accountId === result.changedAccount.key.accountId;
						});
						if (indexToRemove >= 0) {
							provider.accounts.splice(indexToRemove, 1, result.changedAccount);
						}
					}

					self.fireAccountListUpdate(provider, result.accountAdded);
					return result.changedAccount;
				});
		});
	}

	/**
	 * Retrieves metadata of all providers that have been registered
	 * @returns {Thenable<AccountProviderMetadata[]>} Registered account providers
	 */
	public getAccountProviderMetadata(): Thenable<data.AccountProviderMetadata[]> {
		return Promise.resolve(Object.values(this._providers).map(provider => provider.metadata));
	}

	/**
	 * Retrieves the accounts that belong to a specific provider
	 * @param {string} providerId ID of the provider the returned accounts belong to
	 * @returns {Thenable<Account[]>} Promise to return a list of accounts
	 */
	public getAccountsForProvider(providerId: string): Thenable<data.Account[]> {
		let self = this;

		// Make sure the provider exists before attempting to retrieve accounts
		if (!this._providers[providerId]) {
			return Promise.reject(new Error(nls.localize('accountManagementNoProvider', 'Account provider does not exist'))).then();
		}

		// 1) Get the accounts from the store
		// 2) Update our local cache of accounts
		return this.doWithProvider(providerId, provider => {
			return self._accountStore.getAccountsByProvider(provider.metadata.id)
				.then(accounts => {
					self._providers[providerId].accounts = accounts;
					return accounts;
				});
		});
	}

	/**
	 * Generates a security token by asking the account's provider
	 * @param {Account} account Account to generate security token for
	 * @return {Thenable<{}>} Promise to return the security token
	 */
	public getSecurityToken(account: data.Account): Thenable<{}> {
		return this.doWithProvider(account.key.providerId, provider => {
			return provider.provider.getSecurityToken(account);
		});
	}

	/**
	 * Removes an account from the account store and clears sensitive data in the provider
	 * @param {AccountKey} accountKey Key for the account to remove
	 * @returns {Thenable<void>} Promise with result of account removal, true if account was
	 *                           removed, false otherwise.
	 */
	public removeAccount(accountKey: data.AccountKey): Thenable<boolean> {
		let self = this;

		// Step 1) Remove the account
		// Step 2) Clear the sensitive data from the provider (regardless of whether the account was removed)
		// Step 3) Update the account cache and fire an event
		return this.doWithProvider(accountKey.providerId, provider => {
			return this._accountStore.remove(accountKey)
				.then(result => {
					provider.provider.clear(accountKey);
					return result;
				})
				.then(result => {
					if (!result) {
						return result;
					}

					let indexToRemove: number = provider.accounts.findIndex(account => {
						return account.key.accountId === accountKey.accountId;
					});

					if (indexToRemove >= 0) {
						provider.accounts.splice(indexToRemove, 1);
						self.fireAccountListUpdate(provider, false);
					}
					return result;
				});
		});
	}

	// UI METHODS //////////////////////////////////////////////////////////
	/**
	 * Opens the account list dialog
	 * @return {TPromise<any>}	Promise that finishes when the account list dialog opens
	 */
	public openAccountListDialog(): Thenable<void> {
		let self = this;

		return new Promise((resolve, reject) => {
			try {
				// If the account list dialog hasn't been defined, create a new one
				if (!self._accountDialogController) {
					self._accountDialogController = self._instantiationService.createInstance(AccountDialogController);
				}

				self._accountDialogController.openAccountDialog();
				resolve();
			} catch(e) {
				reject(e);
			}
		});
	}

	/**
	 * Opens a browser window to perform the OAuth authentication
	 * @param {string} url URL to visit that will perform the OAuth authentication
	 * @param {boolean} silent Whether or not to perform authentication silently using browser's cookies
	 * @return {Thenable<string>} Promise to return a authentication token on successful authentication
	 */
	public performOAuthAuthorization(url: string, silent: boolean): Thenable<string> {
		let self = this;
		return new Promise<string>((resolve, reject) => {
			// TODO: replace with uniqid
			let eventId: string = `oauthEvent${self._oAuthEventId++}`;
			self._oAuthCallbacks[eventId] = {
				resolve: resolve,
				reject: reject
			};

			self._oAuthService.performOAuthAuthorization(eventId, url, silent);
		});
	}

	// SERVICE MANAGEMENT METHODS //////////////////////////////////////////
	/**
	 * Called by main thread to register an account provider from extension
	 * @param {data.AccountProviderMetadata} providerMetadata Metadata of the provider that is being registered
	 * @param {data.AccountProvider} provider References to the methods of the provider
	 */
	public registerProvider(providerMetadata: data.AccountProviderMetadata, provider: data.AccountProvider): Thenable<void> {
		let self = this;

		// Store the account provider
		this._providers[providerMetadata.id] = {
			metadata: providerMetadata,
			provider: provider,
			accounts: []
		};

		// Initialize the provider:
		// 1) Get all the accounts that were stored
		// 2) Give those accounts to the provider for rehydration
		// 3) Add the accounts to our local store of accounts
		// 4) Write the accounts back to the store
		// 5) Fire the event to let folks know we have another account provider now
		return this._accountStore.getAccountsByProvider(providerMetadata.id)
			.then((accounts: data.Account[]) => {
				return provider.initialize(accounts);
			})
			.then((accounts: data.Account[]) => {
				self._providers[providerMetadata.id].accounts = accounts;
				let writePromises = accounts.map(account => {
					return self._accountStore.addOrUpdate(account);
				});
				return Promise.all(writePromises);
			})
			.then(() => {
				let provider = self._providers[providerMetadata.id];
				self._addAccountProviderEmitter.fire({
					addedProvider: provider.metadata,
					initialAccounts: provider.accounts.slice(0)		// Slice here to make sure no one can modify our cache
				});
			});

		// TODO: Add stale event handling to the providers
	}

	/**
	 * Handler for when shutdown of the application occurs. Writes out the memento.
	 */
	public shutdown(): void {
		if (this._mementoContext) {
			this._mementoContext.saveMemento();
		}
	}

	public unregisterProvider(providerMetadata: data.AccountProviderMetadata): void {
		// Delete this account provider
		delete this._providers[providerMetadata.id];

		// Alert our listeners that we've removed a provider
		this._removeAccountProviderEmitter.fire(providerMetadata);
	}

	// TODO: Support for orphaned accounts (accounts with no provider)

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private doWithProvider<T>(providerId: string, op: (provider: AccountProviderWithMetadata) => Thenable<T>): Thenable<T> {
		// Make sure the provider exists before attempting to retrieve accounts
		let provider = this._providers[providerId];
		if (!provider) {
			return Promise.reject(new Error(nls.localize('accountManagementNoProvider', 'Account provider does not exist'))).then();
		}

		return op(provider);
	}

	private fireAccountListUpdate(provider: AccountProviderWithMetadata, sort: boolean) {
		// Step 1) Get and sort the list
		if (sort) {
			provider.accounts.sort((a: data.Account, b: data.Account) => {
				if (a.displayInfo.displayName < b.displayInfo.displayName) {
					return -1;
				}
				if (a.displayInfo.displayName > b.displayInfo.displayName) {
					return 1;
				}
				return 0;
			});
		}

		// Step 2) Fire the event
		let eventArg: UpdateAccountListEventParams = {
			providerId: provider.metadata.id,
			accountList: provider.accounts
		};
		this._updateAccountListEmitter.fire(eventArg);
	}

	private onOAuthResponse(args: object): void {
		// Verify the arguments are correct
		if (!args || args['eventId'] === undefined) {
			warn('Received invalid OAuth event response args');
			return;
		}

		// Find the event
		let eventId: string = args['eventId'];
		let eventCallbacks = this._oAuthCallbacks[eventId];
		if (!eventCallbacks) {
			warn('Received OAuth event response for non-existent eventId');
			return;
		}

		// Parse the args
		let error: string = args['error'];
		let code: string = args['code'];
		if (error) {
			eventCallbacks.reject(error);
		} else {
			eventCallbacks.resolve(code);
		}
	}
}

/**
 * Joins together an account provider, its metadata, and its accounts, used in the provider list
 */
export interface AccountProviderWithMetadata {
	metadata: data.AccountProviderMetadata;
	provider: data.AccountProvider;
	accounts: data.Account[];
}
