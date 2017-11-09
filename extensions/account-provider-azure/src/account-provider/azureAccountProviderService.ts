/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as constants from '../constants';
import * as data from 'data';
import * as events from 'events';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as vscode from 'vscode';
import CredentialServiceTokenCache from './tokenCache';
import providerSettings from './providerSettings';
import { AzureAccountProvider } from './azureAccountProvider';
import { AzureAccountProviderMetadata } from './interfaces';

let localize = nls.loadMessageBundle();

export class AzureAccountProviderService implements vscode.Disposable {
	// CONSTANTS ///////////////////////////////////////////////////////////////
	private static CommandClearTokenCache = 'extension.clearTokenCache';
	private static CredentialNamespace = 'azureAccountProviderCredentials';

	// MEMBER VARIABLES ////////////////////////////////////////////////////////
	private _accountProviders: { [accountProviderId: string]: AzureAccountProvider };
	private _event: events.EventEmitter;

	constructor(private _context: vscode.ExtensionContext, private _userStoragePath: string) {
		this._accountProviders = {};
		this._event = new events.EventEmitter();
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public activate(): Thenable<boolean> {
		let self = this;

		// Register commands
		this._context.subscriptions.push(vscode.commands.registerCommand(
			AzureAccountProviderService.CommandClearTokenCache,
			() => { self._event.emit(AzureAccountProviderService.CommandClearTokenCache); }
		));
		this._event.on(AzureAccountProviderService.CommandClearTokenCache, () => { self.onClearTokenCache(); });

		// Create the token caches
		// 1) Get a credential provider
		// 2) Iterate over the enabled providers
		// 2a) Create a token cache for provider
		// 2b) Create the provider from the provider's settings
		// 2c) Register the provider with the account service
		return data.credentials.getProvider(AzureAccountProviderService.CredentialNamespace)
			.then(credProvider => {
				providerSettings.forEach(provider => {
					let tokenCacheKey = `azureTokenCache-${provider.metadata.id}`;
					let tokenCachePath = path.join(self._userStoragePath, tokenCacheKey);
					let tokenCache = new CredentialServiceTokenCache(credProvider, tokenCacheKey, tokenCachePath);
					let accountProvider = new AzureAccountProvider(<AzureAccountProviderMetadata>provider.metadata, tokenCache);
					self._accountProviders[provider.metadata.id] = accountProvider;
					data.accounts.registerAccountProvider(provider.metadata, accountProvider);
				});
			})
			.then(() => { return true; });
	}

	public dispose() { }

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private onClearTokenCache(): Thenable<void> {
		let self = this;

		let promises: Thenable<void>[] = providerSettings.map(provider => {
			return self._accountProviders[provider.metadata.id].clearTokenCache();
		});

		return Promise.all(promises)
			.then(
				() => {
					let message = localize('clearTokenCacheSuccess', 'Token cache successfully cleared');
					vscode.window.showInformationMessage(`${constants.extensionName}: ${message}`);
				},
				err => {
					let message = localize('clearTokenCacheFailure', 'Failed to clear token cache');
					vscode.window.showErrorMessage(`${constants.extensionName}: ${message}: ${err}`);
				});
	}
}
