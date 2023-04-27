/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

import {
	AzureAccountProviderMetadata,
	AzureAuthType,
	AzureAccount
} from 'azurecore';
import { Deferred } from './interfaces';
import { AuthenticationResult, PublicClientApplication } from '@azure/msal-node';
import { SimpleTokenCache } from './utils/simpleTokenCache';
import { Logger } from '../utils/Logger';
import { MultiTenantTokenResponse, Token, AzureAuth } from './auths/azureAuth';
import { AzureAuthCodeGrant } from './auths/azureAuthCodeGrant';
import { AzureDeviceCode } from './auths/azureDeviceCode';
import { filterAccounts } from '../azureResource/utils';
import * as Constants from '../constants';
import { MsalCachePluginProvider } from './utils/msalCachePlugin';
import { getTenantIgnoreList } from '../utils';

const localize = nls.loadMessageBundle();

export class AzureAccountProvider implements azdata.AccountProvider, vscode.Disposable {
	private readonly authMappings = new Map<AzureAuthType, AzureAuth>();
	private initComplete!: Deferred<void, Error>;
	private initCompletePromise: Promise<void> = new Promise<void>((resolve, reject) => this.initComplete = { resolve, reject });
	public clientApplication: PublicClientApplication;

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext,
		clientApplication: PublicClientApplication,
		private readonly msalCacheProvider: MsalCachePluginProvider,
		uriEventHandler: vscode.EventEmitter<vscode.Uri>,
		private readonly authLibrary: string,
		private readonly forceDeviceCode: boolean = false
	) {
		this.clientApplication = clientApplication;

		vscode.workspace.onDidChangeConfiguration((changeEvent) => {
			const impactProvider = changeEvent.affectsConfiguration(Constants.AccountsAzureAuthSection);
			if (impactProvider === true) {
				this.handleAuthMapping(metadata, tokenCache, context, uriEventHandler);
			}
		});

		this.handleAuthMapping(metadata, tokenCache, context, uriEventHandler);
	}

	dispose() {
		this.authMappings.forEach(x => x.dispose());
	}

	clearTokenCache(): Thenable<void> {
		return this.authLibrary === Constants.AuthLibrary.MSAL
			? this.getAuthMethod().deleteAllCacheMsal()
			// fallback to ADAL as default
			: this.getAuthMethod().deleteAllCacheAdal();
	}

	private handleAuthMapping(metadata: AzureAccountProviderMetadata, tokenCache: SimpleTokenCache, context: vscode.ExtensionContext, uriEventHandler: vscode.EventEmitter<vscode.Uri>) {
		this.authMappings.forEach(m => m.dispose());
		this.authMappings.clear();

		const configuration = vscode.workspace.getConfiguration(Constants.AccountsAzureAuthSection);
		const codeGrantMethod: boolean = configuration.get<boolean>(Constants.AuthType.CodeGrant, false);
		const deviceCodeMethod: boolean = configuration.get<boolean>(Constants.AuthType.DeviceCode, false);

		if (codeGrantMethod === true && !this.forceDeviceCode) {
			this.authMappings.set(AzureAuthType.AuthCodeGrant, new AzureAuthCodeGrant(metadata, tokenCache, this.msalCacheProvider, context, uriEventHandler, this.clientApplication, this.authLibrary));
		}
		if (deviceCodeMethod === true || this.forceDeviceCode) {
			this.authMappings.set(AzureAuthType.DeviceCode, new AzureDeviceCode(metadata, tokenCache, this.msalCacheProvider, context, uriEventHandler, this.clientApplication, this.authLibrary));
		}
		if (codeGrantMethod === false && deviceCodeMethod === false && !this.forceDeviceCode) {
			console.error('No authentication methods selected');
		}
	}

	private getAuthMethod(account?: AzureAccount): AzureAuth {
		if (this.authMappings.size === 1) {
			return this.authMappings.values().next().value;
		}

		const authType: AzureAuthType | undefined = account?.properties?.azureAuthType;
		if (authType) {
			const authMapping = this.authMappings.get(authType);
			if (authMapping) {
				return authMapping;
			}
		}
		if (this.authMappings.size === 0) {
			throw new Error('No authentication mappings selected');
		}
		return this.authMappings.values().next().value;
	}

	initialize(storedAccounts: AzureAccount[]): Thenable<AzureAccount[]> {
		return this._initialize(storedAccounts);
	}

	private async _initialize(storedAccounts: AzureAccount[]): Promise<AzureAccount[]> {
		const accounts: AzureAccount[] = [];
		Logger.verbose(`Initializing stored accounts ${JSON.stringify(accounts)}`);
		const updatedAccounts = filterAccounts(storedAccounts, this.authLibrary);
		for (let account of updatedAccounts) {
			const azureAuth = this.getAuthMethod(account);
			if (!azureAuth) {
				account.isStale = true;
				accounts.push(account);
			} else {
				account.isStale = false;
				if (this.authLibrary === Constants.AuthLibrary.MSAL) {
					// Check MSAL Cache before adding account, to mark it as stale if it is not present in cache
					const accountInCache = await azureAuth.getAccountFromMsalCache(account.key.accountId);
					if (!accountInCache) {
						account.isStale = true;
					}
					accounts.push(account);

				} else { // fallback to ADAL as default
					accounts.push(await azureAuth.refreshAccessAdal(account));
				}
			}
		}
		this.initComplete.resolve();
		return accounts;
	}


	getSecurityToken(account: AzureAccount, resource: azdata.AzureResource): Thenable<MultiTenantTokenResponse | undefined> {
		return this._getSecurityToken(account, resource);
	}

	getAccountSecurityToken(account: AzureAccount, tenantId: string, resource: azdata.AzureResource): Thenable<Token | undefined> {
		return this._getAccountSecurityToken(account, tenantId, resource);
	}

	private async _getAccountSecurityToken(account: AzureAccount, tenantId: string, resource: azdata.AzureResource): Promise<Token | undefined> {
		await this.initCompletePromise;
		const azureAuth = this.getAuthMethod(account);
		if (azureAuth) {
			Logger.piiSanitized(`Getting account security token for ${JSON.stringify(account.key)} (tenant ${tenantId}). Auth Method = ${azureAuth.userFriendlyName}`, [], []);
			if (this.authLibrary === Constants.AuthLibrary.MSAL) {
				try {
					// Fetch cached token from local cache if token is available and valid.
					let accessToken = await this.msalCacheProvider.getTokenFromLocalCache(account.key.accountId, tenantId, resource);
					if (this.isValidToken(accessToken)) {
						return accessToken;
					} // else fallback to fetching a new token.
				} catch (e) {
					// Log any error and move on to fetching fresh access token.
					Logger.info(`Could not fetch access token from cache: ${e}, fetching new access token instead.`);
				}
				tenantId = tenantId || account.properties.owningTenant.id;
				if (getTenantIgnoreList().includes(tenantId)) {
					// Tenant found in ignore list, don't fetch access token.
					Logger.info(`Tenant ${tenantId} found in the ignore list, authentication will not be attempted.`);
					throw new Error(localize('tenantIgnoredError', `Token not acquired as tenant found in ignore list in setting: ${Constants.AzureTenantConfigFilterSetting}`));
				} else {
					let authResult = await azureAuth.getTokenMsal(account.key.accountId, resource, tenantId);
					if (this.isAuthenticationResult(authResult) && authResult.account && authResult.account.idTokenClaims) {
						const token: Token = {
							key: authResult.account.homeAccountId,
							token: authResult.accessToken,
							tokenType: authResult.tokenType,
							expiresOn: authResult.account.idTokenClaims.exp!,
							tenantId: tenantId,
							resource: resource
						};
						try {
							await this.msalCacheProvider.writeTokenToLocalCache(token);
						} catch (e) {
							Logger.error(`Could not save access token to local cache: ${e}, this might cause throttling of AAD requests.`);
						}
						return token;
					} else {
						Logger.error(`MSAL: getToken call failed`);
						// Throw error with MSAL-specific code/message, else throw generic error message
						if (this.isProviderError(authResult)) {
							throw new Error(localize('msalTokenError', `{0} occurred when acquiring token. \n{1}`, authResult.errorCode, authResult.errorMessage));
						} else {
							throw new Error(localize('genericTokenError', 'Failed to get token'));
						}
					}
				}
			} else { // fallback to ADAL as default
				return azureAuth.getAccountSecurityTokenAdal(account, tenantId, resource);
			}
		} else {
			account.isStale = true;
			Logger.error(`_getAccountSecurityToken: Authentication method not found for account ${account.displayInfo.displayName}`);
			throw Error('Failed to get authentication method, please remove and re-add the account');
		}
	}

	private isAuthenticationResult(result: AuthenticationResult | azdata.ProviderError | null): result is AuthenticationResult {
		if (result) {
			return typeof (<AuthenticationResult>result).accessToken === 'string';
		} else {
			return false;
		}
	}

	private isProviderError(result: AuthenticationResult | azdata.ProviderError | null): result is azdata.ProviderError {
		if (result) {
			return typeof (<azdata.ProviderError>result).errorMessage === 'string';
		} else {
			return false;
		}
	}

	/**
	 * Validates if access token is still valid by checking it's expiration time has a threshold of atleast 2 mins.
	 * @param accessToken Access token to be validated
	 * @returns True if access token is valid.
	 */
	private isValidToken(accessToken: Token | undefined): boolean {
		const currentTime = new Date().getTime() / 1000;
		return (accessToken !== undefined && accessToken.expiresOn !== undefined
			&& Number(accessToken.expiresOn) - currentTime > 2 * 60); // threshold = 2 mins
	}

	private async _getSecurityToken(account: AzureAccount, resource: azdata.AzureResource): Promise<MultiTenantTokenResponse | undefined> {
		void vscode.window.showInformationMessage(localize('azure.deprecatedGetSecurityToken', "A call was made to azdata.accounts.getSecurityToken, this method is deprecated and will be removed in future releases. Please use getAccountSecurityToken instead."));
		const azureAccount = account as AzureAccount;
		const response: MultiTenantTokenResponse = {};
		for (const tenant of azureAccount.properties.tenants) {
			response[tenant.id] = await this._getAccountSecurityToken(account, tenant.id, resource);
		}

		return response;
	}

	prompt(): Thenable<AzureAccount | azdata.PromptFailedResult> {
		return this._prompt();
	}

	private async _prompt(): Promise<AzureAccount | azdata.PromptFailedResult> {
		const noAuthSelected = localize('azure.NoAuthMethod.Selected', "No Azure auth method selected. You must select what method of authentication you want to use.");
		const noAuthAvailable = localize('azure.NoAuthMethod.Available', "No Azure auth method available. You must enable the auth methods in ADS configuration.");

		await this.initCompletePromise;
		class Option implements vscode.QuickPickItem {
			public readonly label: string;
			constructor(public readonly azureAuth: AzureAuth) {
				this.label = azureAuth.userFriendlyName;
			}
		}

		if (this.authMappings.size === 0) {
			Logger.error('No auth method was enabled.');
			void vscode.window.showErrorMessage(noAuthAvailable);
			return { canceled: true };
		}

		if (this.authMappings.size === 1) {
			return this.getAuthMethod(undefined).startLogin();
		}

		const options: Option[] = [];
		this.authMappings.forEach((azureAuth) => {
			options.push(new Option(azureAuth));
		});

		const pick = await vscode.window.showQuickPick(options, { canPickMany: false });

		if (!pick) {
			Logger.error('No auth method was selected.');
			void vscode.window.showErrorMessage(noAuthSelected);
			return { canceled: true };
		}

		return pick.azureAuth.startLogin();
	}
	refresh(account: AzureAccount): Thenable<AzureAccount | azdata.PromptFailedResult> {
		return this._refresh(account);
	}

	private async _refresh(account: AzureAccount): Promise<AzureAccount | azdata.PromptFailedResult> {
		await this._clear(account.key);
		return this.prompt();
	}

	async clear(accountKey: azdata.AccountKey): Promise<void> {
		return this._clear(accountKey);
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		await this.initCompletePromise;
		await this.getAuthMethod(undefined)?.clearCredentials(accountKey);
	}

	autoOAuthCancelled(): Thenable<void> {
		this.authMappings.forEach(val => val.autoOAuthCancelled());
		return Promise.resolve();
	}
}
