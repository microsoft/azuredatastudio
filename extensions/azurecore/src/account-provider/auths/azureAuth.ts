/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

import {
	AzureAccount,
	AzureAccountProviderMetadata,
	AzureAuthType,
	Resource,
	Tenant
} from 'azurecore';

import { Deferred } from '../interfaces';
import * as url from 'url';
import * as Constants from '../../constants';
import { SimpleTokenCache } from '../utils/simpleTokenCache';
import { MemoryDatabase } from '../utils/memoryDatabase';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from '../../utils/Logger';
import * as qs from 'qs';
import { AzureAuthError } from './azureAuthError';
import { AccountInfo, AuthError, AuthenticationResult, InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-node';
import { HttpClient } from './httpClient';
import { getProxyEnabledHttpClient, getTenantIgnoreList, updateTenantIgnoreList } from '../../utils';
import { errorToPromptFailedResult } from './networkUtils';
import { MsalCachePluginProvider } from '../utils/msalCachePlugin';
import { AzureListOperationResponse, ErrorResponseBodyWithError, isErrorResponseBodyWithError } from '../../azureResource/utils';
const localize = nls.loadMessageBundle();

export abstract class AzureAuth implements vscode.Disposable {
	protected readonly memdb = new MemoryDatabase<string>();
	protected readonly loginEndpointUrl: string;
	public readonly commonTenant: Tenant;
	public readonly organizationTenant: Tenant;
	protected readonly redirectUri: string;
	protected readonly scopes: string[];
	protected readonly scopesString: string;
	protected readonly clientId: string;
	protected readonly resources: Resource[];
	protected readonly httpClient: HttpClient;
	private _authLibrary: string | undefined;

	constructor(
		protected readonly metadata: AzureAccountProviderMetadata,
		protected readonly tokenCache: SimpleTokenCache,
		protected readonly msalCacheProvider: MsalCachePluginProvider,
		protected readonly context: vscode.ExtensionContext,
		protected clientApplication: PublicClientApplication,
		protected readonly uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
		protected readonly authType: AzureAuthType,
		public readonly userFriendlyName: string,
		public readonly authLibrary: string
	) {
		this._authLibrary = authLibrary;

		this.loginEndpointUrl = this.metadata.settings.host;
		this.commonTenant = {
			id: 'common',
			displayName: 'common',
		};
		this.organizationTenant = {
			id: 'organizations',
			displayName: 'organizations',
		};
		this.redirectUri = this.metadata.settings.redirectUri;
		this.clientId = this.metadata.settings.clientId;
		this.resources = [
			this.metadata.settings.armResource,
			this.metadata.settings.graphResource,
			this.metadata.settings.azureKeyVaultResource
		];

		if (this.metadata.settings.sqlResource) {
			this.resources.push(this.metadata.settings.sqlResource);
		}
		if (this.metadata.settings.ossRdbmsResource) {
			this.resources.push(this.metadata.settings.ossRdbmsResource);
		}
		if (this.metadata.settings.microsoftResource) {
			this.resources.push(this.metadata.settings.microsoftResource);
		}
		if (this.metadata.settings.azureDevOpsResource) {
			this.resources.push(this.metadata.settings.azureDevOpsResource);
		}
		if (this.metadata.settings.azureLogAnalyticsResource) {
			this.resources.push(this.metadata.settings.azureLogAnalyticsResource);
		}
		if (this.metadata.settings.azureKustoResource) {
			this.resources.push(this.metadata.settings.azureKustoResource);
		}

		if (this.metadata.settings.powerBiResource) {
			this.resources.push(this.metadata.settings.powerBiResource);
		}

		this.scopes = [...this.metadata.settings.scopes];
		this.scopesString = this.scopes.join(' ');
		this.httpClient = getProxyEnabledHttpClient();
	}

	public async startLogin(): Promise<AzureAccount | azdata.PromptFailedResult> {
		let loginComplete: Deferred<void, Error> | undefined = undefined;
		try {
			Logger.verbose('Starting login');
			if (!this.metadata.settings.microsoftResource) {
				throw new Error(localize('noMicrosoftResource', "Provider '{0}' does not have a Microsoft resource endpoint defined.", this.metadata.displayName));
			}
			if (this._authLibrary === Constants.AuthLibrary.MSAL) {
				const result = await this.loginMsal(this.organizationTenant, this.metadata.settings.microsoftResource);
				loginComplete = result.authComplete;
				if (!result?.response || !result.response?.account) {
					Logger.error(`Authentication failed: ${loginComplete}`);
					return {
						canceled: false
					};
				}
				const token: Token = {
					token: result.response.accessToken,
					key: result.response.account.homeAccountId,
					tokenType: result.response.tokenType,
					expiresOn: result.response.expiresOn!.getTime() / 1000
				};
				const tokenClaims = <TokenClaims>result.response.idTokenClaims;
				const account = await this.hydrateAccount(token, tokenClaims);
				loginComplete?.resolve();
				return account;
			} else {// fallback to ADAL as default
				const result = await this.loginAdal(this.commonTenant, this.metadata.settings.microsoftResource);
				loginComplete = result.authComplete;
				if (!result?.response) {
					Logger.error('Authentication failed - no response');
					return {
						canceled: false
					};
				}
				const account = await this.hydrateAccount(result.response.accessToken, result.response.tokenClaims);
				loginComplete?.resolve();
				return account;
			}
		} catch (ex) {
			Logger.error(`Login failed: ${ex}`);
			if (ex instanceof AzureAuthError) {
				if (loginComplete) {
					loginComplete.reject(ex);
				}
				Logger.error(ex.originalMessageAndException);
			} else {
				const promptFailedResult = errorToPromptFailedResult(ex);
				if (promptFailedResult.errorMessage) {
					loginComplete?.reject(new AzureAuthError(promptFailedResult.errorMessage, promptFailedResult.errorMessage, undefined));
					return promptFailedResult;
				}
				Logger.error(ex);
			}
			return errorToPromptFailedResult(ex);
		}
	}

	public async refreshAccessAdal(account: AzureAccount): Promise<AzureAccount> {
		// Deprecated account - delete it.
		if (account.key.accountVersion !== Constants.AccountVersion) {
			account.delete = true;
			return account;
		}
		try {
			// There can be multiple home tenants
			// We want to return the one that owns the Azure account.
			// Not doing so can result in token being issued for the wrong tenant
			const tenant = account.properties.owningTenant;
			const tokenResult = await this.getAccountSecurityTokenAdal(account, tenant.id, azdata.AzureResource.MicrosoftResourceManagement);
			if (!tokenResult) {
				account.isStale = true;
				return account;
			}

			return await this.hydrateAccount(tokenResult, this.getTokenClaims(tokenResult.token));
		} catch (ex) {
			if (ex instanceof AzureAuthError) {
				void vscode.window.showErrorMessage(ex.message);
				Logger.error(`Error refreshing access for account ${account.displayInfo.displayName}`, ex.originalMessageAndException);
			} else {
				Logger.error(ex);
			}
			account.isStale = true;
			return account;
		}
	}

	public async hydrateAccount(token: Token | AccessToken, tokenClaims: TokenClaims): Promise<AzureAccount> {
		let account: azdata.Account;
		if (this._authLibrary === Constants.AuthLibrary.MSAL) {
			const tenants = await this.getTenantsMsal(token.token, tokenClaims);
			account = this.createAccount(tokenClaims, token.key, tenants);
		} else { // fallback to ADAL as default
			const tenants = await this.getTenantsAdal({ ...token });
			account = this.createAccount(tokenClaims, token.key, tenants);
		}
		return account;
	}

	public async getAccountSecurityTokenAdal(account: AzureAccount, tenantId: string, azureResource: azdata.AzureResource): Promise<Token | undefined> {
		if (account.isStale === true) {
			Logger.error('Account was stale. No tokens being fetched.');
			return undefined;
		}

		const resource = this.resources.find(s => s.azureResourceId === azureResource);

		if (!resource) {
			Logger.error(`Unable to find Azure resource ${azureResource}`);
			return undefined;
		}

		if (!account.properties.owningTenant) {
			// Should never happen
			throw new AzureAuthError(localize('azure.owningTenantNotFound', "Owning Tenant information not found for account."), 'Owning tenant not found.', undefined);
		}

		const tenant = account.properties.owningTenant?.id === tenantId
			? account.properties.owningTenant
			: account.properties.tenants.find(t => t.id === tenantId);

		if (!tenant) {
			throw new AzureAuthError(localize('azure.tenantNotFound', "Specified tenant with ID '{0}' not found.", tenantId), `Tenant ${tenantId} not found.`, undefined);
		}

		const cachedTokens = await this.getSavedTokenAdal(tenant, resource, account.key);

		// Let's check to see if we can just use the cached tokens to return to the user
		if (cachedTokens) {
			let expiry = Number(cachedTokens.expiresOn);
			if (Number.isNaN(expiry)) {
				Logger.error('Expiration time was not defined. This is expected on first launch');
				expiry = 0;
			}
			const currentTime = new Date().getTime() / 1000;

			let accessToken = cachedTokens.accessToken;
			let expiresOn = Number(cachedTokens.expiresOn);
			const remainingTime = expiry - currentTime;
			const maxTolerance = 2 * 60; // two minutes

			if (remainingTime < maxTolerance) {
				const result = await this.refreshTokenAdal(tenant, resource, cachedTokens.refreshToken);
				if (result) {
					accessToken = result.accessToken;
					expiresOn = Number(result.expiresOn);
				}
			}
			// Let's just return here.
			if (accessToken) {
				return {
					...accessToken,
					expiresOn: expiresOn,
					tokenType: Constants.Bearer
				};
			}
		}

		// User didn't have any cached tokens, or the cached tokens weren't useful.
		// For most users we can use the refresh token from the general microsoft resource to an access token of basically any type of resource we want.
		if (!this.metadata.settings.microsoftResource) {
			throw new Error(localize('noMicrosoftResource', "Provider '{0}' does not have a Microsoft resource endpoint defined.", this.metadata.displayName));
		}
		const baseTokens = await this.getSavedTokenAdal(this.commonTenant, this.metadata.settings.microsoftResource, account.key);
		if (!baseTokens) {
			Logger.error('User had no base tokens for the basic resource registered. This should not happen and indicates something went wrong with the authentication cycle');
			const msg = localize('azure.noBaseToken', 'Something failed with the authentication, or your tokens have been deleted from the system. Please try adding your account to Azure Data Studio again.');
			account.isStale = true;
			throw new AzureAuthError(msg, 'No base token found', undefined);
		}
		// Let's try to convert the access token type, worst case we'll have to prompt the user to do an interactive authentication.
		const result = await this.refreshTokenAdal(tenant, resource, baseTokens.refreshToken);
		if (result?.accessToken) {
			return {
				...result.accessToken,
				expiresOn: Number(result.expiresOn),
				tokenType: Constants.Bearer
			};
		}
		return undefined;
	}

	protected abstract loginAdal(tenant: Tenant, resource: Resource): Promise<{ response: OAuthTokenResponse | undefined, authComplete: Deferred<void, Error> }>;

	protected abstract loginMsal(tenant: Tenant, resource: Resource): Promise<{ response: AuthenticationResult | null, authComplete: Deferred<void, Error> }>;

	/**
	 * Refreshes a token, if a refreshToken is passed in then we use that. If it is not passed in then we will prompt the user for consent.
	 * @param tenant
	 * @param resource
	 * @param refreshToken
	 * @returns The oauth token response or undefined. Undefined is returned when the user wants to ignore a tenant or chooses not to start the
	 * re-authentication process for their tenant.
	 */
	public async refreshTokenAdal(tenant: Tenant, resource: Resource, refreshToken: RefreshToken | undefined): Promise<OAuthTokenResponse | undefined> {
		Logger.piiSanitized('Refreshing token', [{ name: 'token', objOrArray: refreshToken }], []);
		if (refreshToken) {
			const postData: RefreshTokenPostData = {
				grant_type: 'refresh_token',
				client_id: this.clientId,
				refresh_token: refreshToken.token,
				tenant: tenant.id,
				resource: resource.endpoint
			};
			return this.getTokenAdal(tenant, resource, postData);
		}
		return this.handleInteractionRequiredAdal(tenant, resource);
	}


	/**
	 * Gets the access token for the correct account and scope from the token cache, if the correct token doesn't exist in the token cache
	 * (i.e. expired token, wrong scope, etc.), sends a request for a new token using the refresh token
	 * @param accountId
	 * @param azureResource
	 * @returns The authentication result, including the access token.
	 * This function returns 'null' instead of 'undefined' by design as the same is returned by MSAL APIs in the flow (e.g. acquireTokenSilent).
	 */
	public async getTokenMsal(accountId: string, azureResource: azdata.AzureResource, tenantId: string): Promise<AuthenticationResult | azdata.PromptFailedResult | null> {
		const resource = this.resources.find(s => s.azureResourceId === azureResource);

		if (!resource) {
			Logger.error(`Unable to find Azure resource ${azureResource}`);
			throw new Error(localize('msal.resourceNotFoundError', `Unable to find configuration for Azure Resource {0}`, azureResource));
		}

		// Resource endpoint must end with '/' to form a valid scope for MSAL token request.
		const endpoint = resource.endpoint.endsWith('/') ? resource.endpoint : resource.endpoint + '/';
		let account: AccountInfo | null;
		let newScope;

		try {
			account = await this.getAccountFromMsalCache(accountId);
			if (!account) {
				Logger.error('Error: Could not fetch account when acquiring token');
				throw new Error(localize('msal.accountNotFoundError', `Unable to find account info when acquiring token, please remove account and add again.`));
			}
			if (resource.azureResourceId === azdata.AzureResource.ResourceManagement) {
				newScope = [`${endpoint}user_impersonation`];
			} else {
				newScope = [`${endpoint}.default`];
			}

			// construct request
			// forceRefresh needs to be set true here in order to fetch the correct token, due to this issue
			// https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/3687
			// Even for full tenants, access token is often received expired - force refresh is necessary when token expires.
			const tokenRequest = {
				account: account,
				authority: `${this.loginEndpointUrl}${tenantId}`,
				scopes: newScope,
				forceRefresh: true
			};
			try {
				return await this.clientApplication.acquireTokenSilent(tokenRequest);
			} catch (e) {
				Logger.error('Failed to acquireTokenSilent', e);
				if (e instanceof AuthError && this.accountNeedsRefresh(e)) {
					// build refresh token request
					const tenant: Tenant = {
						id: tenantId,
						displayName: ''
					};
					return this.handleInteractionRequiredMsal(tenant, resource);
				} else {
					if (e.name === 'ClientAuthError') {
						Logger.verbose('[ClientAuthError] Failed to silently acquire token');
					}
					return errorToPromptFailedResult(e);
				}
			}
		} catch (error) {
			Logger.error(`[ClientAuthError] Failed to find account: ${error}`);
			return errorToPromptFailedResult(error);
		}
	}

	public async getAccountFromMsalCache(accountId: string): Promise<AccountInfo | null> {
		const cache = this.clientApplication.getTokenCache();
		if (!cache) {
			Logger.error('Error: Could not fetch token cache.');
			return null;
		}

		let account: AccountInfo | null = null;
		// if the accountId is a home ID, it will include a "." character
		if (accountId.includes(".")) {
			account = await cache.getAccountByHomeId(accountId);
		} else {
			account = await cache.getAccountByLocalId(accountId);
		}
		return account;
	}

	public async getTokenAdal(tenant: Tenant, resource: Resource, postData: AuthorizationCodePostData | TokenPostData | RefreshTokenPostData): Promise<OAuthTokenResponse | undefined> {
		Logger.verbose('Fetching token for tenant {0}', tenant.id);
		const tokenUrl = `${this.loginEndpointUrl}${tenant.id}/oauth2/token`;
		const response = await this.makePostRequest(tokenUrl, postData);

		// ADAL is being deprecated so just ignoring these for now
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		Logger.piiSanitized('Token: ', [{ name: 'access token', objOrArray: response.data }, { name: 'refresh token', objOrArray: response.data }], []);
		if (response.data.error === 'interaction_required') {
			return this.handleInteractionRequiredAdal(tenant, resource);
		}
		if (response.data.error) {
			Logger.error(`Response returned error : ${response.data}`);
			throw new AzureAuthError(localize('azure.responseError', "Token retrieval failed with an error. [Open developer tools]({0}) for more details.", 'command:workbench.action.toggleDevTools'), 'Token retrieval failed', undefined);
		}
		// ADAL is being deprecated so just ignoring these for now
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const accessTokenString = response.data.access_token;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const refreshTokenString = response.data.refresh_token;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const expiresOnString = response.data.expires_on;
		return this.getTokenHelperAdal(tenant, resource, accessTokenString, refreshTokenString, expiresOnString);
	}

	public async getTokenHelperAdal(tenant: Tenant, resource: Resource, accessTokenString: string, refreshTokenString: string, expiresOnString: string): Promise<OAuthTokenResponse> {
		if (!accessTokenString) {
			const msg = localize('azure.accessTokenEmpty', 'No access token returned from Microsoft OAuth');
			throw new AzureAuthError(msg, 'Access token was empty', undefined);
		}

		const tokenClaims: TokenClaims = this.getTokenClaims(accessTokenString);
		let userKey: string;

		// Personal accounts don't have an oid when logging into the `common` tenant, but when logging into their home tenant they end up having an oid.
		// This makes the key for the same account be different.
		// We need to special case personal accounts.
		if (tokenClaims.idp === 'live.com') { // Personal account
			userKey = tokenClaims.unique_name ?? tokenClaims.email ?? tokenClaims.sub;
		} else {
			userKey = tokenClaims.home_oid ?? tokenClaims.oid ?? tokenClaims.unique_name ?? tokenClaims.email ?? tokenClaims.sub;
		}

		if (!userKey) {
			const msg = localize('azure.noUniqueIdentifier', "The user had no unique identifier within AAD");
			throw new AzureAuthError(msg, 'No unique identifier', undefined);
		}

		const accessToken: AccessToken = {
			token: accessTokenString,
			key: userKey
		};
		let refreshToken: RefreshToken | undefined = undefined;

		if (refreshTokenString) {
			refreshToken = {
				token: refreshTokenString,
				key: userKey
			};
		}

		const result: OAuthTokenResponse = {
			accessToken,
			refreshToken,
			tokenClaims,
			expiresOn: expiresOnString
		};

		const accountKey: azdata.AccountKey = {
			providerId: this.metadata.id,
			accountId: userKey,
			authLibrary: this._authLibrary
		};

		await this.saveTokenAdal(tenant, resource, accountKey, result);

		return result;
	}

	public async getTenantsMsal(token: string, tokenClaims: TokenClaims): Promise<Tenant[]> {
		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2020-01-01');
		try {
			Logger.verbose(`Fetching tenants with uri: ${tenantUri}`);
			let tenantList: string[] = [];

			const tenantResponse = await this.httpClient.sendGetRequestAsync<AzureListOperationResponse<TenantResponse[]> | ErrorResponseBodyWithError>(tenantUri, {
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});

			const data = tenantResponse.data;
			if (isErrorResponseBodyWithError(data)) {
				Logger.error(`Error fetching tenants :${data.error?.code} - ${data.error?.message}`);
				throw new Error(`${data.error?.code} - ${data.error?.message}`);
			}
			const tenants: Tenant[] = data.value.map((tenantInfo: TenantResponse) => {
				if (tenantInfo.displayName) {
					tenantList.push(tenantInfo.displayName);
				} else {
					tenantList.push(tenantInfo.tenantId);
					Logger.info('Tenant display name found empty: {0}', tenantInfo.tenantId);
				}
				return {
					id: tenantInfo.tenantId,
					displayName: tenantInfo.displayName ? tenantInfo.displayName : tenantInfo.tenantId,
					userId: tokenClaims.oid,
					tenantCategory: tenantInfo.tenantCategory
				} as Tenant;
			});

			Logger.verbose(`Tenants: ${tenantList}`);
			const homeTenantIndex = tenants.findIndex(tenant => tenant.tenantCategory === Constants.HomeCategory);
			// remove home tenant from list of tenants
			if (homeTenantIndex >= 0) {
				const homeTenant = tenants.splice(homeTenantIndex, 1);
				tenants.unshift(homeTenant[0]);
			}
			Logger.verbose(`Filtered Tenants: ${tenantList}`);
			return tenants;
		} catch (ex) {
			Logger.error(`Error fetching tenants :${ex}`);
			throw ex;
		}
	}


	//#region tenant calls
	public async getTenantsAdal(token: AccessToken): Promise<Tenant[]> {
		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2020-01-01');
		try {
			Logger.verbose(`Fetching tenants with uri: ${tenantUri}`);
			let tenantList: string[] = [];
			const tenantResponse = await this.makeGetRequest(tenantUri, token.token);
			if (tenantResponse.status !== 200) {
				Logger.error(`Error with tenant response, status: ${tenantResponse.status} | status text: ${tenantResponse.statusText}`);
				Logger.error(`Headers: ${JSON.stringify(tenantResponse.headers)}`);
				throw new Error('Error with tenant response');
			}
			// ADAL is being deprecated so just ignoring these for now
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const tenants: Tenant[] = tenantResponse.data.value.map((tenantInfo: TenantResponse) => {
				if (tenantInfo.displayName) {
					tenantList.push(tenantInfo.displayName);
				} else {
					tenantList.push(tenantInfo.tenantId);
					Logger.info('Tenant display name found empty: {0}', tenantInfo.tenantId);
				}
				return {
					id: tenantInfo.tenantId,
					displayName: tenantInfo.displayName ? tenantInfo.displayName : tenantInfo.tenantId,
					userId: token.key,
					tenantCategory: tenantInfo.tenantCategory
				} as Tenant;
			});
			Logger.verbose(`Tenants: ${tenantList}`);
			const homeTenantIndex = tenants.findIndex(tenant => tenant.tenantCategory === Constants.HomeCategory);
			// remove home tenant from list of tenants
			if (homeTenantIndex >= 0) {
				const homeTenant = tenants.splice(homeTenantIndex, 1);
				tenants.unshift(homeTenant[0]);
			}

			return tenants;
		} catch (ex) {
			Logger.error(`Error fetching tenants :${ex}`);
			throw new Error('Error retrieving tenant information');
		}
	}

	//#endregion

	//#region token management
	private async saveTokenAdal(tenant: Tenant, resource: Resource, accountKey: azdata.AccountKey, { accessToken, refreshToken, expiresOn }: OAuthTokenResponse) {
		const msg = localize('azure.cacheErrorAdd', "Error when adding your account to the cache.");
		if (!tenant.id || !resource.id) {
			Logger.piiSanitized('Tenant ID or resource ID was undefined', [], [], tenant, resource);
			throw new AzureAuthError(msg, 'Adding account to cache failed', undefined);
		}
		try {
			Logger.piiSanitized(`Saving access token`, [{ name: 'access_token', objOrArray: accessToken }], []);
			await this.tokenCache.saveCredential(`${accountKey.accountId}_access_${resource.id}_${tenant.id}`, JSON.stringify(accessToken));
			Logger.piiSanitized(`Saving refresh token`, [{ name: 'refresh_token', objOrArray: refreshToken }], []);
			await this.tokenCache.saveCredential(`${accountKey.accountId}_refresh_${resource.id}_${tenant.id}`, JSON.stringify(refreshToken));
			this.memdb.set(`${accountKey.accountId}_${tenant.id}_${resource.id}`, expiresOn);
		} catch (ex) {
			Logger.error(ex);
			throw new AzureAuthError(msg, 'Adding account to cache failed', ex);
		}
	}

	public async getSavedTokenAdal(tenant: Tenant, resource: Resource, accountKey: azdata.AccountKey): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken | undefined, expiresOn: string } | undefined> {
		const getMsg = localize('azure.cacheErrorGet', "Error when getting your account from the cache");
		const parseMsg = localize('azure.cacheErrorParse', "Error when parsing your account from the cache");

		if (!tenant.id || !resource.id) {
			Logger.piiSanitized('Tenant ID or resource ID was undefined', [], [], tenant, resource);
			throw new AzureAuthError(getMsg, 'Getting account from cache failed', undefined);
		}

		let accessTokenString: string | undefined = undefined;
		let refreshTokenString: string | undefined = undefined;
		let expiresOn: string;
		try {
			Logger.info('Fetching saved token');
			accessTokenString = await this.tokenCache.getCredential(`${accountKey.accountId}_access_${resource.id}_${tenant.id}`);
			refreshTokenString = await this.tokenCache.getCredential(`${accountKey.accountId}_refresh_${resource.id}_${tenant.id}`);
			expiresOn = this.memdb.get(`${accountKey.accountId}_${tenant.id}_${resource.id}`);
		} catch (ex) {
			Logger.error(ex);
			throw new AzureAuthError(getMsg, 'Getting account from cache failed', ex);
		}

		try {
			if (!accessTokenString) {
				Logger.error('No access token found');
				return undefined;
			}
			const accessToken: AccessToken = JSON.parse(accessTokenString) as AccessToken;
			let refreshToken: RefreshToken | undefined = undefined;
			if (refreshTokenString) {
				refreshToken = JSON.parse(refreshTokenString) as RefreshToken;
			}
			Logger.piiSanitized('GetSavedToken ', [{ name: 'access', objOrArray: accessToken }, { name: 'refresh', objOrArray: refreshToken }], [], `expiresOn=${expiresOn}`);
			return {
				accessToken, refreshToken, expiresOn
			};
		} catch (ex) {
			Logger.error(ex);
			throw new AzureAuthError(parseMsg, 'Parsing account from cache failed', ex);
		}
	}
	//#endregion

	//#region interaction handling
	public async handleInteractionRequiredMsal(tenant: Tenant, resource: Resource): Promise<AuthenticationResult | null> {
		const shouldOpen = await this.askUserForInteraction(tenant, resource);
		if (shouldOpen) {
			const result = await this.loginMsal(tenant, resource);
			result?.authComplete?.resolve();
			return result?.response;
		}
		return null;
	}

	public async handleInteractionRequiredAdal(tenant: Tenant, resource: Resource): Promise<OAuthTokenResponse | undefined> {
		const shouldOpen = await this.askUserForInteraction(tenant, resource);
		if (shouldOpen) {
			const result = await this.loginAdal(tenant, resource);
			result?.authComplete?.resolve();
			return result?.response;
		}
		return undefined;
	}

	/**
	 * Determines whether the account needs to be refreshed based on received error instance
	 * and STS error codes from errorMessage.
	 * @param error AuthError instance
	 */
	private accountNeedsRefresh(error: AuthError): boolean {
		return error instanceof InteractionRequiredAuthError
			|| error.errorMessage.includes(Constants.AADSTS70043)
			|| error.errorMessage.includes(Constants.AADSTS50173);
	}

	/**
	 * Asks the user if they would like to do the interaction based authentication as required by OAuth2
	 * @param tenant
	 * @param resource
	 */
	private async askUserForInteraction(tenant: Tenant, resource: Resource): Promise<boolean> {
		if (!tenant.displayName && !tenant.id) {
			throw new Error('Tenant did not have display name or id');
		}
		const tenantIgnoreList = getTenantIgnoreList();

		// The user wants to ignore this tenant.
		if (tenantIgnoreList.includes(tenant.id)) {
			Logger.info(`Tenant ${tenant.id} found in the ignore list, authentication will not be attempted.`);
			return false;
		}

		interface ConsentMessageItem extends vscode.MessageItem {
			booleanResult: boolean;
			action?: (tenantId: string) => Promise<boolean>;
		}

		const openItem: ConsentMessageItem = {
			title: localize('azurecore.consentDialog.open', "Open"),
			booleanResult: true
		};

		const closeItem: ConsentMessageItem = {
			title: localize('azurecore.consentDialog.cancel', "Cancel"),
			isCloseAffordance: true,
			booleanResult: false
		};

		const cancelAndAuthenticate: ConsentMessageItem = {
			title: localize('azurecore.consentDialog.authenticate', "Cancel and Authenticate"),
			isCloseAffordance: true,
			booleanResult: true
		};

		const dontAskAgainItem: ConsentMessageItem = {
			title: localize('azurecore.consentDialog.ignore', "Ignore Tenant"),
			booleanResult: false,
			action: async (tenantId: string) => {
				return await confirmIgnoreTenantDialog();
			}
		};

		const confirmIgnoreTenantItem: ConsentMessageItem = {
			title: localize('azurecore.confirmIgnoreTenantDialog.confirm', "Confirm"),
			booleanResult: false,
			action: async (tenantId: string) => {
				tenantIgnoreList.push(tenantId);
				await updateTenantIgnoreList(tenantIgnoreList);
				return false;
			}

		};
		const confirmIgnoreTenantDialog = async () => {
			const confirmMessage = localize('azurecore.confirmIgnoreTenantDialog.body', "Azure Data Studio will no longer trigger authentication for this tenant {0} ({1}) and resources will not be accessible. \n\nTo allow access to resources for this tenant again, you will need to remove the tenant from the exclude list in the '{2}' setting.\n\nDo you wish to proceed?", tenant.displayName, tenant.id, Constants.AzureTenantConfigFilterSetting);
			let confirmation = await vscode.window.showInformationMessage(confirmMessage, { modal: true }, cancelAndAuthenticate, confirmIgnoreTenantItem);

			if (confirmation?.action) {
				await confirmation.action(tenant.id);
			}

			return confirmation?.booleanResult || false;
		}

		const messageBody = localize('azurecore.consentDialog.body', "Your tenant {0} ({1}) requires you to re-authenticate again to access {2} resources. Press Open to start the authentication process.", tenant.displayName, tenant.id, resource.endpoint);
		const result = await vscode.window.showInformationMessage(messageBody, { modal: true }, openItem, closeItem, dontAskAgainItem);

		let response = false;
		if (result?.action) {
			response = await result.action(tenant.id);
		}

		return result?.booleanResult || response;
	}
	//#endregion

	//#region data modeling

	public createAccount(tokenClaims: TokenClaims, key: string, tenants: Tenant[]): AzureAccount {
		Logger.verbose(`Token Claims acccount: ${tokenClaims.preferred_username}, TID: ${tokenClaims.tid}`);
		tenants.forEach((tenant) => {
			Logger.verbose(`Tenant ID: ${tenant.id}, Tenant Name: ${tenant.displayName}`);
		});

		// Determine if this is a microsoft account
		let accountIssuer = 'unknown';

		if (tokenClaims.iss === 'https://sts.windows.net/72f988bf-86f1-41af-91ab-2d7cd011db47/' ||
			tokenClaims.iss === `${this.loginEndpointUrl}72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0`) {
			accountIssuer = Constants.AccountIssuer.Corp;
		}
		if (tokenClaims?.idp === 'live.com') {
			accountIssuer = Constants.AccountIssuer.Msft;
		}

		const name = tokenClaims.name ?? tokenClaims.preferred_username ?? tokenClaims.email ?? tokenClaims.unique_name;
		const email = tokenClaims.preferred_username ?? tokenClaims.email ?? tokenClaims.unique_name;

		let owningTenant: Tenant = this.commonTenant; // default to common tenant

		// Read more about tid > https://learn.microsoft.com/azure/active-directory/develop/id-tokens
		if (tokenClaims.tid) {
			owningTenant = tenants.find(t => t.id === tokenClaims.tid) ?? { 'id': tokenClaims.tid, 'displayName': 'Microsoft Account' };
		} else {
			Logger.info('Could not find tenant information from tokenClaims, falling back to common Tenant.');
		}

		let displayName = name;
		if (email) {
			displayName = `${displayName} - ${email}`;
		}

		let contextualDisplayName: string;
		switch (accountIssuer) {
			case Constants.AccountIssuer.Corp:
				contextualDisplayName = localize('azure.microsoftCorpAccount', "Microsoft Corp");
				break;
			case Constants.AccountIssuer.Msft:
				contextualDisplayName = localize('azure.microsoftAccountDisplayName', 'Microsoft Account');
				break;
			default:
				contextualDisplayName = displayName;
		}

		let accountType = accountIssuer === Constants.AccountIssuer.Msft
			? Constants.AccountType.Microsoft
			: Constants.AccountType.WorkSchool;

		const account = {
			key: {
				providerId: this.metadata.id,
				accountId: key,
				accountVersion: Constants.AccountVersion,
				authLibrary: this._authLibrary
			},
			name: displayName,
			displayInfo: {
				accountType: accountType,
				userId: key,
				contextualDisplayName: contextualDisplayName,
				displayName,
				email,
				name,
			},
			properties: {
				providerSettings: this.metadata,
				isMsAccount: accountIssuer === Constants.AccountIssuer.Msft,
				owningTenant: owningTenant,
				tenants,
				azureAuthType: this.authType
			},
			isStale: false
		} as AzureAccount;

		return account;
	}

	//#endregion

	//#region network functions
	public async makePostRequest(url: string, postData: AuthorizationCodePostData | TokenPostData | DeviceCodeStartPostData | DeviceCodeCheckPostData): Promise<AxiosResponse<any>> {
		const config: AxiosRequestConfig = {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			validateStatus: () => true // Never throw
		};

		// Intercept response and print out the response for future debugging
		const response = await axios.post(url, qs.stringify(postData), config);
		// ADAL is being deprecated so just ignoring these for now
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		Logger.piiSanitized('POST request ', [{ name: 'data', objOrArray: postData }, { name: 'response', objOrArray: response.data }], [], url);
		return response;
	}

	private async makeGetRequest(url: string, token: string): Promise<AxiosResponse<any>> {
		const config: AxiosRequestConfig = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			validateStatus: () => true // Never throw
		};

		const response = await axios.get(url, config);
		// ADAL is being deprecated so just ignoring these for now
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		Logger.piiSanitized('GET request ', [{ name: 'response', objOrArray: response.data.value ?? response.data }], [], url,);
		return response;
	}

	//#endregion

	//#region inconsequential
	protected getTokenClaims(accessToken: string): TokenClaims {
		try {
			const split = accessToken.split('.');
			return JSON.parse(Buffer.from(split[1], 'base64').toString('UTF8'));
		} catch (ex) {
			throw new Error('Unable to read token claims: ' + JSON.stringify(ex));
		}
	}

	protected toBase64UrlEncoding(base64string: string): string {
		return base64string.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); // Need to use base64url encoding
	}

	public async deleteAllCacheMsal(): Promise<void> {
		this.clientApplication.clearCache();

		// unlink both cache files
		await this.msalCacheProvider.unlinkMsalCache();
		await this.msalCacheProvider.unlinkLocalCache();
	}

	public async deleteAllCacheAdal(): Promise<void> {
		const results = await this.tokenCache.findCredentials('');

		for (let { account } of results) {
			await this.tokenCache.clearCredential(account);
		}
	}

	public async clearCredentials(account: azdata.AccountKey): Promise<void> {
		try {
			// remove account based on authLibrary field, accounts added before this field was present will default to
			// ADAL method of account removal
			if (account.authLibrary === Constants.AuthLibrary.MSAL) {
				return await this.deleteAccountCacheMsal(account);
			} else { // fallback to ADAL by default
				return await this.deleteAccountCacheAdal(account);
			}
		} catch (ex) {
			// We need not prompt user for error if token could not be removed from cache.
			Logger.error('Error when removing token from cache: ', ex);
		}
	}

	private async deleteAccountCacheMsal(accountKey: azdata.AccountKey): Promise<void> {
		const tokenCache = this.clientApplication.getTokenCache();
		try {
			let msalAccount: AccountInfo | null = await this.getAccountFromMsalCache(accountKey.accountId);
			if (!msalAccount) {
				Logger.error(`MSAL: Unable to find account ${accountKey.accountId} for removal`);
				throw Error(`Unable to find account ${accountKey.accountId}`);
			}
			await tokenCache.removeAccount(msalAccount);
		} catch (error) {
			Logger.error(`[ClientAuthError] Failed to find account: ${error}`);
		}
		await this.msalCacheProvider.clearAccountFromLocalCache(accountKey.accountId);
	}

	private async deleteAccountCacheAdal(account: azdata.AccountKey): Promise<void> {
		const results = await this.tokenCache.findCredentials(account.accountId);
		if (!results) {
			Logger.error('ADAL: Unable to find account for removal');
		}
		for (let { account } of results) {
			await this.tokenCache.clearCredential(account);
		}
	}

	public async dispose() { }

	public async autoOAuthCancelled(): Promise<void> { }

	//#endregion
}

