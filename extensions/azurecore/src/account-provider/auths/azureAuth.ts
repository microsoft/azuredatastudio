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

import { MemoryDatabase } from '../utils/memoryDatabase';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from '../../utils/Logger';
import * as qs from 'qs';
import { AzureAuthError } from './azureAuthError';
import { AuthenticationResult, AuthorizationCodeRequest, PublicClientApplication } from '@azure/msal-node';

const localize = nls.loadMessageBundle();


export abstract class AzureAuth implements vscode.Disposable {
	public static ACCOUNT_VERSION = '2.0';
	protected readonly memdb = new MemoryDatabase<string>();

	protected readonly WorkSchoolAccountType: string = 'work_school';
	protected readonly MicrosoftAccountType: string = 'microsoft';

	protected readonly loginEndpointUrl: string;
	public readonly commonTenant: Tenant;
	protected readonly redirectUri: string;
	protected readonly scopes: string[];
	protected readonly scopesString: string;
	protected readonly clientId: string;
	protected readonly resources: Resource[];


	constructor(
		protected readonly metadata: AzureAccountProviderMetadata,
		protected readonly context: vscode.ExtensionContext,
		protected clientApplication: PublicClientApplication,
		protected readonly uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
		protected readonly authType: AzureAuthType,
		public readonly userFriendlyName: string,
	) {
		this.clientApplication = clientApplication;
		this.loginEndpointUrl = this.metadata.settings.host;
		this.commonTenant = {
			id: 'common',
			displayName: 'common',
		};
		this.redirectUri = this.metadata.settings.redirectUri;
		this.clientId = this.metadata.settings.clientId;

		this.resources = [
			this.metadata.settings.armResource,
			this.metadata.settings.sqlResource,
			this.metadata.settings.graphResource,
			this.metadata.settings.ossRdbmsResource,
			this.metadata.settings.microsoftResource,
			this.metadata.settings.azureKeyVaultResource
		];

		if (this.metadata.settings.azureDevOpsResource) {
			this.resources = this.resources.concat(this.metadata.settings.azureDevOpsResource);
		}

		if (this.metadata.settings.azureLogAnalyticsResource) {
			this.resources = this.resources.concat(this.metadata.settings.azureLogAnalyticsResource);
		}

		if (this.metadata.settings.azureKustoResource) {
			this.resources = this.resources.concat(this.metadata.settings.azureKustoResource);
		}

		if (this.metadata.settings.powerBiResource) {
			this.resources = this.resources.concat(this.metadata.settings.powerBiResource);
		}

		this.scopes = [...this.metadata.settings.scopes];
		this.scopesString = this.scopes.join(' ');
	}

	public async startLogin(): Promise<AzureAccount | azdata.PromptFailedResult> {
		let loginComplete: Deferred<void, Error>;
		try {
			Logger.verbose('Starting login');
			const result = await this.login(this.commonTenant, this.metadata.settings.microsoftResource);
			loginComplete = result.authComplete;
			if (!result?.response) {
				Logger.error('Authentication failed');
				return {
					canceled: false
				};
			}
			const token: Token = {
				token: result.response.accessToken,
				key: result.response.account.homeAccountId,
				tokenType: result.response.tokenType
			};
			// build token claims object
			const tokenClaims = <TokenClaims>result.response.idTokenClaims;
			const account = await this.hydrateAccount(token, tokenClaims);
			loginComplete?.resolve();
			return account;
		} catch (ex) {
			Logger.error('Login failed');
			if (ex instanceof AzureAuthError) {
				if (loginComplete) {
					loginComplete.reject(ex);
					Logger.error(ex);
				} else {
					void vscode.window.showErrorMessage(ex.message);
					Logger.error(ex.originalMessageAndException);
				}
			} else {
				Logger.error(ex);

			}
			return {
				canceled: false
			};
		} finally {
			loginComplete?.reject(new AzureAuthError(localize('azureAuth.unidentifiedError', "Unidentified error with azure authentication"), 'Unidentified error with azure auth', undefined));
		}
	}

	public async hydrateAccount(token: Token, tokenClaims: TokenClaims): Promise<AzureAccount> {
		const tenants = await this.getTenants(token.token);
		const account = this.createAccount(tokenClaims, token.key, tenants);
		return account;
	}

	protected abstract login(tenant: Tenant, resource: Resource): Promise<{ response: AuthenticationResult, authComplete: Deferred<void, Error> }>;

	/**
	 * Refreshes a token, if a refreshToken is passed in then we use that. If it is not passed in then we will prompt the user for consent.
	 * @param tenant
	 * @param resource
	 * @param refreshToken
	 * @returns The oauth token response or undefined. Undefined is returned when the user wants to ignore a tenant or chooses not to start the
	 * re-authentication process for their tenant.
	 */


