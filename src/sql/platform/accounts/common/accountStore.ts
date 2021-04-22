/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AccountAdditionResult } from 'sql/platform/accounts/common/eventTypes';
import { IAccountStore } from 'sql/platform/accounts/common/interfaces';
import { deepClone } from 'vs/base/common/objects';
import { ILogService } from 'vs/platform/log/common/log';

export default class AccountStore implements IAccountStore {
	private readonly deprecatedProviders = ['azurePublicCloud'];
	// CONSTANTS ///////////////////////////////////////////////////////////
	public static MEMENTO_KEY: string = 'Microsoft.SqlTools.Accounts';

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _activeOperation?: Promise<any>;

	constructor(
		private _memento: { [key: string]: any },
		@ILogService readonly logService: ILogService
	) { }

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public addOrUpdate(newAccount: azdata.Account): Promise<AccountAdditionResult> {
		return this.doOperation(() => {
			return this.readFromMemento()
				.then(accounts => {
					// Determine if account exists and proceed accordingly
					const match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, newAccount.key));
					return match < 0
						? this.addToAccountList(accounts, newAccount)
						: this.updateAccountList(accounts, newAccount.key, matchAccount => AccountStore.mergeAccounts(newAccount, matchAccount));
				})
				.then(result => this.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => ({ accountAdded: result.accountAdded, accountModified: result.accountModified, changedAccount: result.changedAccount! }));
		});
	}

	public async getAccountsByProvider(providerId: string): Promise<azdata.Account[]> {
		const accounts = await this.doOperation(async () => {
			await this.cleanupDeprecatedAccounts();
			const accounts = await this.readFromMemento();
			return accounts.filter(account => account.key.providerId === providerId);
		});
		return accounts ?? [];
	}

	public async getAllAccounts(): Promise<azdata.Account[]> {
		const accounts = await this.doOperation(async () => {
			await this.cleanupDeprecatedAccounts();
			return this.readFromMemento();
		});
		return accounts ?? [];
	}

	public cleanupDeprecatedAccounts(): Promise<void> {
		return this.readFromMemento()
			.then(accounts => {
				// No need to waste cycles
				if (!accounts || accounts.length === 0) {
					return Promise.resolve();
				}
				// Remove old accounts that are now deprecated
				try {
					accounts = accounts.filter(account => {
						const providerKey = account?.key?.providerId;
						// Account has no provider, remove it.
						if (providerKey === undefined) {
							return false;
						}
						// Returns true if the account isn't from a deprecated provider
						return !this.deprecatedProviders.includes(providerKey);
					});
				} catch (ex) {
					this.logService.error(ex);
					return Promise.resolve();
				}
				return this.writeToMemento(accounts);
			});
	}

	public remove(key: azdata.AccountKey): Promise<boolean> {
		return this.doOperation(() => {
			return this.readFromMemento()
				.then(accounts => this.removeFromAccountList(accounts, key))
				.then(result => this.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => result.accountRemoved);
		});
	}

	public update(key: azdata.AccountKey, updateOperation: (account: azdata.Account) => void): Promise<boolean> {
		return this.doOperation(() => {
			return this.readFromMemento()
				.then(accounts => this.updateAccountList(accounts, key, updateOperation))
				.then(result => this.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => result.accountModified);
		});
	}

	// PRIVATE METHODS /////////////////////////////////////////////////////
	private static findAccountByKey(key1: azdata.AccountKey, key2: azdata.AccountKey): boolean {
		// Provider ID and Account ID must match
		return key1.providerId === key2.providerId && key1.accountId === key2.accountId;
	}

	private static mergeAccounts(source: azdata.Account, target: azdata.Account): void {
		// Take any display info changes
		target.displayInfo = source.displayInfo;

		// Take all property changes
		target.properties = source.properties;

		// Take any stale changes
		target.isStale = source.isStale;
	}

	private doOperation<T>(op: () => Promise<T>): Promise<T | undefined> {
		// Initialize the active operation to an empty promise if necessary
		let activeOperation = this._activeOperation || Promise.resolve();

		// Chain the operation to perform to the end of the existing promise
		activeOperation = activeOperation.then(op);

		// Add a catch at the end to make sure we can continue after any errors
		activeOperation = activeOperation.then(undefined, err => {
			this.logService.error(err);
		});

		// Point the current active operation to this one
		this._activeOperation = activeOperation;
		return <Promise<T>>this._activeOperation;
	}

	private addToAccountList(accounts: azdata.Account[], accountToAdd: azdata.Account): AccountListOperationResult {
		// Check if the entry already exists
		const match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, accountToAdd.key));
		if (match >= 0) {
			// Account already exists, we won't do anything
			return {
				accountAdded: false,
				accountModified: false,
				accountRemoved: false,
				changedAccount: undefined,
				updatedAccounts: accounts
			};
		}

		// Add the account to the store
		accounts.push(accountToAdd);
		return {
			accountAdded: true,
			accountModified: false,
			accountRemoved: false,
			changedAccount: accountToAdd,
			updatedAccounts: accounts
		};
	}

	private removeFromAccountList(accounts: azdata.Account[], accountToRemove: azdata.AccountKey): AccountListOperationResult {
		// Check if the entry exists
		const match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, accountToRemove));
		if (match >= 0) {
			// Account exists, remove it from the account list
			accounts.splice(match, 1);
		}

		return {
			accountAdded: false,
			accountModified: false,
			accountRemoved: match >= 0,
			changedAccount: undefined,
			updatedAccounts: accounts
		};
	}

	private updateAccountList(accounts: azdata.Account[], accountToUpdate: azdata.AccountKey, updateOperation: (account: azdata.Account) => void): AccountListOperationResult {
		// Check if the entry exists
		const match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, accountToUpdate));
		if (match < 0) {
			// Account doesn't exist, we won't do anything
			return {
				accountAdded: false,
				accountModified: false,
				accountRemoved: false,
				changedAccount: undefined,
				updatedAccounts: accounts
			};
		}


		// Account exists, apply the update operation to it
		updateOperation(accounts[match]);
		return {
			accountAdded: false,
			accountModified: true,
			accountRemoved: false,
			changedAccount: accounts[match],
			updatedAccounts: accounts
		};
	}

	// MEMENTO IO METHODS //////////////////////////////////////////////////
	private readFromMemento(): Promise<azdata.Account[]> {
		// Initialize the account list if it isn't already
		let accounts = this._memento[AccountStore.MEMENTO_KEY];
		if (!accounts) {
			accounts = [];
		}
		this.logService.debug(`Read accounts from memento ${JSON.stringify(accounts)}`);
		// Make a deep copy of the account list to ensure that the memento list isn't obliterated
		accounts = deepClone(accounts);

		return Promise.resolve(accounts);
	}

	private writeToMemento(accounts: azdata.Account[]): Promise<void> {
		// Store a shallow copy of the account list to disconnect the memento list from the active list
		this._memento[AccountStore.MEMENTO_KEY] = deepClone(accounts);
		return Promise.resolve();
	}
}

interface AccountListOperationResult {
	accountRemoved: boolean;
	updatedAccounts: azdata.Account[];
	changedAccount: azdata.Account | undefined;
	accountAdded: boolean;
	accountModified: boolean;
}
