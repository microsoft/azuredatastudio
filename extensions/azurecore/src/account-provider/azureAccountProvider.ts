/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { Logger } from '../utils/Logger';
import { MultiTenantTokenResponse, Token, AzureAuth } from './auths/azureAuth';
import { AzureAuthCodeGrant } from './auths/azureAuthCodeGrant';
import { AzureDeviceCode } from './auths/azureDeviceCode';
import * as Constants from '../constants';
import { MsalCachePluginProvider } from './utils/msalCachePlugin';
import { TenantIgnoredError } from '../utils/TenantIgnoredError';
import { multiple_matching_tokens_error } from '../constants';

const localize = nls.loadMessageBundle();

export class AzureAccountProvider implements azdata.AccountProvider, vscode.Disposable {
	private readonly authMappings = new Map<AzureAuthType, AzureAuth>();
	private initComplete!: Deferred<void, Error>;
	private initCompletePromise: Promise<void> = new Promise<void>((resolve, reject) => this.initComplete = { resolve, reject });
	public clientApplication: PublicClientApplication;

	constructor(
		metadata: AzureAccountProviderMetadata,
		context: vscode.ExtensionContext,
		clientApplication: PublicClientApplication,
		private readonly msalCacheProvider: MsalCachePluginProvider,
		uriEventHandler: vscode.EventEmitter<vscode.Uri>,
		private readonly forceDeviceCode: boolean = false
	) {
		this.clientApplication = clientApplication;

		vscode.workspace.onDidChangeConfiguration((changeEvent) => {
			const impactProvider = changeEvent.affectsConfiguration(Constants.AccountsAzureAuthSection);
			if (impactProvider === true) {
				this.handleAuthMapping(metadata, context, uriEventHandler);
			}
		});

		this.handleAuthMapping(metadata, context, uriEventHandler);
	}

	dispose() {
		this.authMappings.forEach(x => x.dispose());
	}

	clearTokenCache(): Thenable<void> {
		Logger.verbose("In AzureAccountProvider: clearTokenCache");
		Logger.verbose("Clearing token cache");
		return this.getAuthMethod().deleteAllCache();
	}

	private handleAuthMapping(metadata: AzureAccountProviderMetadata, context: vscode.ExtensionContext, uriEventHandler: vscode.EventEmitter<vscode.Uri>) {
		Logger.verbose("In AzureAccountProvider: handleAuthMapping");
		this.authMappings.forEach(m => m.dispose());
		this.authMappings.clear();

		const configuration = vscode.workspace.getConfiguration(Constants.AccountsAzureAuthSection);
		const codeGrantMethod: boolean = configuration.get<boolean>(Constants.AuthType.CodeGrant, false);
		const deviceCodeMethod: boolean = configuration.get<boolean>(Constants.AuthType.DeviceCode, false);

		if (codeGrantMethod === true && !this.forceDeviceCode) {
			Logger.verbose("Code grant method selected")
			this.authMappings.set(AzureAuthType.AuthCodeGrant, new AzureAuthCodeGrant(metadata, this.msalCacheProvider, context, uriEventHandler, this.clientApplication));
		}
		if (deviceCodeMethod === true || this.forceDeviceCode) {
			Logger.verbose("Device code method selected");
			this.authMappings.set(AzureAuthType.DeviceCode, new AzureDeviceCode(metadata, this.msalCacheProvider, context, uriEventHandler, this.clientApplication));
		}
		if (codeGrantMethod === false && deviceCodeMethod === false && !this.forceDeviceCode) {
			Logger.error("No authentication methods selected");
			console.error('No authentication methods selected');
		}
	}

	private getAuthMethod(account?: AzureAccount): AzureAuth {
		Logger.verbose("In AzureAccountProvider: getAuthMethod");
		if (this.authMappings.size === 1) {
			const authMethod: AzureAuth = this.authMappings.values().next().value as AzureAuth;
			Logger.verbose(`Using auth method ${authMethod.userFriendlyName}`);
			return authMethod;
		}

		const authType: AzureAuthType | undefined = account?.properties?.azureAuthType;
		if (authType) {
			Logger.verbose(`Using the following authType: ${authType}`);
			const authMapping = this.authMappings.get(authType);
			if (authMapping) {
				Logger.verbose(`Using auth method ${authMapping.userFriendlyName}`);
				return authMapping;
			}
		}
		if (this.authMappings.size === 0) {
			Logger.error("No authentication mappings selected")
			throw new Error('No authentication mappings selected');
		}

		const auth = this.authMappings.values().next().value as AzureAuth;
		Logger.verbose(`Using first auth method found in authMappings: ${auth.userFriendlyName}`);
		return auth;
	}

