/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as azdata from 'azdata';
import * as events from 'events';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { promises as fsPromises } from 'fs';
import providerSettings from './providerSettings';
import { AzureAccountProvider as AzureAccountProvider } from './azureAccountProvider';
import { AzureAccountProviderMetadata, CacheEncryptionKeys } from 'azurecore';
import { ProviderSettings } from './interfaces';
import { MsalCachePluginProvider } from './utils/msalCachePlugin';
import * as loc from '../localizedConstants';
import { Configuration, PublicClientApplication } from '@azure/msal-node';
import * as Constants from '../constants';
import { Logger } from '../utils/Logger';
import { ILoggerCallback, LogLevel as MsalLogLevel } from "@azure/msal-common";
import { displayReloadAds } from '../utils';
import { reloadPromptCacheClear } from '../localizedConstants';

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
	private _cachePluginProvider: MsalCachePluginProvider | undefined = undefined;
	private _configChangePromiseChain: Thenable<void> = Promise.resolve();
	private _currentConfig: vscode.WorkspaceConfiguration | undefined = undefined;
	private _event: events.EventEmitter = new events.EventEmitter();
	private readonly _uriEventHandler: UriEventHandler = new UriEventHandler();
	public clientApplication!: PublicClientApplication;
	private _onEncryptionKeysUpdated: vscode.EventEmitter<CacheEncryptionKeys>;
	public activeProviderCount: number = 0;

	constructor(private _context: vscode.ExtensionContext,
		private _userStoragePath: string) {
		this._onEncryptionKeysUpdated = new vscode.EventEmitter<CacheEncryptionKeys>();
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

	public getEncryptionKeysEmitter(): vscode.EventEmitter<CacheEncryptionKeys> {
		return this._onEncryptionKeysUpdated;
	}

	public async getEncryptionKeys(): Promise<CacheEncryptionKeys> {
		if (!this._cachePluginProvider) {
			await this.onDidChangeConfiguration();
		}
		return this._cachePluginProvider!.getCacheEncryptionKeys();
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
					void displayReloadAds(reloadPromptCacheClear);
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
				this.activeProviderCount--;
			}

			// Case 3: Provider was disabled and is now enabled - register provider
			if (!oldConfigValue && newConfigValue) {
				providerChanges.push(this.registerAccountProvider(provider));
				this.activeProviderCount++;
			}

			// Case 4: Provider was added from JSON - register provider
			if (provider.configKey !== Constants.enablePublicCloud && provider.configKey !== Constants.enableUsGovCloud && provider.configKey !== Constants.enableChinaCloud) {
				providerChanges.push(this.registerAccountProvider(provider));
				this.activeProviderCount++;
			}
		}
		if (this.activeProviderCount === 0) {
			void vscode.window.showWarningMessage(loc.noCloudsEnabled, loc.enablePublicCloud, loc.dismiss).then(async (result) => {
				if (result === loc.enablePublicCloud) {
					await vscode.workspace.getConfiguration(Constants.AccountsAzureCloudSection).update(loc.enablePublicCloudCamel, true, vscode.ConfigurationTarget.Global);
				}
			});
		}

		// Process all the changes before continuing
		await Promise.all(providerChanges);
	}

	private async registerAccountProvider(provider: ProviderSettings): Promise<void> {
		const isSaw: boolean = vscode.env.appName.toLowerCase().indexOf(Constants.Saw) > 0;
		const tokenCacheKeyMsal = Constants.MSALCacheName;
		await this.clearOldCacheIfExists();
		try {
			if (!this._credentialProvider) {
				throw new Error('Credential provider not registered');
			}

			// MSAL Cache Plugin
			this._cachePluginProvider = new MsalCachePluginProvider(tokenCacheKeyMsal, this._userStoragePath, this._credentialProvider, this._onEncryptionKeysUpdated);
			// Initialize cache provider and encryption keys
			await this._cachePluginProvider.init();

			const msalConfiguration: Configuration = {
				auth: {
					clientId: provider.metadata.settings.clientId,
					authority: 'https://login.windows.net/common'
				},
				system: {
					loggerOptions: {
						loggerCallback: this.getLoggerCallback(),
						logLevel: MsalLogLevel.Trace,
						piiLoggingEnabled: true,
					},
				},
				cache: {
					cachePlugin: this._cachePluginProvider?.getCachePlugin()
				}
			}

			this.clientApplication = new PublicClientApplication(msalConfiguration);
			let accountProvider = new AzureAccountProvider(provider.metadata as AzureAccountProviderMetadata,
				this._context, this.clientApplication, this._cachePluginProvider,
				this._uriEventHandler, isSaw);
			this._accountProviders[provider.metadata.id] = accountProvider;
			this._accountDisposals[provider.metadata.id] = azdata.accounts.registerAccountProvider(provider.metadata, accountProvider);
		} catch (e) {
			console.error(`Failed to register account provider, isSaw: ${isSaw}: ${e}`);
		}
	}

	/**
	 * Clears old cache file that is no longer needed on system.
	 */
	private async clearOldCacheIfExists(): Promise<void> {
		let filePath = path.join(this._userStoragePath, Constants.oldMsalCacheFileName);
		try {
			await fsPromises.access(filePath);
			await fsPromises.unlink('file:' + filePath);
			Logger.verbose(`Old cache file removed successfully.`);
		} catch (e) {
			if (e.code !== 'ENOENT') {
				Logger.verbose(`Error occurred while removing old cache file: ${e}`);
			} // else file doesn't exist.
		}
	}

	private getLoggerCallback(): ILoggerCallback {
		return (level: number, message: string, containsPii: boolean) => {
			if (!containsPii) {
				switch (level) {
					case MsalLogLevel.Error:
						Logger.error(message);
						break;
					case MsalLogLevel.Info:
						Logger.info(message);
						break;
					case MsalLogLevel.Verbose:
					default:
						Logger.verbose(message);
						break;
				}
			} else {
				Logger.pii(message);
			}
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
