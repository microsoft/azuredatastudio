/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { AccountAdditionResult } from 'sql/platform/accountManagement/common/eventTypes';
import { IAccountStore } from 'sql/platform/accountManagement/common/interfaces';

export default class AccountStore implements IAccountStore {
	// CONSTANTS ///////////////////////////////////////////////////////////
	public static MEMENTO_KEY: string = 'Microsoft.SqlTools.Accounts';

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _activeOperation: Thenable<any>;

	constructor(private _memento: object) { }

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public addOrUpdate(newAccount: sqlops.Account): Thenable<AccountAdditionResult> {
		let self = this;

		return this.doOperation(() => {
			return self.readFromMemento()
				.then(accounts => {
					// Determine if account exists and proceed accordingly
					let match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, newAccount.key));
					return match < 0
						? self.addToAccountList(accounts, newAccount)
						: self.updateAccountList(accounts, newAccount.key, (matchAccount) => { AccountStore.mergeAccounts(newAccount, matchAccount); });
				})
				.then(result => self.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => <AccountAdditionResult>result);
		});
	}

	public getAccountsByProvider(providerId: string): Thenable<sqlops.Account[]> {
		let self = this;

		return this.doOperation(() => {
			return self.readFromMemento()
				.then(accounts => accounts.filter(account => account.key.providerId === providerId));
		});
	}

	public getAllAccounts(): Thenable<sqlops.Account[]> {
		let self = this;

		return this.doOperation(() => {
			return self.readFromMemento();
		});
	}

	public remove(key: sqlops.AccountKey): Thenable<boolean> {
		let self = this;

		return this.doOperation(() => {
			return self.readFromMemento()
				.then(accounts => self.removeFromAccountList(accounts, key))
				.then(result => self.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => result.accountRemoved);
		});
	}

	public update(key: sqlops.AccountKey, updateOperation: (account: sqlops.Account) => void): Thenable<boolean> {
		let self = this;

		return this.doOperation(() => {
			return self.readFromMemento()
				.then(accounts => self.updateAccountList(accounts, key, updateOperation))
				.then(result => self.writeToMemento(result.updatedAccounts).then(() => result))
				.then(result => result.accountModified);
		});
	}

	// PRIVATE METHODS /////////////////////////////////////////////////////
	private static findAccountByKey(key1: sqlops.AccountKey, key2: sqlops.AccountKey): boolean {
		// Provider ID and Account ID must match
		return key1.providerId === key2.providerId && key1.accountId === key2.accountId;
	}

	private static mergeAccounts(source: sqlops.Account, target: sqlops.Account): void {
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
		activeOperation = activeOperation.then(null, (err) => {
			// TODO: Log the error
		});

		// Point the current active operation to this one
		this._activeOperation = activeOperation;
		return <Promise<T>>this._activeOperation;
	}

	private addToAccountList(accounts: sqlops.Account[], accountToAdd: sqlops.Account): AccountListOperationResult {
		// Check if the entry already exists
		let match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, accountToAdd.key));
		if (match >= 0) {
			// Account already exists, we won't do anything
			return {
				accountAdded: false,
				accountModified: false,
				accountRemoved: false,
				changedAccount: null,
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

	private removeFromAccountList(accounts: sqlops.Account[], accountToRemove: sqlops.AccountKey): AccountListOperationResult {
		// Check if the entry exists
		let match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, accountToRemove));
		if (match >= 0) {
			// Account exists, remove it from the account list
			accounts.splice(match, 1);
		}

		return {
			accountAdded: false,
			accountModified: false,
			accountRemoved: match >= 0,
			changedAccount: null,
			updatedAccounts: accounts
		};
	}

	private updateAccountList(accounts: sqlops.Account[], accountToUpdate: sqlops.AccountKey, updateOperation: (account: sqlops.Account) => void): AccountListOperationResult {
		// Check if the entry exists
		let match = accounts.findIndex(account => AccountStore.findAccountByKey(account.key, accountToUpdate));
		if (match < 0) {
			// Account doesn't exist, we won't do anything
			return {
				accountAdded: false,
				accountModified: false,
				accountRemoved: false,
				changedAccount: null,
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
	private readFromMemento(): Thenable<sqlops.Account[]> {
		// Initialize the account list if it isn't already
		let accounts = this._memento[AccountStore.MEMENTO_KEY];
		if (!accounts) {
			accounts = [];
		}

		// Make a deep copy of the account list to ensure that the memento list isn't obliterated
		accounts = JSON.parse(JSON.stringify(accounts));

		return Promise.resolve(accounts);
	}

	private writeToMemento(accounts: sqlops.Account[]): Thenable<void> {
		// Store a shallow copy of the account list to disconnect the memento list from the active list
		this._memento[AccountStore.MEMENTO_KEY] = JSON.parse(JSON.stringify(accounts));
		return Promise.resolve();
	}
}

interface AccountListOperationResult extends AccountAdditionResult {
	accountRemoved: boolean;
	updatedAccounts: sqlops.Account[];
}