	initialize(storedAccounts: AzureAccount[]): Thenable<AzureAccount[]> {
		return this._initialize(storedAccounts);
	}

	private async _initialize(storedAccounts: AzureAccount[]): Promise<AzureAccount[]> {
		Logger.verbose("In AzureAccountProvider: _initialize");
		const accounts: AzureAccount[] = [];
		Logger.verbose(`Initializing with the following storedAccounts: ${JSON.stringify(storedAccounts)}`);
		for (let account of storedAccounts) {
			const azureAuth = this.getAuthMethod(account);
			if (!azureAuth) {
				Logger.verbose(`Authentication method not found for account ${account.displayInfo.displayName}. Marking account as stale.`);
				account.isStale = true;
				accounts.push(account);
			} else {
				account.isStale = false;
				// Check MSAL Cache before adding account, to mark it as stale if it is not present in cache
				const accountInCache = await azureAuth.getAccountFromMsalCache(account.key.accountId);
				if (!accountInCache) {
					Logger.piiSanitized(`Account ${JSON.stringify(account.key)} not found in MSAL cache. Marking account as stale.`, [], []);
					account.isStale = true;
				}
				accounts.push(account);

			}
		}
		this.initComplete.resolve();
		Logger.verbose(`_Initialize - returning the following accounts: ${JSON.stringify(accounts)}`);
		return accounts;
	}

	getSecurityToken(account: AzureAccount, resource: azdata.AzureResource): Thenable<MultiTenantTokenResponse | undefined> {
		Logger.verbose("In AzureAccountProvider: getSecurityToken");
		return this._getSecurityToken(account, resource);
	}

	getAccountSecurityToken(account: AzureAccount, tenantId: string, resource: azdata.AzureResource): Thenable<Token | undefined> {
		Logger.verbose("In AzureAccountProvider: getAccountSecurityToken");
		return this._getAccountSecurityToken(account, tenantId, resource);
	}