	/**
	 * Gets the access token for the correct account and scope from the token cache, if the correct token doesn't exist in the token cache
	 * (i.e. expired token, wrong scope, etc.), sends a request for a new token using the refresh token
	 * @param accountId
	 * @param azureResource
	 * @returns The authentication result, including the access token
	 */
	// TODO: Need to add resource we are getting the token for
	// Can replace most refreshToken calls with getToken, it does the same thing
	public async getToken(accountId: string, azureResource: azdata.AzureResource): Promise<AuthenticationResult> {

		const cache = this.clientApplication.getTokenCache();
		if (!cache) {
			console.log('Error: Could not fetch token cache.');
		}
		const resource = this.resources.find(s => s.azureResourceId === azureResource);
		if (!resource) {
			console.log('Error: Could not fetch the azure resource.');
		}
		const accounts = await cache.getAllAccounts();
		const account = await cache.getAccountByHomeId(accountId);
		if (!account) {
			console.log('Error: Could not fetch account when acquiring token');
		}
		let newScope = [`${resource.endpoint}/User.Read`];
		// construct request
		const tokenRequest = {
			account: account,
			scopes: newScope
		};

		try {
			return await this.clientApplication.acquireTokenSilent(tokenRequest);
		} catch (e) {
			console.log('Failed to acquireTokenSilent');
			console.log(e);
			// need to create an auth url request
			const tenant: Tenant = {
				id: account.tenantId,
				displayName: ''
			};
			const authResult = await this.login(tenant, resource);
			return authResult.response;
		}
		// Need: Account info
		// Need: Scope
		// Use account info to find correct account from cache
		// Call clientApplication.getTokenSilent() in a try/catch
		// In the catch if that fails, call clientApplication.getTokenInteractive
		// return authResponse.accessToken
	}

	public async getTokenInteractive(authCodeRequest: AuthorizationCodeRequest): AuthenticationResult {

	}

	public async getTokenHelper(tenant: Tenant, resource: Resource, accessTokenString: string, refreshTokenString: string, expiresOnString: string): Promise<OAuthTokenResponse> {
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
		let refreshToken: RefreshToken;

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
			accountId: userKey
		};

