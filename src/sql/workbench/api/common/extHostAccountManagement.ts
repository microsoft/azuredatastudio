/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import {
	ExtHostAccountManagementShape,
	MainThreadAccountManagementShape,
	SqlMainContext,
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { AzureResource } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';
import { values } from 'vs/base/common/collections';

type ProviderAndAccount = { provider: azdata.AccountProvider, account: azdata.Account };

export class ExtHostAccountManagement extends ExtHostAccountManagementShape {
	private _handlePool: number = 0;
	private _proxy: MainThreadAccountManagementShape;
	private _providers: { [handle: number]: AccountProviderWithMetadata } = {};
	private readonly _onDidChangeAccounts = new Emitter<azdata.DidChangeAccountsParams>();

	constructor(mainContext: IMainContext) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadAccountManagement);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	// - MAIN THREAD AVAILABLE METHODS /////////////////////////////////////
	public override $clear(handle: number, accountKey: azdata.AccountKey): Thenable<void> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.clear(accountKey));
	}

	public override $initialize(handle: number, restoredAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.initialize(restoredAccounts));
	}

	public override $prompt(handle: number): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.prompt());
	}

	public override $refresh(handle: number, account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._withProvider(handle, (provider: azdata.AccountProvider) => provider.refresh(account));
	}

	public override $autoOAuthCancelled(handle: number): Thenable<void> {
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
		return this.getAllProvidersAndAccounts().then(providersAndAccounts => {
			return providersAndAccounts.map(providerAndAccount => providerAndAccount.account);
		});
	}

	private async getAllProvidersAndAccounts(): Promise<ProviderAndAccount[]> {
		if (Object.keys(this._providers).length === 0) {
			throw new Error('No account providers registered.');
		}

		const resultProviderAndAccounts: ProviderAndAccount[] = [];

		const promises: Thenable<void>[] = [];

		for (const providerKey in this._providers) {
			const providerHandle = parseInt(providerKey);

			const provider = this._providers[providerHandle];
			promises.push(this._proxy.$getAccountsForProvider(provider.metadata.id).then(
				(accounts) => {
					resultProviderAndAccounts.push(...accounts.map(account => { return { provider: provider.provider, account }; }));
				}
			));
		}

		await Promise.all(promises);
		return resultProviderAndAccounts;
	}

	public override $getSecurityToken(account: azdata.Account, resource: azdata.AzureResource = AzureResource.ResourceManagement): Thenable<{}> {
		return this.getAllProvidersAndAccounts().then(providerAndAccounts => {
			const providerAndAccount = providerAndAccounts.find(providerAndAccount => providerAndAccount.account.key.accountId === account.key.accountId);
			if (providerAndAccount) {
				return providerAndAccount.provider.getSecurityToken(account, resource);
			}
			throw new Error(`Account ${account.key.accountId} not found.`);
		});
	}

	public override $getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource = AzureResource.ResourceManagement): Thenable<{ token: string, azureAccountTokenExpiresOn: number }> {
		return this.getAllProvidersAndAccounts().then(providerAndAccounts => {
			const providerAndAccount = providerAndAccounts.find(providerAndAccount => providerAndAccount.account.key.accountId === account.key.accountId);
			if (providerAndAccount) {
				return providerAndAccount.provider.getAccountSecurityToken(account, tenant, resource);
			}
			throw new Error(`Account ${account.key.accountId} not found.`);
		});
	}


	public get onDidChangeAccounts(): Event<azdata.DidChangeAccountsParams> {
		return this._onDidChangeAccounts.event;
	}

	public override $accountsChanged(handle: number, accounts: azdata.Account[]): Thenable<void> {
		return Promise.resolve(this._onDidChangeAccounts.fire({ accounts: accounts }));
	}

	public $registerAccountProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): Disposable {
		let self = this;

		// Look for any account providers that have the same provider ID
		let matchingProviderIndex = values(this._providers).findIndex((provider: AccountProviderWithMetadata) => {
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
	 * @return Number of providers that are currently registered
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
