/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { Event, Emitter } from 'vs/base/common/event';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { Memento } from 'vs/workbench/common/memento';

import AccountStore from 'sql/platform/accounts/common/accountStore';
import { AccountDialogController } from 'sql/workbench/services/accountManagement/browser/accountDialogController';
import { AutoOAuthDialogController } from 'sql/workbench/services/accountManagement/browser/autoOAuthDialogController';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { Deferred } from 'sql/base/common/promise';
import { localize } from 'vs/nls';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { URI } from 'vs/base/common/uri';
import { firstIndex } from 'vs/base/common/arrays';
import { values } from 'vs/base/common/collections';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService, Severity, INotification } from 'vs/platform/notification/common/notification';
import { Action } from 'vs/base/common/actions';

export class AccountManagementService implements IAccountManagementService {
	// CONSTANTS ///////////////////////////////////////////////////////////
	private static ACCOUNT_MEMENTO = 'AccountManagement';

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	public _providers: { [id: string]: AccountProviderWithMetadata } = {};
	public _serviceBrand: undefined;
	private _accountStore: AccountStore;
	private _accountDialogController: AccountDialogController;
	private _autoOAuthDialogController: AutoOAuthDialogController;
	private _mementoContext: Memento;

	// EVENT EMITTERS //////////////////////////////////////////////////////
	private _addAccountProviderEmitter: Emitter<AccountProviderAddedEventParams>;
	public get addAccountProviderEvent(): Event<AccountProviderAddedEventParams> { return this._addAccountProviderEmitter.event; }

