/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as constants from '../constants';
import * as sqlops from 'sqlops';
import * as events from 'events';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as vscode from 'vscode';
import CredentialServiceTokenCache from './tokenCache';
import providerSettings from './providerSettings';
import { AzureAccountProvider } from './azureAccountProvider';
import { AzureAccountProviderMetadata, ProviderSettings } from './interfaces';

let localize = nls.loadMessageBundle();

export class AzureAccountProviderService implements vscode.Disposable {
	// CONSTANTS ///////////////////////////////////////////////////////////////
	private static CommandClearTokenCache = 'accounts.clearTokenCache';
	private static ConfigurationSection = 'accounts.azure';
	private static CredentialNamespace = 'azureAccountProviderCredentials';

	// MEMBER VARIABLES ////////////////////////////////////////////////////////
	private _accountDisposals: { [accountProviderId: string]: vscode.Disposable };
	private _accountProviders: { [accountProviderId: string]: AzureAccountProvider };
	private _credentialProvider: sqlops.CredentialProvider;
	private _configChangePromiseChain: Thenable<void>;
	private _currentConfig: vscode.WorkspaceConfiguration;
	private _event: events.EventEmitter;

	constructor(private _context: vscode.ExtensionContext, private _userStoragePath: string) {
		this._accountDisposals = {};
		this._accountProviders = {};
		this._configChangePromiseChain = Promise.resolve();
		this._currentConfig = null;
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

		// 1) Get a credential provider
		// 2a) Store the credential provider for use later
		// 2b) Register the configuration change handler
		// 2c) Perform an initial config change handling
		return sqlops.credentials.getProvider(AzureAccountProviderService.CredentialNamespace)
			.then(credProvider => {
				self._credentialProvider = credProvider;

				self._context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(self.onDidChangeConfiguration, self));
				self.onDidChangeConfiguration();
				return true;
			});
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

	private onDidChangeConfiguration(): void {
		let self = this;

		// Add a new change processing onto the existing promise change
		this._configChangePromiseChain = this._configChangePromiseChain.then(() => {
			// Grab the stored config and the latest config
			let newConfig = vscode.workspace.getConfiguration(AzureAccountProviderService.ConfigurationSection);
			let oldConfig = self._currentConfig;
			self._currentConfig = newConfig;

			// Determine what providers need to be changed
			let providerChanges: Thenable<void>[] = [];
			for (let provider of providerSettings) {
				// If the old config doesn't exist, then assume everything was disabled
				// There will always be a new config value
				let oldConfigValue = oldConfig
					? oldConfig.get<boolean>(provider.configKey)
					: false;
				let newConfigValue = newConfig.get<boolean>(provider.configKey);

				// Case 1: Provider config has not changed - do nothing
				if (oldConfigValue === newConfigValue) {
					continue;
				}

				// Case 2: Provider was enabled and is now disabled - unregister provider
				if (oldConfigValue && !newConfigValue) {
					providerChanges.push(self.unregisterAccountProvider(provider));
				}

				// Case 3: Provider was disabled and is now enabled - register provider
				if (!oldConfigValue && newConfigValue) {
					providerChanges.push(self.registerAccountProvider(provider));
				}
			}

			// Process all the changes before continuing
			return Promise.all(providerChanges);
		}).then(null, () => { return Promise.resolve(); });
	}

	private registerAccountProvider(provider: ProviderSettings): Thenable<void> {
		let self = this;

		return new Promise((resolve, reject) => {
			try {
				let tokenCacheKey = `azureTokenCache-${provider.metadata.id}`;
				let tokenCachePath = path.join(this._userStoragePath, tokenCacheKey);
				let tokenCache = new CredentialServiceTokenCache(self._credentialProvider, tokenCacheKey, tokenCachePath);
				let accountProvider = new AzureAccountProvider(<AzureAccountProviderMetadata>provider.metadata, tokenCache);
				self._accountProviders[provider.metadata.id] = accountProvider;
				self._accountDisposals[provider.metadata.id] = sqlops.accounts.registerAccountProvider(provider.metadata, accountProvider);
				resolve();
			} catch (e) {
				console.error(`Failed to register account provider: ${e}`);
				reject(e);
			}
		});
	}

	private unregisterAccountProvider(provider: ProviderSettings): Thenable<void> {
		let self = this;

		return new Promise((resolve, reject) => {
			try {
				self._accountDisposals[provider.metadata.id].dispose();
				delete self._accountProviders[provider.metadata.id];
				delete self._accountDisposals[provider.metadata.id];
				resolve();
			} catch (e) {
				console.error(`Failed to unregister account provider: ${e}`);
				reject(e);
			}
		});
	}
}
