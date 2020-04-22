/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AccountAdditionResult } from 'sql/platform/accounts/common/eventTypes';
import { IAccountStore } from 'sql/platform/accounts/common/interfaces';
import { deepClone } from 'vs/base/common/objects';
import { firstIndex } from 'vs/base/common/arrays';
import { ILogService } from 'vs/platform/log/common/log';

export default class AccountStore implements IAccountStore {
	private readonly deprecatedProviders = ['azurePublicCloud'];
	// CONSTANTS ///////////////////////////////////////////////////////////
	public static MEMENTO_KEY: string = 'Microsoft.SqlTools.Accounts';

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _activeOperation?: Thenable<any>;

	constructor(
		private _memento: { [key: string]: any },
		@ILogService readonly logService: ILogService
	) { }

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public addOrUpdate(newAccount: azdata.Account): Thenable<AccountAdditionResult> {
		return this.doOperation(() => {
			return this.readFromMemento()
				.then(accounts => {
					// Determine if account exists and proceed accordingly
					const match = firstIndex(accounts, account => AccountStore.findAccountByKey(account.key, newAccount.key));
					return match < 0
						? this.addToAccountList(accounts, newAccount)
						: this.updateAccountList(accounts, newAccount.key, matchAccount => AccountStore.mergeAccounts(newAccount, matchAccount));
				})
				.then(result => this.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => <AccountAdditionResult>result);
		});
	}

	public getAccountsByProvider(providerId: string): Thenable<azdata.Account[]> {
		return this.doOperation(() => {
			return this.readFromMemento()
				.then(accounts => accounts.filter(account => account.key.providerId === providerId));
		});
	}

	public getAllAccounts(): Thenable<azdata.Account[]> {
		return this.doOperation(() => {
			return this.cleanupDeprecatedAccounts().then(() => {
				return this.readFromMemento();
			});
		});
	}

	public cleanupDeprecatedAccounts(): Thenable<void> {
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

	public remove(key: azdata.AccountKey): Thenable<boolean> {
		return this.doOperation(() => {
			return this.readFromMemento()
				.then(accounts => this.removeFromAccountList(accounts, key))
				.then(result => this.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => result.accountRemoved);
		});
	}

	public update(key: azdata.AccountKey, updateOperation: (account: azdata.Account) => void): Thenable<boolean> {
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

	private doOperation<T>(op: () => Thenable<T>) {
		// Initialize the active operation to an empty promise if necessary
		let activeOperation = this._activeOperation || Promise.resolve<any>(null);

		// Chain the operation to perform to the end of the existing promise
		activeOperation = activeOperation.then(op);

		// Add a catch at the end to make sure we can continue after any errors
		activeOperation = activeOperation.then(undefined, (err) => {
			// TODO: Log the error
		});

		// Point the current active operation to this one
		this._activeOperation = activeOperation;
		return <Promise<T>>this._activeOperation;
	}

	private addToAccountList(accounts: azdata.Account[], accountToAdd: azdata.Account): AccountListOperationResult {
		// Check if the entry already exists
		const match = firstIndex(accounts, account => AccountStore.findAccountByKey(account.key, accountToAdd.key));
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
		const match = firstIndex(accounts, account => AccountStore.findAccountByKey(account.key, accountToRemove));
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
		const match = firstIndex(accounts, account => AccountStore.findAccountByKey(account.key, accountToUpdate));
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
	private readFromMemento(): Thenable<azdata.Account[]> {
		// Initialize the account list if it isn't already
		let accounts = this._memento[AccountStore.MEMENTO_KEY];
		if (!accounts) {
			accounts = [];
		}

		// Make a deep copy of the account list to ensure that the memento list isn't obliterated
		accounts = deepClone(accounts);

		return Promise.resolve(accounts);
	}

	private writeToMemento(accounts: azdata.Account[]): Thenable<void> {
		// Store a shallow copy of the account list to disconnect the memento list from the active list
		this._memento[AccountStore.MEMENTO_KEY] = deepClone(accounts);
		return Promise.resolve();
	}
}

interface AccountListOperationResult extends AccountAdditionResult {
	accountRemoved: boolean;
	updatedAccounts: azdata.Account[];
}
