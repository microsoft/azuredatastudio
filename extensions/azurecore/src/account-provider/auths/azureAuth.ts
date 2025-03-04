/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as tunnel from "tunnel";
import * as http from "http";
import * as https from "https";

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
import { MemoryDatabase } from '../utils/memoryDatabase';
import { Logger } from '../../utils/Logger';
import { AzureAuthError } from './azureAuthError';
import { AccountInfo, AuthError, AuthenticationResult, InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-node';
import { errorToPromptFailedResult } from './networkUtils';
import { MsalCachePluginProvider } from '../utils/msalCachePlugin';
import { isErrorResponseBodyWithError } from '../../azureResource/utils';
import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { getProxyAgentOptions } from '../../proxy';
const localize = nls.loadMessageBundle();

export type GetTenantsResponseData = {
	value: TenantResponse[];
	error?: string;
}

interface ProxyAgent {
	isHttps: boolean;
	agent: http.Agent | https.Agent;
}

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
	private readonly _disposableStore: vscode.Disposable[];

	constructor(
		protected readonly metadata: AzureAccountProviderMetadata,
		protected readonly msalCacheProvider: MsalCachePluginProvider,
		protected readonly context: vscode.ExtensionContext,
		protected clientApplication: PublicClientApplication,
		protected readonly uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
		protected readonly authType: AzureAuthType,
		public readonly userFriendlyName: string
	) {
		this._disposableStore = [];
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
			this.metadata.settings.armResource
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
		if (this.metadata.settings.azureKeyVaultResource) {
			this.resources.push(this.metadata.settings.azureKeyVaultResource);
		}
		if (this.metadata.settings.azureKustoResource) {
			this.resources.push(this.metadata.settings.azureKustoResource);
		}

		if (this.metadata.settings.powerBiResource) {
			this.resources.push(this.metadata.settings.powerBiResource);
		}

		this.scopes = [...this.metadata.settings.scopes];
		this.scopesString = this.scopes.join(' ');
		this._disposableStore.push(this.uriEventEmitter);
	}

	public async startLogin(): Promise<AzureAccount | azdata.PromptFailedResult> {
		let loginComplete: Deferred<void, Error> | undefined = undefined;
		try {
			Logger.verbose('Starting login');
			if (!this.metadata.settings.microsoftResource) {
				throw new Error(localize('noMicrosoftResource', "Provider '{0}' does not have a Microsoft resource endpoint defined.", this.metadata.displayName));
			}
			const result = await this.login(this.organizationTenant, this.metadata.settings.microsoftResource);
			loginComplete = result.authComplete;
			if (!result?.response || !result.response?.account) {
				Logger.error(`Authentication failed: ${loginComplete}`);
				return {
					canceled: false
				};
			}
			// Initial login will always fetch token for ARM resource
			const token: Token = {
				key: result.response.account.homeAccountId,
				token: result.response.accessToken,
				tokenType: result.response.tokenType,
				expiresOn: result.response.expiresOn!.getTime() / 1000,
				tenantId: result.response.tenantId,
				resource: 0
			};
			const tokenClaims = <TokenClaims>result.response.idTokenClaims;
			const account = await this.hydrateAccount(token, tokenClaims);
			try {
				await this.msalCacheProvider.writeTokenToLocalCache(token);
			} catch (ex) {
				Logger.error(`Error writing token to local cache: ${ex}`);
			}
			loginComplete?.resolve();
			return account;
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

	public async hydrateAccount(token: Token | AccessToken, tokenClaims: TokenClaims): Promise<AzureAccount> {
		let account: azdata.Account;
		const tenants = await this.getTenants(token.token, tokenClaims);
		account = this.createAccount(tokenClaims, token.key, tenants);
		return account;
	}

	protected abstract login(tenant: Tenant, resource: Resource): Promise<{ response: AuthenticationResult | null, authComplete: Deferred<void, Error> }>;

	/**
	 * Gets the access token for the correct account and scope from the token cache, if the correct token doesn't exist in the token cache
	 * (i.e. expired token, wrong scope, etc.), sends a request for a new token using the refresh token
	 * @param accountId
	 * @param azureResource
	 * @returns The authentication result, including the access token.
	 * This function returns 'null' instead of 'undefined' by design as the same is returned by MSAL APIs in the flow (e.g. acquireTokenSilent).
	 */
	public async getToken(accountId: string, azureResource: azdata.AzureResource, tenantId: string): Promise<AuthenticationResult | azdata.PromptFailedResult | null> {
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
					return this.handleInteractionRequired(tenant, resource);
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

	//#region tenant calls

	public async getTenants(token: string, tokenClaims: TokenClaims): Promise<Tenant[]> {
		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2019-11-01');
		try {
			Logger.verbose(`Fetching tenants with uri: ${tenantUri}`);
			let tenantList: string[] = [];

			const tenantResponse = await this.makeGetRequest<GetTenantsResponseData>(tenantUri, token);

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

	//#endregion

	//#region interaction handling
	public async handleInteractionRequired(tenant: Tenant, resource: Resource): Promise<AuthenticationResult | null> {
		const shouldOpen = await this.askUserForInteraction(tenant, resource);
		if (shouldOpen) {
			const result = await this.login(tenant, resource);
			result?.authComplete?.resolve();
			return result?.response;
		}
		return null;
	}

	/**
	 * Determines whether the account needs to be refreshed based on received error instance
	 * and STS error codes from errorMessage.
	 * @param error AuthError instance
	 */
	private accountNeedsRefresh(error: AuthError): boolean {
		return error instanceof InteractionRequiredAuthError
			|| error.errorMessage.includes(Constants.AADSTS70043)
			|| error.errorMessage.includes(Constants.AADSTS50173)
			|| error.errorMessage.includes(Constants.AADSTS50078)
			|| error.errorMessage.includes(Constants.AADSTS50085)
			|| error.errorMessage.includes(Constants.AADSTS50089)
			|| error.errorMessage.includes(Constants.AADSTS700082)
			|| error.errorMessage.includes(Constants.AADSTS700084);
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

		const messageBody = localize('azurecore.consentDialog.body', "Your tenant {0} ({1}) requires you to re-authenticate again to access {2} resources. Press Open to start the authentication process.", tenant.displayName, tenant.id, resource.endpoint);
		const result = await vscode.window.showInformationMessage(messageBody, { modal: true }, openItem, closeItem);

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
				accountVersion: Constants.AccountVersion
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

	private async makeGetRequest<T>(requestUrl: string, token: string): Promise<AxiosResponse<T>> {
		const config: AxiosRequestConfig = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`,
			},
			validateStatus: () => true // Never throw
		};

		const httpConfig = vscode.workspace.getConfiguration("http");
		let proxy: string | undefined = httpConfig['proxy'] as string;
		if (!proxy) {
			Logger.verbose("Workspace HTTP config didn't contain a proxy endpoint. Checking environment variables.");

			proxy = this.loadEnvironmentProxyValue();
		}

		if (proxy) {
			Logger.verbose("Proxy endpoint found in environment variables or workspace configuration.");

			// Turning off automatic proxy detection to avoid issues with tunneling agent by setting proxy to false.
			// https://github.com/axios/axios/blob/bad6d8b97b52c0c15311c92dd596fc0bff122651/lib/adapters/http.js#L85
			config.proxy = false;

			const agent = this.createProxyAgent(requestUrl, proxy, httpConfig["proxyStrictSSL"]);
			if (agent.isHttps) {
				config.httpsAgent = agent.agent;
			}
			else {
				config.httpAgent = agent.agent;
			}

			const HTTPS_PORT = 443;
			const HTTP_PORT = 80;
			const parsedRequestUrl = url.parse(requestUrl);
			const port = parsedRequestUrl.protocol?.startsWith("https") ? HTTPS_PORT : HTTP_PORT;

			// Request URL will include HTTPS port 443 ('https://management.azure.com:443/tenants?api-version=2019-11-01'), so
			// that Axios doesn't try to reach this URL with HTTP port 80 on HTTP proxies, which result in an error. See https://github.com/axios/axios/issues/925
			const requestUrlWithPort = `${parsedRequestUrl.protocol}//${parsedRequestUrl.hostname}:${port}${parsedRequestUrl.path}`;
			const response: AxiosResponse = await axios.get<T>(requestUrlWithPort, config);
			Logger.piiSanitized('GET request ', [{ name: 'response', objOrArray: response.data?.value as TenantResponse[] ?? response.data as GetTenantsResponseData }], [], requestUrl,);
			return response;
		}

		Logger.verbose("No proxy endpoint was found in the HTTP_PROXY, HTTPS_PROXY environment variables or in the workspace HTTP configuration.");
		const response: AxiosResponse = await axios.get<T>(requestUrl, config);
		Logger.piiSanitized('GET request ', [{ name: 'response', objOrArray: response.data?.value as TenantResponse[] ?? response.data as GetTenantsResponseData }], [], requestUrl,);
		return response;
	}

	private loadEnvironmentProxyValue(): string | undefined {
		const HTTP_PROXY = "HTTP_PROXY";
		const HTTPS_PROXY = "HTTPS_PROXY";

		if (!process) {
			Logger.verbose("No process object found, unable to read environment variables for proxy.");
			return undefined;
		}

		if (process.env[HTTP_PROXY] || process.env[HTTP_PROXY.toLowerCase()]) {
			Logger.verbose("Loading proxy value from HTTP_PROXY environment variable.");

			return process.env[HTTP_PROXY] || process.env[HTTP_PROXY.toLowerCase()];
		}
		else if (process.env[HTTPS_PROXY] || process.env[HTTPS_PROXY.toLowerCase()]) {
			Logger.verbose("Loading proxy value from HTTPS_PROXY environment variable.");

			return process.env[HTTPS_PROXY] || process.env[HTTPS_PROXY.toLowerCase()];
		}

		Logger.verbose("No proxy value found in either HTTPS_PROXY or HTTP_PROXY environment variables.");

		return undefined;
	}

	private createProxyAgent(requestUrl: string, proxy: string, proxyStrictSSL: boolean): ProxyAgent {
		const agentOptions = getProxyAgentOptions(url.parse(requestUrl), proxy, proxyStrictSSL);
		if (!agentOptions || !agentOptions.host || !agentOptions.port) {
			Logger.verbose("Unable to read proxy agent options to create proxy agent.");
			throw new Error("Unable to read proxy agent options to create proxy agent.");
		}

		let tunnelOptions: tunnel.HttpsOverHttpsOptions = {};
		if (typeof agentOptions.auth === 'string' && agentOptions.auth) {
			tunnelOptions = {
				proxy: {
					proxyAuth: agentOptions.auth,
					host: agentOptions.host,
					port: Number(agentOptions.port),
				}
			};
		}
		else {
			tunnelOptions = {
				proxy: {
					host: agentOptions.host,
					port: Number(agentOptions.port),

				}
			};
		}

		const isHttpsRequest = requestUrl.startsWith("https");
		const isHttpsProxy = proxy.startsWith("https");
		const proxyAgent = {
			isHttps: isHttpsProxy,
			agent: this.createTunnelingAgent(isHttpsRequest, isHttpsProxy, tunnelOptions),
		} as ProxyAgent;

		return proxyAgent;
	}

	private createTunnelingAgent(isHttpsRequest: boolean, isHttpsProxy: boolean, tunnelOptions: tunnel.HttpsOverHttpsOptions): http.Agent | https.Agent {
		if (isHttpsRequest && isHttpsProxy) {
			Logger.verbose("Creating https request over https proxy tunneling agent");
			return tunnel.httpsOverHttps(tunnelOptions);
		}
		else if (isHttpsRequest && !isHttpsProxy) {
			Logger.verbose("Creating https request over http proxy tunneling agent");
			return tunnel.httpsOverHttp(tunnelOptions);
		}
		else if (!isHttpsRequest && isHttpsProxy) {
			Logger.verbose("Creating http request over https proxy tunneling agent");
			return tunnel.httpOverHttps(tunnelOptions);
		}
		else {
			Logger.verbose("Creating http request over http proxy tunneling agent");
			return tunnel.httpOverHttp(tunnelOptions);
		}
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
	public async deleteAllCache(): Promise<void> {
		this.clientApplication.clearCache();

		// unlink both cache files
		await this.msalCacheProvider.unlinkCacheFiles();

		// Delete Encryption Keys
		await this.msalCacheProvider.refreshCacheEncryptionKeys();
	}

	public async clearCredentials(account: azdata.AccountKey): Promise<void> {
		Logger.verbose("In AzureAuth: clearCredentials")
		try {
			Logger.verbose("About to delete the account cache to clear credentials");
			return await this.deleteAccountCache(account);
		} catch (ex) {
			// We need not prompt user for error if token could not be removed from cache.
			Logger.error('Error when removing token from cache: ', ex);
		}
	}

	private async deleteAccountCache(accountKey: azdata.AccountKey): Promise<void> {
		Logger.verbose("In AzureAuth: deleteAccountCache");

		const tokenCache = this.clientApplication.getTokenCache();
		try {
			let msalAccount: AccountInfo | null = await this.getAccountFromMsalCache(accountKey.accountId);
			if (!msalAccount) {
				Logger.error(`MSAL: Unable to find account ${accountKey.accountId} for removal`);
				throw Error(`Unable to find account ${accountKey.accountId}`);
			}

			Logger.verbose("Found msal account and removing it from token cache");
			await tokenCache.removeAccount(msalAccount);
		} catch (error) {
			Logger.error(`[ClientAuthError] Failed to find account: ${error}`);
		}

		Logger.verbose("Calling clearAccountFromLocalCache");
		await this.msalCacheProvider.clearAccountFromLocalCache(accountKey.accountId);
	}

	public async dispose() {
		this._disposableStore.forEach(d => d.dispose());
	}

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
	 * returns the token. It also identifies the Microsoft Entra tenant for which
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
	 * a personal account invited to a Microsoft Entra tenant), the idp claim may be
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
	 * An internal claim used by Microsoft Entra ID to record data for token reuse. Should be ignored.
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
