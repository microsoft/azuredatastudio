/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as events from 'events';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as os from 'os';
import { SimpleTokenCache } from './simpleTokenCache';
import providerSettings from './providerSettings';
import { AzureAccountProvider as AzureAccountProvider } from './azureAccountProvider';
import { AzureAccountProviderMetadata } from 'azurecore';
import { ProviderSettings } from './interfaces';
import * as loc from '../localizedConstants';
import { PublicClientApplication } from '@azure/msal-node';
import { DataProtectionScope, PersistenceCachePlugin, FilePersistenceWithDataProtection, KeychainPersistence, LibSecretPersistence } from '@azure/msal-node-extensions';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import * as Constants from '../constants';

let localize = nls.loadMessageBundle();

class UriEventHandler extends vscode.EventEmitter<vscode.Uri> implements vscode.UriHandler {
	public handleUri(uri: vscode.Uri) {
		this.fire(uri);
	}
}

export class AzureAccountProviderService implements vscode.Disposable {
	// MEMBER VARIABLES ////////////////////////////////////////////////////////
	private _disposables: vscode.Disposable[] = [];
	private _accountDisposals: { [accountProviderId: string]: vscode.Disposable } = {};
	private _accountProviders: { [accountProviderId: string]: azdata.AccountProvider } = {};
	private _credentialProvider: azdata.CredentialProvider | undefined = undefined;
	private _configChangePromiseChain: Thenable<void> = Promise.resolve();
	private _currentConfig: vscode.WorkspaceConfiguration | undefined = undefined;
	private _event: events.EventEmitter = new events.EventEmitter();
	private readonly _uriEventHandler: UriEventHandler = new UriEventHandler();
	public clientApplication!: PublicClientApplication;
	public persistence: FilePersistenceWithDataProtection | KeychainPersistence | LibSecretPersistence | undefined;

	constructor(private _context: vscode.ExtensionContext,
		private _userStoragePath: string,
		private _authLibrary: string) {
		this._disposables.push(vscode.window.registerUriHandler(this._uriEventHandler));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public activate(): Thenable<boolean> {
		let self = this;

		// Register commands
		this._context.subscriptions.push(vscode.commands.registerCommand(Constants.AccountsClearTokenCacheCommand,
			() => { self._event.emit(Constants.AccountsClearTokenCacheCommand); }
		));
		this._event.on(Constants.AccountsClearTokenCacheCommand, () => { void self.onClearTokenCache(); });

		// 1) Get a credential provider
		// 2a) Store the credential provider for use later
		// 2b) Register the configuration change handler
		// 2c) Perform an initial config change handling
		return azdata.credentials.getProvider(Constants.AzureAccountProviderCredentials)
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
					void vscode.window.showInformationMessage(`${loc.extensionName}: ${message}`);
				},
				err => {
					let message = localize('clearTokenCacheFailure', "Failed to clear token cache");
					void vscode.window.showErrorMessage(`${loc.extensionName}: ${message}: ${err}`);
				});
	}

	private async onDidChangeConfiguration(): Promise<void> {
		// Add a new change processing onto the existing promise change
		await this._configChangePromiseChain;
		// Grab the stored config and the latest config
		let newConfig = vscode.workspace.getConfiguration(Constants.AccountsAzureCloudSection);
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
		const isSaw: boolean = vscode.env.appName.toLowerCase().indexOf(Constants.Saw) > 0;
		const noSystemKeychain = vscode.workspace.getConfiguration(Constants.AzureSection).get<boolean>(Constants.NoSystemKeyChainSection);
		const platform = os.platform();
		const tokenCacheKey = `azureTokenCache-${provider.metadata.id}`;
		const lockOptions = {
			retryNumber: 100,
			retryDelay: 50
		}

		try {
			if (!this._credentialProvider) {
				throw new Error('Credential provider not registered');
			}

			let simpleTokenCache = new SimpleTokenCache(tokenCacheKey, this._userStoragePath, noSystemKeychain, this._credentialProvider);
			await simpleTokenCache.init();
			const cachePath = path.join(this._userStoragePath, Constants.ConfigFilePath);

			switch (platform) {
				case Constants.Platform.Windows:
					const dataProtectionScope = DataProtectionScope.CurrentUser;
					const optionalEntropy = "";
					this.persistence = await FilePersistenceWithDataProtection.create(cachePath, dataProtectionScope, optionalEntropy);
					break;
				case Constants.Platform.Mac:
				case Constants.Platform.Linux:
					this.persistence = await KeychainPersistence.create(cachePath, Constants.ServiceName, Constants.Account);
					break;
			}
			if (!this.persistence) {
				Logger.error('Unable to intialize persistence for access token cache. Tokens will not persist in system memory for future use.');
				throw new Error('Unable to intialize persistence for access token cache. Tokens will not persist in system memory for future use.');
			}

			let persistenceCachePlugin: PersistenceCachePlugin = new PersistenceCachePlugin(this.persistence, lockOptions); // or any of the other ones.
			const MSAL_CONFIG = {
				auth: {
					clientId: provider.metadata.settings.clientId,
					redirect_uri: `${provider.metadata.settings.redirectUri}/redirect`
				},
				cache: {
					cachePlugin: persistenceCachePlugin
				}
			}

			this.clientApplication = new PublicClientApplication(MSAL_CONFIG);
			let accountProvider = new AzureAccountProvider(provider.metadata as AzureAccountProviderMetadata,
				simpleTokenCache, this._context, this.clientApplication, this._uriEventHandler, this._authLibrary, isSaw);
			this._accountProviders[provider.metadata.id] = accountProvider;
			this._accountDisposals[provider.metadata.id] = azdata.accounts.registerAccountProvider(provider.metadata, accountProvider);
		} catch (e) {
			console.error(`Failed to register account provider, isSaw: ${isSaw}: ${e}`);
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