	private async _getAccountSecurityToken(account: AzureAccount, tenantId: string, resource: azdata.AzureResource): Promise<Token | undefined> {
		Logger.verbose("In AzureAccountProvider: _getAccountSecurityToken");

		await this.initCompletePromise;
		const azureAuth = this.getAuthMethod(account);
		if (azureAuth) {
			Logger.piiSanitized(`Getting account security token for ${JSON.stringify(account.key)} (tenant ${tenantId}). Auth Method = ${azureAuth.userFriendlyName}`, [], []);
			try {
				// Fetch cached token from local cache if token is available and valid.
				let accessToken = await this.msalCacheProvider.getTokenFromLocalCache(account.key.accountId, tenantId, resource);
				if (this.isValidToken(accessToken) &&
					// Ensure MSAL Cache contains user account
					(await this.clientApplication.getAllAccounts()).find((accountInfo) => accountInfo.homeAccountId === account.key.accountId)) {
					Logger.verbose("Found valid token in cache, returning it.");
					return accessToken;
				} // else fallback to fetching a new token.
			} catch (e) {
				// Log any error and move on to fetching fresh access token.
				Logger.info(`Could not fetch access token from cache: ${e}, fetching new access token instead.`);
			}
			tenantId = tenantId || account.properties.owningTenant.id;
			let authResult = await azureAuth.getToken(account.key.accountId, resource, tenantId);
			if (this.isAuthenticationResult(authResult) && authResult.account && authResult.account.idTokenClaims) {
				Logger.verbose("Hydrating token object from authResult");
				const token: Token = {
					key: authResult.account.homeAccountId,
					token: authResult.accessToken,
					tokenType: authResult.tokenType,
					expiresOn: authResult.account.idTokenClaims.exp!,
					tenantId: tenantId,
					resource: resource
				};
				try {
					Logger.verbose("Writing token to local cache");
					await this.msalCacheProvider.writeTokenToLocalCache(token);
				} catch (e) {
					Logger.error(`Could not save access token to local cache: ${e}, this might cause throttling of AAD requests.`);
				}
				Logger.verbose("Returning hydrated token object");
				return token;
			} else {
				Logger.error(`MSAL: getToken call failed: ${authResult}`);
				// Throw error with MSAL-specific code/message, else throw generic error message
				if (this.isProviderError(authResult)) {
					if (authResult.errorCode?.includes(multiple_matching_tokens_error)) {
						Logger.info("To resolve this error, please clear token cache, and refresh account credentials.");
						authResult.errorMessage = authResult.errorMessage?.concat(` To resolve this error, please clear token cache, and refresh account credentials.`);
					}
					Logger.error(`_getAccountSecurityToken: Authentication method failed for account ${account.displayInfo.displayName} with error: ${authResult.errorMessage}`);
					throw new Error(localize('msalTokenError', `{0} occurred when acquiring token. \n{1}`, authResult.errorCode, authResult.errorMessage));
				} else {
					Logger.error(`_getAccountSecurityToken: Authentication method failed for account ${account.displayInfo.displayName}`);
					throw new Error(localize('genericTokenError', 'Failed to get token'));
				}
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
		Logger.verbose("In AzureAccountProvider: isValidToken");

		const currentTime = new Date().getTime() / 1000;
		const isValid = (accessToken !== undefined && accessToken.expiresOn !== undefined
			&& Number(accessToken.expiresOn) - currentTime > 5 * 60); // threshold = 5 mins (matches the threshold used in MSAL dotnet)

		Logger.verbose(`isValidToken - returning ${isValid ? 'true' : 'false'}`);

		return isValid;
	}

	private async _getSecurityToken(account: AzureAccount, resource: azdata.AzureResource): Promise<MultiTenantTokenResponse | undefined> {
		Logger.verbose("In AzureAccountProvider: _getSecurityToken");
		void vscode.window.showInformationMessage(localize('azure.deprecatedGetSecurityToken', "A call was made to azdata.accounts.getSecurityToken, this method is deprecated and will be removed in future releases. Please use getAccountSecurityToken instead."));
		const azureAccount = account as AzureAccount;
		const response: MultiTenantTokenResponse = {};
		for (const tenant of azureAccount.properties.tenants) {
			try {
				response[tenant.id] = await this._getAccountSecurityToken(account, tenant.id, resource);
			} catch (e) {
				if (!(e instanceof TenantIgnoredError)) {
					Logger.error(`_getAccountSecuirtyToken failed for tenantId: ${tenant.id}, with error: ${e}`);
					throw e;
				}
			}
		}

		Logger.verbose(`_getSecurityToken - returning a non-empty response: ${response ? "true" : "false"}`);
		return response;
	}

	prompt(): Thenable<AzureAccount | azdata.PromptFailedResult> {
		return this._prompt();
	}

	private async _prompt(): Promise<AzureAccount | azdata.PromptFailedResult> {
		Logger.verbose("In AzureAccountProvider: _prompt");
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
			Logger.verbose("Only one auth method available, starting login with that auth method");
			return this.getAuthMethod(undefined).startLogin();
		}

		const options: Option[] = [];
		this.authMappings.forEach((azureAuth) => {
			options.push(new Option(azureAuth));
		});
		Logger.verbose("The following auth options were loaded: " + JSON.stringify(options));

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
		Logger.piiSanitized(`In refresh - refreshing the following account: ${account.key}`, [], []);
		await this._clear(account.key);
		return this.prompt();
	}

	async clear(accountKey: azdata.AccountKey): Promise<void> {
		Logger.verbose(`In AzureAccountProvider: clear`);
		return this._clear(accountKey);
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		Logger.piiSanitized(`In AzureAccountProvider: _clear - clearing the following account: ${JSON.stringify(accountKey)}`, [], []);
		await this.initCompletePromise;
		await this.getAuthMethod(undefined)?.clearCredentials(accountKey);
	}

	autoOAuthCancelled(): Thenable<void> {
		this.authMappings.forEach(val => val.autoOAuthCancelled());
		return Promise.resolve();
	}
}
