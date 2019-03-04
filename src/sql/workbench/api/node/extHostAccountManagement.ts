/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import {
	ExtHostAccountManagementShape,
	MainThreadAccountManagementShape,
	SqlMainContext,
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { AzureResource } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';

export class ExtHostAccountManagement extends ExtHostAccountManagementShape {
	private _handlePool: number = 0;
	private _proxy: MainThreadAccountManagementShape;
	private _providers: { [handle: number]: AccountProviderWithMetadata } = {};
	private _accounts: { [handle: number]: azdata.Account[] } = {};
	private readonly _onDidChangeAccounts = new Emitter<azdata.DidChangeAccountsParams>();

	constructor(mainContext: IMainContext) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadAccountManagement);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	// - MAIN THREAD AVAILABLE METHODS /////////////////////////////////////
	public $clear(handle: number, accountKey: azdata.AccountKey): Thenable<void> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.clear(accountKey));
	}

	public $initialize(handle: number, restoredAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.initialize(restoredAccounts));
	}

	public $prompt(handle: number): Thenable<azdata.Account> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.prompt());
	}

	public $refresh(handle: number, account: azdata.Account): Thenable<azdata.Account> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.refresh(account));
	}

	public $autoOAuthCancelled(handle: number): Thenable<void> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.autoOAuthCancelled());
	}

	// - EXTENSION HOST AVAILABLE METHODS //////////////////////////////////
	public $beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
		return this._proxy.$beginAutoOAuthDeviceCode(providerId, title, message, userCode, uri);
	}

	public $endAutoOAuthDeviceCode(): void {
		this._proxy.$endAutoOAuthDeviceCode();
	}

	public $accountUpdated(updatedAccount: azdata.Account): void {
		this._proxy.$accountUpdated(updatedAccount);
	}

	public $getAllAccounts(): Thenable<azdata.Account[]> {
		if (Object.keys(this._providers).length === 0) {
			throw new Error('No account providers registered.');
		}

		this._accounts = {};

		const resultAccounts: azdata.Account[] = [];

		const promises: Thenable<void>[] = [];

		for (const providerKey in this._providers) {
			const providerHandle = parseInt(providerKey);

			const provider = this._providers[providerHandle];
			promises.push(this._proxy.$getAccountsForProvider(provider.metadata.id).then(
				(accounts) => {
					this._accounts[providerHandle] = accounts;
					resultAccounts.push(...accounts);
				}
			));
		}

		return Promise.all(promises).then(() => resultAccounts);
	}

	public $getSecurityToken(account: azdata.Account, resource?: azdata.AzureResource): Thenable<{}> {
		if (resource === undefined) {
			resource = AzureResource.ResourceManagement;
		}
		return this.$getAllAccounts().then(() => {
			for (const handle in this._accounts) {
				const providerHandle = parseInt(handle);
				if (this._accounts[handle].findIndex((acct) => acct.key.accountId === account.key.accountId) !== -1) {
					return this._withProvider(providerHandle, (provider: azdata.AccountProvider) => provider.getSecurityToken(account, resource));
				}
			}

			throw new Error(`Account ${account.key.accountId} not found.`);
		});
	}

	public get onDidChangeAccounts(): Event<azdata.DidChangeAccountsParams> {
		return this._onDidChangeAccounts.event;
	}

<<<<<<< HEAD
	public $accountsChanged(handle: number, accounts: sqlops.Account[]): Thenable<void> {
		return Promise.resolve(this._onDidChangeAccounts.fire({ accounts: accounts }));
=======
	public $accountsChanged(handle: number, accounts: azdata.Account[]): Thenable<void> {
		return this._onDidChangeAccounts.fire({ accounts: accounts });
>>>>>>> 2309b16bd4bd3cd3e7e87a2c1ed4019db0a4c52e
	}

	public $registerAccountProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): Disposable {
		let self = this;

		// Look for any account providers that have the same provider ID
		let matchingProviderIndex = Object.values(this._providers).findIndex((provider: AccountProviderWithMetadata) => {
			return provider.metadata.id === providerMetadata.id;
		});
		if (matchingProviderIndex >= 0) {
			throw new Error(`Account Provider with ID '${providerMetadata.id}' has already been registered`);
		}

		// Create the handle for the provider
		let handle: number = this._nextHandle();
		this._providers[handle] = {
			metadata: providerMetadata,
			provider: provider
		};

		// Register the provider in the main thread via the proxy
		this._proxy.$registerAccountProvider(providerMetadata, handle);

		// Return a disposable to cleanup the provider
		return new Disposable(() => {
			delete self._providers[handle];
			self._proxy.$unregisterAccountProvider(handle);
		});
	}

	/**
	 * This method is for testing only, it is not exposed via the shape.
	 * @return {number} Number of providers that are currently registered
	 */
	public getProviderCount(): number {
		return Object.keys(this._providers).length;
	}

	// PRIVATE METHODS /////////////////////////////////////////////////////
	private _nextHandle(): number {
		return this._handlePool++;
	}

	private _withProvider<R>(handle: number, callback: (provider: azdata.AccountProvider) => Thenable<R>): Thenable<R> {
		let provider = this._providers[handle];
		if (provider === undefined) {
			return Promise.reject(new Error(`Provider ${handle} not found.`));
		}
		return callback(provider.provider);
	}
}

interface AccountProviderWithMetadata {
	metadata: azdata.AccountProviderMetadata;
	provider: azdata.AccountProvider;
}


