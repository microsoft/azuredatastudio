/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { Event, Emitter } from 'vs/base/common/event';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
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
import { values } from 'vs/base/common/collections';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService, Severity, INotification } from 'vs/platform/notification/common/notification';
import { Action } from 'vs/base/common/actions';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { TelemetryAction, TelemetryError, TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { Iterable } from 'vs/base/common/iterator';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { IAuthenticationService } from 'vs/workbench/services/authentication/common/authentication';

export class AccountManagementService implements IAccountManagementService {
	// CONSTANTS ///////////////////////////////////////////////////////////
	private static ACCOUNT_MEMENTO = 'AccountManagement';

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	public _providers: { [id: string]: AccountProviderWithMetadata } = {};
	public _serviceBrand: undefined;
	private _accountStore: AccountStore;
	private _accountDialogController?: AccountDialogController;
	private _autoOAuthDialogController?: AutoOAuthDialogController;
	private _mementoContext?: Memento;
	public providerMap = new Map<string, azdata.AccountProviderMetadata>();
	protected readonly disposables = new DisposableStore();

	// EVENT EMITTERS //////////////////////////////////////////////////////
	private _addAccountProviderEmitter: Emitter<AccountProviderAddedEventParams>;
	public get addAccountProviderEvent(): Event<AccountProviderAddedEventParams> { return this._addAccountProviderEmitter.event; }

	private _removeAccountProviderEmitter: Emitter<azdata.AccountProviderMetadata>;
	public get removeAccountProviderEvent(): Event<azdata.AccountProviderMetadata> { return this._removeAccountProviderEmitter.event; }

	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IStorageService private readonly _storageService: IStorageService,
		@IClipboardService private readonly _clipboardService: IClipboardService,
		@IOpenerService private readonly _openerService: IOpenerService,
		@ILogService private readonly _logService: ILogService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IAdsTelemetryService private readonly _telemetryService: IAdsTelemetryService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IAuthenticationService private readonly _authenticationService: IAuthenticationService
	) {
		this._mementoContext = new Memento(AccountManagementService.ACCOUNT_MEMENTO, this._storageService);
		const mementoObj = this._mementoContext.getMemento(StorageScope.APPLICATION, StorageTarget.MACHINE);
		this._accountStore = this._instantiationService.createInstance(AccountStore, mementoObj);

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
	public accountUpdated(updatedAccount: azdata.Account): Promise<void> {
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

	public async promptProvider(): Promise<string | undefined> {
		const vals = Iterable.consume(this.providerMap.values())[0];

		let pickedValue: string | undefined;
		if (vals.length === 0) {
			this._notificationService.error(localize('accountDialog.noCloudsRegistered', "You have no clouds enabled. Go to Settings -> Search Azure Account Configuration -> Enable at least one cloud"));
		}
		if (vals.length > 1) {
			const buttons: IQuickPickItem[] = vals.map(v => {
				return { label: v.displayName } as IQuickPickItem;
			});

			const picked = await this._quickInputService.pick(buttons, { canPickMany: false });

			pickedValue = picked?.label;
		} else {
			pickedValue = vals[0].displayName;
		}

		const v = vals.filter(v => v.displayName === pickedValue)?.[0];

		if (!v) {
			this._notificationService.error(localize('accountDialog.didNotPickAuthProvider', "You didn't select any authentication provider. Please try again."));
			return undefined;
		}
		return v.id;
	}

	/**
	 * Asks the requested provider to prompt for an account
	 * @param providerId ID of the provider to ask to prompt for an account
	 * @return Promise to return an account
	 */
	public addAccount(providerId: string): Promise<void> {
		const closeAction: Action = new Action('closeAddingAccount', localize('accountManagementService.close', "Close"), undefined, true);
		const genericAccountErrorMessage = localize('addAccountFailedGenericMessage', 'Adding account failed, check Azure Accounts log for more info.')
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
				let accountResult = await provider.provider.prompt();
				if (!this.isAccountResult(accountResult)) {
					if (accountResult.canceled === true) {
						return;
					} else {
						this._telemetryService.createErrorEvent(TelemetryView.LinkedAccounts, TelemetryError.AddAzureAccountError, accountResult.errorCode,
							this.getErrorType(accountResult.errorMessage))
							.send();
						if (accountResult.errorCode && accountResult.errorMessage) {
							throw new Error(localize('addAccountFailedCodeMessage', `{0} \nError Message: {1}`, accountResult.errorCode, accountResult.errorMessage));
						} else {
							throw new Error(accountResult.errorMessage ?? genericAccountErrorMessage);
						}
					}
				}
				let result = await this._accountStore.addOrUpdate(accountResult);
				if (!result) {
					this._logService.error('Adding account failed, no result received.');
					this._telemetryService.createErrorEvent(TelemetryView.LinkedAccounts, TelemetryError.AddAzureAccountErrorNoResult, '-1',
						this.getErrorType())
						.send();
					throw new Error(genericAccountErrorMessage);
				}
				if (result.accountAdded) {
					// Add the account to the list
					provider.accounts.push(result.changedAccount);
				}
				if (result.accountModified) {
					this.spliceModifiedAccount(provider, result.changedAccount);
				}
				this._telemetryService.createActionEvent(TelemetryView.LinkedAccounts, TelemetryAction.AddAzureAccount)
					.send();
				this.fireAccountListUpdate(provider, result.accountAdded);
			} finally {
				notificationHandler.close();
			}
		});
	}

	/**
	 * Adds an account to the account store without prompting the user
	 * @param account account to add
	 */
	public addAccountWithoutPrompt(account: azdata.Account): Promise<void> {
		return this.doWithProvider(account.key.providerId, async (provider) => {
			let result = await this._accountStore.addOrUpdate(account);
			if (!result) {
				this._logService.error('adding account failed');
			}
			if (result.accountAdded) {
				// Add the account to the list
				provider.accounts.push(result.changedAccount);
			}
			if (result.accountModified) {
				this.spliceModifiedAccount(provider, result.changedAccount);
			}

			this.fireAccountListUpdate(provider, result.accountAdded);
		});
	}

	private isAccountResult(result: azdata.Account | azdata.PromptFailedResult): result is azdata.Account {
		return typeof (<azdata.Account>result).displayInfo === 'object';
	}

	/**
	 * Asks the requested provider to refresh an account
	 * @param account account to refresh
	 * @return Promise to return an account
	 */
	public refreshAccount(account: azdata.Account): Promise<azdata.Account> {
		const genericAccountErrorMessage = localize('refreshAccountFailedGenericMessage', 'Refreshing account failed, check Azure Accounts log for more info.')
		return this.doWithProvider(account.key.providerId, async (provider) => {
			let refreshedAccount = await provider.provider.refresh(account);
			if (!this.isAccountResult(refreshedAccount)) {
				if (refreshedAccount.canceled) {
					// Pattern here is to throw if this fails. Handled upstream.
					throw new Error(localize('refreshCanceled', "Refresh account was canceled by the user"));
				} else {
					this._telemetryService.createErrorEvent(TelemetryView.LinkedAccounts, TelemetryError.RefreshAzureAccountError, refreshedAccount.errorCode,
						this.getErrorType(refreshedAccount.errorMessage))
						.send();
					if (refreshedAccount.errorCode && refreshedAccount.errorMessage) {
						throw new Error(localize('refreshFailed', `{0} \nError Message: {1}`, refreshedAccount.errorCode, refreshedAccount.errorMessage));
					} else {
						throw new Error(refreshedAccount.errorMessage ?? genericAccountErrorMessage);
					}
				}
			} else {
				account = refreshedAccount;
			}

			let result = await this._accountStore.addOrUpdate(account);
			if (!result) {
				this._logService.error('Refreshing account failed, no result received.');
				this._telemetryService.createErrorEvent(TelemetryView.LinkedAccounts, TelemetryError.RefreshAzureAccountErrorNoResult, '-1',
					this.getErrorType())
					.send();
				throw new Error(genericAccountErrorMessage);
			}
			if (result.accountAdded) {
				// Double check that there isn't a matching account
				let indexToRemove = this.findAccountIndex(provider.accounts, result.changedAccount);
				if (indexToRemove >= 0) {
					this._accountStore.remove(provider.accounts[indexToRemove].key);
					provider.accounts.splice(indexToRemove, 1);
				}
				// Add the account to the list
				provider.accounts.push(result.changedAccount!);
			}
			if (result.accountModified) {
				// Find the updated account and splice the updated one in
				let indexToRemove: number = provider.accounts.findIndex(account => {
					return account.key.accountId === result.changedAccount!.key.accountId;
				});
				if (indexToRemove >= 0) {
					provider.accounts.splice(indexToRemove, 1, result.changedAccount!);
				}
			}

			this._telemetryService.createActionEvent(TelemetryView.LinkedAccounts, TelemetryAction.RefreshAzureAccount)
				.send();
			this.fireAccountListUpdate(provider, result.accountAdded);
			return result.changedAccount!;
		});
	}

	private getErrorType(errorMessage?: string | undefined): string {
		let errorType: string = 'Unknown';
		if (errorMessage) {
			if (errorMessage.toLocaleLowerCase().includes('token')) {
				errorType = 'AccessToken';
			} else if (errorMessage.toLocaleLowerCase().includes('timeout')) {
				errorType = 'Timeout';
			} else if (errorMessage.toLocaleLowerCase().includes('cache')) {
				errorType = 'TokenCache'
			}
		}
		return errorType;
	}

	/**
	 * Retrieves metadata of all providers that have been registered
	 * @returns Registered account providers
	 */
	public getAccountProviderMetadata(): Promise<azdata.AccountProviderMetadata[]> {
		return Promise.resolve(values(this._providers).map(provider => provider.metadata));
	}

	/**
	 * Retrieves the accounts that belong to a specific provider
	 * @param providerId ID of the provider the returned accounts belong to
	 * @returns Promise to return a list of accounts
	 */
	public getAccountsForProvider(providerId: string): Promise<azdata.Account[]> {
		let self = this;

		// 1) Get the accounts from the store
		// 2) Filter the accounts based on the auth library
		// 3) Update our local cache of accounts
		return this.doWithProvider(providerId, provider => {
			return self._accountStore.getAccountsByProvider(provider.metadata.id)
				.then(accounts => {
					self._providers[providerId].accounts = accounts;
					return accounts;
				});
		});
	}

	/**
	 * Retrieves all the accounts registered with ADS based on auth library in use.
	 */
	public getAccounts(): Promise<azdata.Account[]> {
		return this._accountStore.getAllAccounts();
	}

	/**
	 * Generates a security token by asking the account's provider
	 * @param account Account to generate security token for
	 * @param resource The resource to get the security token for
	 * @return Promise to return the security token
	 */
	public getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<{} | undefined> {
		return this.doWithProvider(account.key.providerId, provider => {
			return Promise.resolve(provider.provider.getSecurityToken(account, resource));
		});
	}

	/**
	 * Generates a security token by asking the account's provider
	 * @param account Account to generate security token for
	 * @param tenant Tenant to generate security token for
	 * @param resource The resource to get the security token for
	 * @return Promise to return the security token
	 */
	public getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource): Promise<azdata.accounts.AccountSecurityToken | undefined> {
		return this.doWithProvider(account.key.providerId, async provider => {
			return await provider.provider.getAccountSecurityToken(account, tenant, resource);
		});
	}

	/**
	 * Removes an account from the account store and clears sensitive data in the provider
	 * @param accountKey Key for the account to remove
	 * @returns Promise with result of account removal, true if account was
	 *                           removed, false otherwise.
	 */
	public removeAccount(accountKey: azdata.AccountKey): Promise<boolean> {

		// Step 1) Remove the account
		// Step 2) Clear the sensitive data from the provider (regardless of whether the account was removed)
		// Step 3) Update the account cache and fire an event
		return this.doWithProvider(accountKey.providerId, async provider => {
			const result = await this._accountStore.remove(accountKey);
			let indexToRemove: number = provider.accounts.findIndex(account => {
				return account.key.accountId === accountKey.accountId;
			});
			await provider.provider.clear(accountKey);
			if (!result) {
				return result;
			}

			if (indexToRemove >= 0) {
				provider.accounts.splice(indexToRemove, 1);
				this.fireAccountListUpdate(provider, false);
			} else {
				this._logService.error(`Error when removing an account: ${accountKey.accountId} could not find account in provider list.`);
			}
			return result;
		});
	}

	/**
	 * Updates the auth sessions that appear in the account for a provider. This method does not
	 * handle account management sessions.
	 * @param account The account to update the account list for
	 */
	public async updateAccountListAuthSessions(account: azdata.Account): Promise<void> {
		const sessions = await this._authenticationService.getSessions(account.key.providerId);
		const accounts = sessions.map(session => {
			return ({
				key: { providerId: account.key.providerId, accountId: session.account.id } as azdata.AccountKey,
				displayInfo: { contextualDisplayName: account.displayInfo.contextualDisplayName, accountType: account.displayInfo.accountType, displayName: session.account.label, userId: session.account.label } as azdata.AccountDisplayInfo,
				isStale: false,
			}) as azdata.Account;
		});
		const provider: AccountProviderWithMetadata = {
			metadata: { id: account.key.providerId, displayName: account.displayInfo.displayName } as azdata.AccountProviderMetadata,
			provider: undefined,
			accounts: accounts
		};
		this.fireAccountListUpdate(provider, false);
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
	public openAccountListDialog(): Promise<void> {
		let self = this;

		return new Promise((resolve, reject) => {
			try {
				// If the account list dialog hasn't been defined, create a new one
				if (!self._accountDialogController) {
					self._accountDialogController = self._instantiationService.createInstance(AccountDialogController);
				}
				self._accountDialogController.openAccountDialog();
				self._accountDialogController.accountDialog!.onCloseEvent(resolve);
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Begin auto OAuth device code open add account dialog
	 * @return Promise that finishes when the account list dialog opens
	 */
	public beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Promise<void> {
		let self = this;

		return this.doWithProvider(providerId, provider => {
			return self.autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri);
		});
	}

	/**
	 * End auto OAuth Device code closes add account dialog
	 */
	public endAutoOAuthDeviceCode(): void {
		this.autoOAuthDialogController.closeAutoOAuthDialog();
	}

	/**
	 * Called from the UI when a user cancels the auto OAuth dialog
	 */
	public cancelAutoOAuthDeviceCode(providerId: string): void {
		void this.doWithProvider(providerId, provider => Promise.resolve(provider.provider.autoOAuthCancelled()))
			.then(	// Swallow errors
				undefined,
				err => { this._logService.warn(`Error when cancelling auto OAuth: ${err}`); }
			)
			.then(() => this.autoOAuthDialogController.closeAutoOAuthDialog());
	}

	/**
	 * Copy the user code to the clipboard and open a browser to the verification URI
	 */
	public async copyUserCodeAndOpenBrowser(userCode: string, uri: string): Promise<boolean> {
		await this._clipboardService.writeText(userCode);
		return await this._openerService.open(URI.parse(uri));
	}

	private async _registerProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): Promise<void> {
		this.providerMap.set(providerMetadata.id, providerMetadata);
		this._providers[providerMetadata.id] = {
			metadata: providerMetadata,
			provider: provider,
			accounts: []
		};

		const accounts = await this._accountStore.getAccountsByProvider(providerMetadata.id);
		const updatedAccounts = await provider.initialize(accounts);

		// Don't add the accounts that are explicitly marked to be deleted to the cache.
		this._providers[providerMetadata.id].accounts = updatedAccounts.filter(s => !s.delete);

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
	public registerProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): Promise<void> {
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
		this.providerMap.delete(providerMetadata.id);
		const p = this._providers[providerMetadata.id];
		this.fireAccountListUpdate(p, false);
		// Delete this account provider
		delete this._providers[providerMetadata.id];

		// Alert our listeners that we've removed a provider
		this._removeAccountProviderEmitter.fire(providerMetadata);
	}

	// TODO: Support for orphaned accounts (accounts with no provider)

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private doWithProvider<T>(providerId: string, op: (provider: AccountProviderWithMetadata) => Promise<T>): Promise<T> {
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
		let indexToRemove: number = provider.accounts.findIndex(account => {
			return account.key.accountId === modifiedAccount.key.accountId;
		});
		if (indexToRemove >= 0) {
			provider.accounts.splice(indexToRemove, 1, modifiedAccount);
		}
	}

	public findAccountIndex(accounts: azdata.Account[], accountToFind: azdata.Account): number {
		let indexToRemove: number = accounts.findIndex(account => {
			// corner case handling for personal accounts
			if (account.key.accountId.includes('#') || accountToFind.key.accountId.includes('#')) {
				return account.displayInfo.email?.toLocaleLowerCase() === accountToFind.displayInfo.email?.toLocaleLowerCase();
			}
			// MSAL account added
			if (accountToFind.key.accountId.includes('.')) {
				return account.key.accountId === accountToFind!.key.accountId.split('.')[0];
			}
			return account.key.accountId === accountToFind!.key.accountId;
		});
		return indexToRemove;
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