	private _removeAccountProviderEmitter: Emitter<azdata.AccountProviderMetadata>;
	public get removeAccountProviderEvent(): Event<azdata.AccountProviderMetadata> { return this._removeAccountProviderEmitter.event; }

	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		private _mementoObj: object,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService private _storageService: IStorageService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IOpenerService private _openerService: IOpenerService,
		@ILogService private readonly _logService: ILogService,
		@INotificationService private readonly _notificationService,
	) {
		// Create the account store
		if (!this._mementoObj) {
			this._mementoContext = new Memento(AccountManagementService.ACCOUNT_MEMENTO, this._storageService);
			this._mementoObj = this._mementoContext.getMemento(StorageScope.GLOBAL);
		}
		this._accountStore = this._instantiationService.createInstance(AccountStore, this._mementoObj);

		// Setup the event emitters
		this._addAccountProviderEmitter = new Emitter<AccountProviderAddedEventParams>();
		this._removeAccountProviderEmitter = new Emitter<azdata.AccountProviderMetadata>();
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		_storageService.onWillSaveState(() => this.shutdown());
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
	 * @param updatedAccount Account with the updated properties
	 */
	public accountUpdated(updatedAccount: azdata.Account): Thenable<void> {
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
		});

	}

	/**
	 * Asks the requested provider to prompt for an account
	 * @param providerId ID of the provider to ask to prompt for an account
	 * @return Promise to return an account
	 */
	public addAccount(providerId: string): Thenable<void> {
		const closeAction: Action = new Action('closeAddingAccount', localize('accountManagementService.close', "Close"), undefined, true);

		const loginNotification: INotification = {
			severity: Severity.Info,
			message: localize('loggingIn', "Adding account..."),
			progress: {
				infinite: true
			},
			actions: {
				primary: [closeAction]
			}
		};

		return this.doWithProvider(providerId, async (provider) => {
			const notificationHandler = this._notificationService.notify(loginNotification);
			try {
				let account = await provider.provider.prompt();
				if (this.isCanceledResult(account)) {
					return;
				}

				let result = await this._accountStore.addOrUpdate(account);
				if (result.accountAdded) {
					// Add the account to the list
					provider.accounts.push(result.changedAccount);
				}
				if (result.accountModified) {
					this.spliceModifiedAccount(provider, result.changedAccount);
				}

				this.fireAccountListUpdate(provider, result.accountAdded);
			} finally {
				notificationHandler.close();
			}
		});
	}

	private isCanceledResult(result: azdata.Account | azdata.PromptFailedResult): result is azdata.PromptFailedResult {
		return (<azdata.PromptFailedResult>result).canceled;
	}

	/**
	 * Asks the requested provider to refresh an account
	 * @param account account to refresh
	 * @return Promise to return an account
	 */
	public refreshAccount(account: azdata.Account): Thenable<azdata.Account> {
		let self = this;

		return this.doWithProvider(account.key.providerId, async (provider) => {
			let refreshedAccount = await provider.provider.refresh(account);
			if (self.isCanceledResult(refreshedAccount)) {
				// Pattern here is to throw if this fails. Handled upstream.
				throw new Error(localize('refreshFailed', "Refresh account was canceled by the user"));
			} else {
				account = refreshedAccount;
			}

			let result = await self._accountStore.addOrUpdate(account);
			if (result.accountAdded) {
				// Add the account to the list
				provider.accounts.push(result.changedAccount);
			}
			if (result.accountModified) {
				// Find the updated account and splice the updated on in
				let indexToRemove: number = firstIndex(provider.accounts, account => {
					return account.key.accountId === result.changedAccount.key.accountId;
				});
				if (indexToRemove >= 0) {
					provider.accounts.splice(indexToRemove, 1, result.changedAccount);
				}
			}

			self.fireAccountListUpdate(provider, result.accountAdded);
			return result.changedAccount;
		});
	}

	/**
	 * Retrieves metadata of all providers that have been registered
	 * @returns Registered account providers
	 */
	public getAccountProviderMetadata(): Thenable<azdata.AccountProviderMetadata[]> {
		return Promise.resolve(values(this._providers).map(provider => provider.metadata));
	}

	/**
	 * Retrieves the accounts that belong to a specific provider
	 * @param providerId ID of the provider the returned accounts belong to
	 * @returns Promise to return a list of accounts
	 */
	public getAccountsForProvider(providerId: string): Thenable<azdata.Account[]> {
		let self = this;

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
	 * Retrieves all the accounts registered with ADS.
	 */
	public getAccounts(): Thenable<azdata.Account[]> {
		return this._accountStore.getAllAccounts();
	}

	/**
	 * Generates a security token by asking the account's provider
	 * @param account Account to generate security token for
	 * @param resource The resource to get the security token for
	 * @return Promise to return the security token
	 */
	public getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return this.doWithProvider(account.key.providerId, provider => {
			return provider.provider.getSecurityToken(account, resource);
		});
	}

	/**
	 * Generates a security token by asking the account's provider
	 * @param account Account to generate security token for
	 * @param tenant Tenant to generate security token for
	 * @param resource The resource to get the security token for
	 * @return Promise to return the security token
	 */
	public getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource): Thenable<{ token: string }> {
		return this.doWithProvider(account.key.providerId, provider => {
			return provider.provider.getAccountSecurityToken(account, tenant, resource);
		});
	}

	/**
	 * Removes an account from the account store and clears sensitive data in the provider
	 * @param accountKey Key for the account to remove
	 * @returns Promise with result of account removal, true if account was
	 *                           removed, false otherwise.
	 */
	public removeAccount(accountKey: azdata.AccountKey): Thenable<boolean> {

		// Step 1) Remove the account
		// Step 2) Clear the sensitive data from the provider (regardless of whether the account was removed)
		// Step 3) Update the account cache and fire an event
		return this.doWithProvider(accountKey.providerId, async provider => {
			const result = await this._accountStore.remove(accountKey);
			await provider.provider.clear(accountKey);
			if (!result) {
				return result;
			}

			let indexToRemove: number = firstIndex(provider.accounts, account => {
				return account.key.accountId === accountKey.accountId;
			});

			if (indexToRemove >= 0) {
				provider.accounts.splice(indexToRemove, 1);
				this.fireAccountListUpdate(provider, false);
			}
			return result;
		});
	}

	/**
	 * Removes all registered accounts
	 */
	public async removeAccounts(): Promise<boolean> {
		const accounts = await this.getAccounts();
		if (accounts.length === 0) {
			return false;
		}

		let finalResult = true;
		for (const account of accounts) {
			try {
				const removeResult = await this.removeAccount(account.key);
				if (removeResult === false) {
					this._logService.info('Error when removing %s.', account.key);
					finalResult = false;
				}
			} catch (ex) {
				this._logService.error('Error when removing an account %s. Exception: %s', account.key, JSON.stringify(ex));
			}
		}
		return finalResult;
	}

	// UI METHODS //////////////////////////////////////////////////////////
	/**
	 * Opens the account list dialog
	 * @return Promise that finishes when the account list dialog closes
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
				self._accountDialogController.accountDialog.onCloseEvent(resolve);
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Begin auto OAuth device code open add account dialog
	 * @return Promise that finishes when the account list dialog opens
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
				err => { this._logService.warn(`Error when cancelling auto OAuth: ${err}`); }
			)
			.then(() => this.autoOAuthDialogController.closeAutoOAuthDialog());
	}

	/**
	 * Copy the user code to the clipboard and open a browser to the verification URI
	 */
	public copyUserCodeAndOpenBrowser(userCode: string, uri: string): void {
		this._clipboardService.writeText(userCode).catch(err => onUnexpectedError(err));
		this._openerService.open(URI.parse(uri)).catch(err => onUnexpectedError(err));
	}

	private async _registerProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): Promise<void> {
		this._providers[providerMetadata.id] = {
			metadata: providerMetadata,
			provider: provider,
			accounts: []
		};

		const accounts = await this._accountStore.getAccountsByProvider(providerMetadata.id);
		const updatedAccounts = await provider.initialize(accounts);

		// Don't add the accounts that are about to get deleted to the cache.
		this._providers[providerMetadata.id].accounts = updatedAccounts.filter(s => s.delete === false);

		const writePromises = updatedAccounts.map(async (account) => {
			if (account.delete === true) {
				return this._accountStore.remove(account.key);
			}
			return this._accountStore.addOrUpdate(account);
		});
		await Promise.all(writePromises);

		const p = this._providers[providerMetadata.id];
		this._addAccountProviderEmitter.fire({
			addedProvider: p.metadata,
			initialAccounts: p.accounts.slice(0)		// Slice here to make sure no one can modify our cache
		});
		// Notify listeners that the account has been updated
		this.fireAccountListUpdate(p, false);
	}

	// SERVICE MANAGEMENT METHODS //////////////////////////////////////////
	/**
	 * Called by main thread to register an account provider from extension
	 * @param providerMetadata Metadata of the provider that is being registered
	 * @param provider References to the methods of the provider
	 */
	public registerProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): Thenable<void> {
		return this._registerProvider(providerMetadata, provider);
	}

	/**
	 * Handler for when shutdown of the application occurs. Writes out the memento.
	 */
	private shutdown(): void {
		if (this._mementoContext) {
			this._mementoContext.saveMemento();
		}
	}

	public unregisterProvider(providerMetadata: azdata.AccountProviderMetadata): void {
		// Delete this account provider
		delete this._providers[providerMetadata.id];

		// Alert our listeners that we've removed a provider
		this._removeAccountProviderEmitter.fire(providerMetadata);
	}

	// TODO: Support for orphaned accounts (accounts with no provider)

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private doWithProvider<T>(providerId: string, op: (provider: AccountProviderWithMetadata) => Thenable<T>): Thenable<T> {
		let provider = this._providers[providerId];
		if (!provider) {
			// If the provider doesn't already exist wait until it gets registered
			let deferredPromise = new Deferred<T>();
			let toDispose = this.addAccountProviderEvent(params => {
				if (params.addedProvider.id === providerId) {
					toDispose.dispose();
					deferredPromise.resolve(op(this._providers[providerId]));
				}
			});
			return deferredPromise;
		}

		return op(provider);
	}

	private fireAccountListUpdate(provider: AccountProviderWithMetadata, sort: boolean) {
		// Step 1) Get and sort the list
		if (sort) {
			provider.accounts.sort((a: azdata.Account, b: azdata.Account) => {
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

	private spliceModifiedAccount(provider: AccountProviderWithMetadata, modifiedAccount: azdata.Account) {
		// Find the updated account and splice the updated one in
		let indexToRemove: number = firstIndex(provider.accounts, account => {
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
	metadata: azdata.AccountProviderMetadata;
	provider: azdata.AccountProvider;
	accounts: azdata.Account[];
}