//#region models

export interface AccountKey {
	/**
	 * Account Key - uniquely identifies an account
	 */
	key: string
}

export interface AccessToken extends AccountKey {
	/**
	 * Access Token
	 */
	token: string;
}

export interface RefreshToken extends AccountKey {
	/**
	 * Refresh Token
	 */
	token: string;

	/**
	 * Account Key
	 */
	key: string
}

export interface TenantResponse { // https://docs.microsoft.com/en-us/rest/api/resources/tenants/list
	id: string
	tenantId: string
	displayName?: string
	tenantCategory?: string
}

export interface MultiTenantTokenResponse {
	[tenantId: string]: Token | undefined;
}

export interface Token extends AccountKey {
	/**
	 * Access token
	 */
	token: string;

	/**
	 * Access token expiry timestamp
	 */
	expiresOn: number | undefined;

	/**
	 * TokenType
	 */
	tokenType: string;

	/**
	 * Associated Tenant Id
	 */
	tenantId?: string;

	/**
	 * Resource to which token belongs to.
	 */
	resource?: azdata.AzureResource;
}

export interface TokenClaims { // https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens
	/**
	 * Identifies the intended recipient of the token. In id_tokens, the audience
	 * is your app's Application ID, assigned to your app in the Azure portal.
	 * This value should be validated. The token should be rejected if it fails
	 * to match your app's Application ID.
	 */
	aud: string;
	/**
	 * Identifies the issuer, or "authorization server" that constructs and
	 * returns the token. It also identifies the Azure AD tenant for which
	 * the user was authenticated. If the token was issued by the v2.0 endpoint,
	 * the URI will end in /v2.0. The GUID that indicates that the user is a consumer
	 * user from a Microsoft account is 9188040d-6c67-4c5b-b112-36a304b66dad.
	 * Your app should use the GUID portion of the claim to restrict the set of
	 * tenants that can sign in to the app, if applicable.
	 */
	iss: string;
	/**
	 * "Issued At" indicates when the authentication for this token occurred.
	 */
	iat: number;
	/**
	 * Records the identity provider that authenticated the subject of the token.
	 * This value is identical to the value of the Issuer claim unless the user
	 * account not in the same tenant as the issuer - guests, for instance.
	 * If the claim isn't present, it means that the value of iss can be used instead.
	 * For personal accounts being used in an organizational context (for instance,
	 * a personal account invited to an Azure AD tenant), the idp claim may be
	 * 'live.com' or an STS URI containing the Microsoft account tenant
	 * 9188040d-6c67-4c5b-b112-36a304b66dad.
	 */
	idp: string,
	/**
	 * The "nbf" (not before) claim identifies the time before which the JWT MUST NOT be accepted for processing.
	 */
	nbf: number;
	/**
	 * The "exp" (expiration time) claim identifies the expiration time on or
	 * after which the JWT must not be accepted for processing. It's important
	 * to note that in certain circumstances, a resource may reject the token
	 * before this time. For example, if a change in authentication is required
	 * or a token revocation has been detected.
	 */
	exp: number;
	home_oid?: string;
	/**
	 * The code hash is included in ID tokens only when the ID token is issued with an
	 * OAuth 2.0 authorization code. It can be used to validate the authenticity of an
	 * authorization code. To understand how to do this validation, see the OpenID
	 * Connect specification.
	 */
	c_hash: string;
	/**
	 * The access token hash is included in ID tokens only when the ID token is issued
	 * from the /authorize endpoint with an OAuth 2.0 access token. It can be used to
	 * validate the authenticity of an access token. To understand how to do this validation,
	 * see the OpenID Connect specification. This is not returned on ID tokens from the /token endpoint.
	 */
	at_hash: string;
	/**
	 * An internal claim used by Azure AD to record data for token reuse. Should be ignored.
	 */
	aio: string;
	/**
	 * The primary username that represents the user. It could be an email address, phone number,
	 * or a generic username without a specified format. Its value is mutable and might change
	 * over time. Since it is mutable, this value must not be used to make authorization decisions.
	 * It can be used for username hints, however, and in human-readable UI as a username. The profile
	 * scope is required in order to receive this claim. Present only in v2.0 tokens.
	 */
	preferred_username: string;
	/**
	 * The email claim is present by default for guest accounts that have an email address.
	 * Your app can request the email claim for managed users (those from the same tenant as the resource)
	 * using the email optional claim. On the v2.0 endpoint, your app can also request the email OpenID
	 * Connect scope - you don't need to request both the optional claim and the scope to get the claim.
	 */
	email: string;
	/**
	 * The name claim provides a human-readable value that identifies the subject of the token. The value
	 * isn't guaranteed to be unique, it can be changed, and it's designed to be used only for display purposes.
	 * The profile scope is required to receive this claim.
	 */
	name: string;
	/**
	 * The nonce matches the parameter included in the original /authorize request to the IDP. If it does not
	 * match, your application should reject the token.
	 */
	nonce: string;
	/**
	 * The immutable identifier for an object in the Microsoft identity system, in this case, a user account.
	 * This ID uniquely identifies the user across applications - two different applications signing in the
	 * same user will receive the same value in the oid claim. The Microsoft Graph will return this ID as
	 * the id property for a given user account. Because the oid allows multiple apps to correlate users,
	 * the profile scope is required to receive this claim. Note that if a single user exists in multiple
	 * tenants, the user will contain a different object ID in each tenant - they're considered different
	 * accounts, even though the user logs into each account with the same credentials. The oid claim is a
	 * GUID and cannot be reused.
	 */
	oid: string;
	/**
	 * The set of roles that were assigned to the user who is logging in.
	 */
	roles: string[];
	/**
	 * An internal claim used by Azure to revalidate tokens. Should be ignored.
	 */
	rh: string;
	/**
	 * The principal about which the token asserts information, such as the user
	 * of an app. This value is immutable and cannot be reassigned or reused.
	 * The subject is a pairwise identifier - it is unique to a particular application ID.
	 * If a single user signs into two different apps using two different client IDs,
	 * those apps will receive two different values for the subject claim.
	 * This may or may not be wanted depending on your architecture and privacy requirements.
	 */
	sub: string;
	/**
	 * Represents the tenant that the user is signing in to. For work and school accounts,
	 * the GUID is the immutable tenant ID of the organization that the user is signing in to.
	 * For sign-ins to the personal Microsoft account tenant (services like Xbox, Teams for Life, or Outlook),
	 * the value is 9188040d-6c67-4c5b-b112-36a304b66dad.
	 */
	tid: string;
	/**
	 * Only present in v1.0 tokens. Provides a human readable value that identifies the subject of the token.
	 * This value is not guaranteed to be unique within a tenant and should be used only for display purposes.
	 */
	unique_name: string;
	/**
	 * Token identifier claim, equivalent to jti in the JWT specification. Unique, per-token identifier that is case-sensitive.
	 */
	uti: string;
	/**
	 * Indicates the version of the id_token.
	 */
	ver: string;
}

export type OAuthTokenResponse = { accessToken: AccessToken, refreshToken: RefreshToken | undefined, tokenClaims: TokenClaims, expiresOn: string };

export interface TokenPostData {
	grant_type: 'refresh_token' | 'authorization_code' | 'urn:ietf:params:oauth:grant-type:device_code';
	client_id: string;
	resource: string;
}

export interface RefreshTokenPostData extends TokenPostData {
	grant_type: 'refresh_token';
	refresh_token: string;
	client_id: string;
	tenant: string
}

export interface AuthorizationCodePostData extends TokenPostData {
	grant_type: 'authorization_code';
	code: string;
	code_verifier: string;
	redirect_uri: string;
}

export interface DeviceCodeStartPostData extends Omit<TokenPostData, 'grant_type'> {

}

export interface DeviceCodeCheckPostData extends Omit<TokenPostData, 'resource'> {
	grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
	tenant: string,
	code: string
}
//#endregion
