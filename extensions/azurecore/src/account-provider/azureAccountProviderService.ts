/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as events from 'events';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { SimpleTokenCache } from './simpleTokenCache';
import providerSettings from './providerSettings';
import { AzureAccountProvider as AzureAccountProvider } from './azureAccountProvider';
import { AzureAccountProviderMetadata, ProviderSettings } from './interfaces';
import * as loc from '../localizedConstants';

let localize = nls.loadMessageBundle();

class UriEventHandler extends vscode.EventEmitter<vscode.Uri> implements vscode.UriHandler {
	public handleUri(uri: vscode.Uri) {
		this.fire(uri);
	}
}

export class AzureAccountProviderService implements vscode.Disposable {
	// CONSTANTS ///////////////////////////////////////////////////////////////
	private static CommandClearTokenCache = 'accounts.clearTokenCache';
	private static ConfigurationSection = 'accounts.azure.cloud';
	private static CredentialNamespace = 'azureAccountProviderCredentials';

	// MEMBER VARIABLES ////////////////////////////////////////////////////////
	private _disposables: vscode.Disposable[] = [];
	private _accountDisposals: { [accountProviderId: string]: vscode.Disposable };
	private _accountProviders: { [accountProviderId: string]: azdata.AccountProvider };
	private _credentialProvider: azdata.CredentialProvider;
	private _configChangePromiseChain: Thenable<void>;
	private _currentConfig: vscode.WorkspaceConfiguration;
	private _event: events.EventEmitter;
	private readonly _uriEventHandler: UriEventHandler;

	constructor(private _context: vscode.ExtensionContext, private _userStoragePath: string) {
		this._accountDisposals = {};
		this._accountProviders = {};
		this._configChangePromiseChain = Promise.resolve();
		this._currentConfig = null;
		this._event = new events.EventEmitter();

		this._uriEventHandler = new UriEventHandler();
		this._disposables.push(vscode.window.registerUriHandler(this._uriEventHandler));
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
		return azdata.credentials.getProvider(AzureAccountProviderService.CredentialNamespace)
			.then(credProvider => {
				this._credentialProvider = credProvider;

				this._context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
					this._configChangePromiseChain = this.onDidChangeConfiguration();
				}, this));

				this._configChangePromiseChain = this.onDidChangeConfiguration();
				return true;
			});
	}

	public dispose() {
		while (this._disposables.length) {
			const item = this._disposables.pop();
			if (item) {
				item.dispose();
			}
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private onClearTokenCache(): Thenable<void> {
		// let self = this;

		let promises: Thenable<void>[] = providerSettings.map(provider => {
			return this._accountProviders[provider.metadata.id]?.clearTokenCache();
		});

		return Promise.all(promises)
			.then(
				() => {
					let message = localize('clearTokenCacheSuccess', "Token cache successfully cleared");
					vscode.window.showInformationMessage(`${loc.extensionName}: ${message}`);
				},
				err => {
					let message = localize('clearTokenCacheFailure', "Failed to clear token cache");
					vscode.window.showErrorMessage(`${loc.extensionName}: ${message}: ${err}`);
				});
	}

	private async onDidChangeConfiguration(): Promise<void> {
		// Add a new change processing onto the existing promise change
		await this._configChangePromiseChain;
		// Grab the stored config and the latest config
		let newConfig = vscode.workspace.getConfiguration(AzureAccountProviderService.ConfigurationSection);
		let oldConfig = this._currentConfig;
		this._currentConfig = newConfig;

		// Determine what providers need to be changed
		let providerChanges: Promise<void>[] = [];
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
				providerChanges.push(this.unregisterAccountProvider(provider));
			}

			// Case 3: Provider was disabled and is now enabled - register provider
			if (!oldConfigValue && newConfigValue) {
				providerChanges.push(this.registerAccountProvider(provider));
			}
		}

		// Process all the changes before continuing
		await Promise.all(providerChanges);
	}

	private async registerAccountProvider(provider: ProviderSettings): Promise<void> {
		try {
			const noSystemKeychain = vscode.workspace.getConfiguration('azure').get<boolean>('noSystemKeychain');
			let tokenCacheKey = `azureTokenCache-${provider.metadata.id}`;
			let simpleTokenCache = new SimpleTokenCache(tokenCacheKey, this._userStoragePath, noSystemKeychain, this._credentialProvider);
			await simpleTokenCache.init();

			const isSaw: boolean = vscode.env.appName.toLowerCase().indexOf('saw') > 0;
			let accountProvider = new AzureAccountProvider(provider.metadata as AzureAccountProviderMetadata, simpleTokenCache, this._context, this._uriEventHandler, isSaw);

			this._accountProviders[provider.metadata.id] = accountProvider;
			this._accountDisposals[provider.metadata.id] = azdata.accounts.registerAccountProvider(provider.metadata, accountProvider);
		} catch (e) {
			console.error(`Failed to register account provider: ${e}`);
		}
	}

	private async unregisterAccountProvider(provider: ProviderSettings): Promise<void> {
		try {
			this._accountDisposals[provider.metadata.id].dispose();
			delete this._accountProviders[provider.metadata.id];
			delete this._accountDisposals[provider.metadata.id];
		} catch (e) {
			console.error(`Failed to unregister account provider: ${e}`);
		}
	}
}
