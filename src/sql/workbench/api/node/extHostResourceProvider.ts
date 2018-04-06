/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import {
	ExtHostResourceProviderShape,
	MainThreadResourceProviderShape,
	SqlMainContext,
} from 'sql/workbench/api/node/sqlExtHost.protocol';

export class ExtHostResourceProvider extends ExtHostResourceProviderShape {
	private _handlePool: number = 0;
	private _proxy: MainThreadResourceProviderShape;
	private _providers: { [handle: number]: ResourceProviderWithMetadata } = {};

	constructor(mainContext: IMainContext) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadResourceProvider);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	// - MAIN THREAD AVAILABLE METHODS /////////////////////////////////////
	public $createFirewallRule(handle: number, account: sqlops.Account, firewallRuleInfo: sqlops.FirewallRuleInfo): Thenable<sqlops.CreateFirewallRuleResponse> {
		return this._withProvider(handle, (provider: sqlops.ResourceProvider) => provider.createFirewallRule(account, firewallRuleInfo));
	}
	public $handleFirewallRule(handle: number, errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<sqlops.HandleFirewallRuleResponse> {
		return this._withProvider(handle, (provider: sqlops.ResourceProvider) => provider.handleFirewallRule(errorCode, errorMessage, connectionTypeId));
	}

	// - EXTENSION HOST AVAILABLE METHODS //////////////////////////////////
	public $registerResourceProvider(providerMetadata: sqlops.ResourceProviderMetadata, provider: sqlops.ResourceProvider): Disposable {
		let self = this;

		// Look for any account providers that have the same provider ID
		let matchingProviderIndex = Object.values(this._providers).findIndex((provider: ResourceProviderWithMetadata) => {
			return provider.metadata.id === providerMetadata.id;
		});
		if (matchingProviderIndex >= 0) {
			throw new Error(`Resource Provider with ID '${providerMetadata.id}' has already been registered`);
		}

		// Create the handle for the provider
		let handle: number = this._nextHandle();
		this._providers[handle] = {
			metadata: providerMetadata,
			provider: provider
		};

		// Register the provider in the main thread via the proxy
		this._proxy.$registerResourceProvider(providerMetadata, handle);

		// Return a disposable to cleanup the provider
		return new Disposable(() => {
			delete self._providers[handle];
			self._proxy.$unregisterResourceProvider(handle);
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

	private _withProvider<R>(handle: number, callback: (provider: sqlops.ResourceProvider) => Thenable<R>): Thenable<R> {
		let provider = this._providers[handle];
		if (provider === undefined) {
			return TPromise.wrapError(new Error(`Provider ${handle} not found.`));
		}
		return callback(provider.provider);
	}
}

interface ResourceProviderWithMetadata {
	metadata: sqlops.ResourceProviderMetadata;
	provider: sqlops.ResourceProvider;
}