		return result;
	}



	//#region tenant calls
	public async getTenants(token: string): Promise<Tenant[]> {
		interface TenantResponse { // https://docs.microsoft.com/en-us/rest/api/resources/tenants/list
			id: string
			tenantId: string
			displayName?: string
			tenantCategory?: string
		}

		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2019-11-01');
		try {
			Logger.verbose('Fetching tenants', tenantUri);
			const tenantResponse = await this.makeGetRequest(tenantUri, token);
			const tenants: Tenant[] = tenantResponse.data.value.map((tenantInfo: TenantResponse) => {
				Logger.verbose(`Tenant: ${tenantInfo.displayName}`);
				return {
					id: tenantInfo.tenantId,
					displayName: tenantInfo.displayName ? tenantInfo.displayName : localize('azureWorkAccountDisplayName', "Work or school account"),
					userId: token,
					tenantCategory: tenantInfo.tenantCategory
				} as Tenant;
			});

			const homeTenantIndex = tenants.findIndex(tenant => tenant.tenantCategory === 'Home');
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

	//#region interaction handling

	public async handleInteractionRequired(tenant: Tenant, resource: Resource): Promise<AuthenticationResult | undefined> {
		const shouldOpen = await this.askUserForInteraction(tenant, resource);
		if (shouldOpen) {
			const result = await this.login(tenant, resource);
			result?.authComplete?.resolve();
			return result?.response;
		}
		return undefined;
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

		const getTenantConfigurationSet = (): Set<string> => {
			const configuration = vscode.workspace.getConfiguration('azure.tenant.config');
			let values: string[] = configuration.get('filter') ?? [];
			return new Set<string>(values);
		};

		// The user wants to ignore this tenant.
		if (getTenantConfigurationSet().has(tenant.id)) {
			return false;
		}

		const updateTenantConfigurationSet = async (set: Set<string>): Promise<void> => {
			const configuration = vscode.workspace.getConfiguration('azure.tenant.config');
			await configuration.update('filter', Array.from(set), vscode.ConfigurationTarget.Global);
		};

		interface ConsentMessageItem extends vscode.MessageItem {
			booleanResult: boolean;
			action?: (tenantId: string) => Promise<void>;
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

		const dontAskAgainItem: ConsentMessageItem = {
			title: localize('azurecore.consentDialog.ignore', "Ignore Tenant"),
			booleanResult: false,
			action: async (tenantId: string) => {
				let set = getTenantConfigurationSet();
				set.add(tenantId);
				await updateTenantConfigurationSet(set);
			}

		};
		const messageBody = localize('azurecore.consentDialog.body', "Your tenant '{0} ({1})' requires you to re-authenticate again to access {2} resources. Press Open to start the authentication process.", tenant.displayName, tenant.id, resource.id);
		const result = await vscode.window.showInformationMessage(messageBody, { modal: true }, openItem, closeItem, dontAskAgainItem);

		if (result.action) {
			await result.action(tenant.id);
		}

		return result.booleanResult;
	}
	//#endregion

	//#region data modeling

	public createAccount(tokenClaims: TokenClaims, key: string, tenants: Tenant[]): AzureAccount {
		Logger.verbose(`Token Claims: ${tokenClaims.name}`);
		tenants.forEach((tenant) => {
			Logger.verbose(
				`Tenant ID: ${tenant.id}
				Tenant Name: ${tenant.displayName}`);
		});
		// Determine if this is a microsoft account
		let accountIssuer = 'unknown';

		if (tokenClaims.iss === 'https://sts.windows.net/72f988bf-86f1-41af-91ab-2d7cd011db47/') {
			accountIssuer = 'corp';
		}
		if (tokenClaims?.idp === 'live.com') {
			accountIssuer = 'msft';
		}

		const name = tokenClaims.name ?? tokenClaims.email ?? tokenClaims.unique_name;
		const email = tokenClaims.email ?? tokenClaims.unique_name;

		let displayName = name;
		if (email) {
			displayName = `${displayName} - ${email}`;
		}

		let contextualDisplayName: string;
		switch (accountIssuer) {
			case 'corp':
				contextualDisplayName = localize('azure.microsoftCorpAccount', "Microsoft Corp");
				break;
			case 'msft':
				contextualDisplayName = localize('azure.microsoftAccountDisplayName', 'Microsoft Account');
				break;
			default:
				contextualDisplayName = displayName;
		}

		let accountType = accountIssuer === 'msft'
			? this.MicrosoftAccountType
			: this.WorkSchoolAccountType;

		const account = {
			key: {
				providerId: this.metadata.id,
				accountId: key,
				accountVersion: AzureAuth.ACCOUNT_VERSION,
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
				isMsAccount: accountIssuer === 'msft',
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
		Logger.pii('POST request ', [{ name: 'data', objOrArray: postData }, { name: 'response', objOrArray: response.data }], [], url);
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
		Logger.pii('GET request ', [{ name: 'response', objOrArray: response.data.value ?? response.data }], [], url,);
		return response;
	}

	//#endregion

	//#region inconsequential
	protected getTokenClaims(accessToken: string): TokenClaims | undefined {
		try {
			const split = accessToken.split('.');
			return JSON.parse(Buffer.from(split[1], 'base64').toString('binary'));
		} catch (ex) {
			throw new Error('Unable to read token claims: ' + JSON.stringify(ex));
		}
	}

	protected toBase64UrlEncoding(base64string: string): string {
		return base64string.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); // Need to use base64url encoding
	}

	public async deleteAllCache(): Promise<void> {
		this.clientApplication.clearCache();
	}

	public async clearCredentials(account: azdata.AccountKey): Promise<void> {
		try {
			return this.deleteAccountCache(account);
		} catch (ex) {
			const msg = localize('azure.cacheErrrorRemove', "Error when removing your account from the cache.");
			void vscode.window.showErrorMessage(msg);
			Logger.error('Error when removing tokens.', ex);
		}
	}

	public async deleteAccountCache(account: azdata.AccountKey): Promise<void> {
		const tokenCache = this.clientApplication.getTokenCache();
		let msalAccount = await tokenCache.getAccountByHomeId(account.accountId);
		await tokenCache.removeAccount(msalAccount);
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
	expiresOn?: number;

	/**
	 * TokenType
	 */
	tokenType: string;
}

export interface TokenClaims { // https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens
	aud: string;
	iss: string;
	iat: number;
	idp: string,
	nbf: number;
	exp: number;
	home_oid?: string;
	c_hash: string;
	at_hash: string;
	aio: string;
	preferred_username: string;
	email: string;
	name: string;
	nonce: string;
	oid: string;
	roles: string[];
	rh: string;
	sub: string;
	tid: string;
	unique_name: string;
	uti: string;
	ver: string;
}

export type OAuthTokenResponse = { accessToken: AccessToken, refreshToken: RefreshToken, tokenClaims: TokenClaims, expiresOn: string };

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
