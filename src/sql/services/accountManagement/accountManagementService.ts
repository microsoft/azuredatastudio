/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vs/nls';
import * as platform from 'vs/platform/registry/common/platform';
import * as statusbar from 'vs/workbench/browser/parts/statusbar/statusbar';

import Event, { Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { Memento, Scope as MementoScope } from 'vs/workbench/common/memento';

import AccountStore from 'sql/services/accountManagement/accountStore';
import { AccountDialogController } from 'sql/parts/accountManagement/accountDialog/accountDialogController';
import { AutoOAuthDialogController } from 'sql/parts/accountManagement/autoOAuthDialog/autoOAuthDialogController';
import { AccountListStatusbarItem } from 'sql/parts/accountManagement/accountListStatusbar/accountListStatusbarItem';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

export class AccountManagementService implements IAccountManagementService {
	// CONSTANTS ///////////////////////////////////////////////////////////
	private static ACCOUNT_MEMENTO = 'AccountManagement';

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	public _providers: { [id: string]: AccountProviderWithMetadata } = {};
	public _serviceBrand: any;
	private _accountStore: AccountStore;
	private _accountDialogController: AccountDialogController;
	private _autoOAuthDialogController: AutoOAuthDialogController;
	private _mementoContext: Memento;

	// EVENT EMITTERS //////////////////////////////////////////////////////
	private _addAccountProviderEmitter: Emitter<AccountProviderAddedEventParams>;
	public get addAccountProviderEvent(): Event<AccountProviderAddedEventParams> { return this._addAccountProviderEmitter.event; }

	private _removeAccountProviderEmitter: Emitter<sqlops.AccountProviderMetadata>;
	public get removeAccountProviderEvent(): Event<sqlops.AccountProviderMetadata> { return this._removeAccountProviderEmitter.event; }

	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		private _mementoObj: object,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService private _storageService: IStorageService,
		@IClipboardService private _clipboardService: IClipboardService,
	) {
		// Create the account store
		if (!this._mementoObj) {
			this._mementoContext = new Memento(AccountManagementService.ACCOUNT_MEMENTO);
			this._mementoObj = this._mementoContext.getMemento(this._storageService, MementoScope.GLOBAL);
		}
		this._accountStore = this._instantiationService.createInstance(AccountStore, this._mementoObj);

		// Setup the event emitters
		this._addAccountProviderEmitter = new Emitter<AccountProviderAddedEventParams>();
		this._removeAccountProviderEmitter = new Emitter<sqlops.AccountProviderMetadata>();
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		// Register status bar item
		let statusbarDescriptor = new statusbar.StatusbarItemDescriptor(
			AccountListStatusbarItem,
			statusbar.StatusbarAlignment.LEFT,
			15000 /* Highest Priority */
		);
		(<statusbar.IStatusbarRegistry>platform.Registry.as(statusbar.Extensions.Statusbar)).registerStatusbarItem(statusbarDescriptor);
	}

	private get autoOAuthDialogController(): AutoOAuthDialogController {
		// If the add account dialog hasn't been defined, create a new one
		if (!this._autoOAuthDialogController) {
			this._autoOAuthDialogController = this._instantiationService.createInstance(AutoOAuthDialogController);
		}
		return this._autoOAuthDialogController;
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Called from an account provider (via extension host -> main thread interop) when an
	 * account's properties have been updated (usually when the account goes stale).
	 * @param {Account} updatedAccount Account with the updated properties
	 */
	public accountUpdated(updatedAccount: sqlops.Account): Thenable<void> {
		let self = this;

		// 1) Update the account in the store
		// 2a) If the account was added, then the account provider incorrectly called this method.
		//     Remove the account
		// 2b) If the account was modified, then update it in the local cache and notify any
		//     listeners that the account provider's list changed
		// 3) Handle any errors
		return this.doWithProvider(updatedAccount.key.providerId, provider => {
			return self._accountStore.addOrUpdate(updatedAccount)
				.then(result => {
					if (result.accountAdded) {
						self._accountStore.remove(updatedAccount.key);
						return Promise.reject('Called with a new account!');
					}
					if (result.accountModified) {
						self.spliceModifiedAccount(provider, result.changedAccount);
						self.fireAccountListUpdate(provider, false);
					}
					return Promise.resolve();
				});
		}).then(
			() => { },
			reason => {
				console.warn(`Account update handler encountered error: ${reason}`);
			}
			);

	}

	/**
	 * Asks the requested provider to prompt for an account
	 * @param {string} providerId ID of the provider to ask to prompt for an account
	 * @return {Thenable<Account>} Promise to return an account
	 */
	public addAccount(providerId: string): Thenable<void> {
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
						self.spliceModifiedAccount(provider, result.changedAccount);
					}

					self.fireAccountListUpdate(provider, result.accountAdded);
				})
				.then(null, err => {
					// On error, check to see if the error is because the user cancelled. If so, just ignore
					if ('userCancelledSignIn' in err) {
						return Promise.resolve();
					}
					return Promise.reject(err);
				});
		});
	}

	/**
	 * Asks the requested provider to refresh an account
	 * @param {Account} account account to refresh
	 * @return {Thenable<Account>} Promise to return an account
	 */
	public refreshAccount(account: sqlops.Account): Thenable<sqlops.Account> {
		let self = this;

		return this.doWithProvider(account.key.providerId, (provider) => {
			return provider.provider.refresh(account)
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
	public getAccountProviderMetadata(): Thenable<sqlops.AccountProviderMetadata[]> {
		return Promise.resolve(Object.values(this._providers).map(provider => provider.metadata));
	}

	/**
	 * Retrieves the accounts that belong to a specific provider
	 * @param {string} providerId ID of the provider the returned accounts belong to
	 * @returns {Thenable<Account[]>} Promise to return a list of accounts
	 */
	public getAccountsForProvider(providerId: string): Thenable<sqlops.Account[]> {
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
	public getSecurityToken(account: sqlops.Account): Thenable<{}> {
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
	public removeAccount(accountKey: sqlops.AccountKey): Thenable<boolean> {
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
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Begin auto OAuth device code open add account dialog
	 * @return {TPromise<any>}	Promise that finishes when the account list dialog opens
	 */
	public beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
		let self = this;

		return this.doWithProvider(providerId, provider => {
			return self.autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri);
		});
	}

	/**
	 * End auto OAuth Devide code closes add account dialog
	 */
	public endAutoOAuthDeviceCode(): void {
		this.autoOAuthDialogController.closeAutoOAuthDialog();
	}

	/**
	 * Called from the UI when a user cancels the auto OAuth dialog
	 */
	public cancelAutoOAuthDeviceCode(providerId: string): void {
		this.doWithProvider(providerId, provider => provider.provider.autoOAuthCancelled())
			.then(	// Swallow errors
			null,
			err => { console.warn(`Error when cancelling auto OAuth: ${err}`); }
			)
			.then(() => this.autoOAuthDialogController.closeAutoOAuthDialog());
	}

	/**
	 * Copy the user code to the clipboard and open a browser to the verification URI
	 */
	public copyUserCodeAndOpenBrowser(userCode: string, uri: string): void {
		this._clipboardService.writeText(userCode);
		window.open(uri);
	}

	// SERVICE MANAGEMENT METHODS //////////////////////////////////////////
	/**
	 * Called by main thread to register an account provider from extension
	 * @param {sqlops.AccountProviderMetadata} providerMetadata Metadata of the provider that is being registered
	 * @param {sqlops.AccountProvider} provider References to the methods of the provider
	 */
	public registerProvider(providerMetadata: sqlops.AccountProviderMetadata, provider: sqlops.AccountProvider): Thenable<void> {
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
			.then((accounts: sqlops.Account[]) => {
				return provider.initialize(accounts);
			})
			.then((accounts: sqlops.Account[]) => {
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

	public unregisterProvider(providerMetadata: sqlops.AccountProviderMetadata): void {
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
			provider.accounts.sort((a: sqlops.Account, b: sqlops.Account) => {
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

	private spliceModifiedAccount(provider: AccountProviderWithMetadata, modifiedAccount: sqlops.Account) {
		// Find the updated account and splice the updated one in
		let indexToRemove: number = provider.accounts.findIndex(account => {
			return account.key.accountId === modifiedAccount.key.accountId;
		});
		if (indexToRemove >= 0) {
			provider.accounts.splice(indexToRemove, 1, modifiedAccount);
		}
	}
}

/**
 * Joins together an account provider, its metadata, and its accounts, used in the provider list
 */
export interface AccountProviderWithMetadata {
	metadata: sqlops.AccountProviderMetadata;
	provider: sqlops.AccountProvider;
	accounts: sqlops.Account[];
}
