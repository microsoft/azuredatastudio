/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import {
	ExtHostAccountManagementShape,
	MainThreadAccountManagementShape,
	SqlMainContext,
} from 'sql/workbench/api/node/sqlExtHost.protocol';

export class ExtHostAccountManagement extends ExtHostAccountManagementShape {
	private _handlePool: number = 0;
	private _proxy: MainThreadAccountManagementShape;
	private _providers: { [handle: number]: AccountProviderWithMetadata } = {};

	constructor(threadService: IThreadService) {
		super();
		this._proxy = threadService.get(SqlMainContext.MainThreadAccountManagement);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	// - MAIN THREAD AVAILABLE METHODS /////////////////////////////////////
	public $clear(handle: number, accountKey: sqlops.AccountKey): Thenable<void> {
		return this._withProvider(handle, (provider: sqlops.AccountProvider) => provider.clear(accountKey));
	}

	public $getSecurityToken(handle: number, account: sqlops.Account): Thenable<{}> {
		return this._withProvider(handle, (provider: sqlops.AccountProvider) => provider.getSecurityToken(account));
	}

	public $initialize(handle: number, restoredAccounts: sqlops.Account[]): Thenable<sqlops.Account[]> {
		return this._withProvider(handle, (provider: sqlops.AccountProvider) => provider.initialize(restoredAccounts));
	}

	public $prompt(handle: number): Thenable<sqlops.Account> {
		return this._withProvider(handle, (provider: sqlops.AccountProvider) => provider.prompt());
	}

	public $refresh(handle: number, account: sqlops.Account): Thenable<sqlops.Account> {
		return this._withProvider(handle, (provider: sqlops.AccountProvider) => provider.refresh(account));
	}

	public $autoOAuthCancelled(handle: number): Thenable<void> {
		return this._withProvider(handle, (provider: sqlops.AccountProvider) => provider.autoOAuthCancelled());
	}

	// - EXTENSION HOST AVAILABLE METHODS //////////////////////////////////
	public $beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
		return this._proxy.$beginAutoOAuthDeviceCode(providerId, title, message, userCode, uri);
	}

	public $endAutoOAuthDeviceCode(): void {
		this._proxy.$endAutoOAuthDeviceCode();
	}

	public $accountUpdated(updatedAccount: sqlops.Account): void {
		this._proxy.$accountUpdated(updatedAccount);
	}

	public $registerAccountProvider(providerMetadata: sqlops.AccountProviderMetadata, provider: sqlops.AccountProvider): Disposable {
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

	private _withProvider<R>(handle: number, callback: (provider: sqlops.AccountProvider) => Thenable<R>): Thenable<R> {
		let provider = this._providers[handle];
		if (provider === undefined) {
			return TPromise.wrapError(new Error(`Provider ${handle} not found.`));
		}
		return callback(provider.provider);
	}
}

interface AccountProviderWithMetadata {
	metadata: sqlops.AccountProviderMetadata;
	provider: sqlops.AccountProvider;
}


