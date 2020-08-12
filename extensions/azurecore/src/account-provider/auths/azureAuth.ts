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
	Deferred,
	Resource,
	Tenant
} from '../interfaces';
import * as url from 'url';

import { SimpleTokenCache } from '../simpleTokenCache';
import { MemoryDatabase } from '../utils/memoryDatabase';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from '../../utils/Logger';
import * as qs from 'qs';
import { AzureAuthError } from './azureAuthError';

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
		protected readonly tokenCache: SimpleTokenCache,
		protected readonly context: vscode.ExtensionContext,
		protected readonly uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
		protected readonly authType: AzureAuthType,
		public readonly userFriendlyName: string
	) {
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

		this.scopes = [...this.metadata.settings.scopes];
		this.scopesString = this.scopes.join(' ');
	}

	public async startLogin(): Promise<AzureAccount | azdata.PromptFailedResult> {
		let loginComplete: Deferred<void, Error>;
		try {
			const result = await this.login(this.commonTenant, this.metadata.settings.microsoftResource);
			loginComplete = result.authComplete;
			if (!result?.response) {
				Logger.error('Authentication failed');
				return {
					canceled: false
				};
			}
			const account = await this.hydrateAccount(result.response.accessToken, result.response.tokenClaims);
			loginComplete?.resolve();
			return account;
		} catch (ex) {
			if (ex instanceof AzureAuthError) {
				if (loginComplete) {
					loginComplete.reject(ex);
				} else {
					vscode.window.showErrorMessage(ex.getPrintableString());
				}
			}
			Logger.error(ex);
			return {
				canceled: false
			};
		} finally {
			loginComplete?.reject(new AzureAuthError(localize('azureAuth.unidentifiedError', "Unidentified error with azure authentication"), 'Unidentified error with azure auth', undefined));
		}
	}

	private getHomeTenant(account: AzureAccount): Tenant {
		// Home is defined by the API
		// Lets pick the home tenant - and fall back to commonTenant if they don't exist
		return account.properties.tenants.find(t => t.tenantCategory === 'Home') ?? account.properties.tenants[0] ?? this.commonTenant;
	}

	public async refreshAccess(account: AzureAccount): Promise<AzureAccount> {
		// Deprecated account - delete it.
		if (account.key.accountVersion !== AzureAuth.ACCOUNT_VERSION) {
			account.delete = true;
			return account;
		}
		try {
			const tenant = this.getHomeTenant(account);
			const tokenResult = await this.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.MicrosoftResourceManagement);
			if (!tokenResult) {
				account.isStale = true;
				return account;
			}

			return await this.hydrateAccount(tokenResult, this.getTokenClaims(tokenResult.token));
		} catch (ex) {
			if (ex instanceof AzureAuthError) {
				vscode.window.showErrorMessage(ex.getPrintableString());
			}
			Logger.error(ex);
			account.isStale = true;
			return account;
		}
	}

	public async hydrateAccount(token: Token | AccessToken, tokenClaims: TokenClaims): Promise<AzureAccount> {
		const tenants = await this.getTenants({ ...token });
		const account = this.createAccount(tokenClaims, token.key, tenants);
		return account;
	}

	public async getAccountSecurityToken(account: AzureAccount, tenantId: string, azureResource: azdata.AzureResource): Promise<Token | undefined> {
		if (account.isStale === true) {
			Logger.log('Account was stale. No tokens being fetched.');
			return undefined;
		}

		const resource = this.resources.find(s => s.azureResourceId === azureResource);
		if (!resource) {
			Logger.log('Invalid resource, not fetching', azureResource);

			return undefined;
		}

		const tenant = account.properties.tenants.find(t => t.id === tenantId);

		if (!tenant) {
			throw new AzureAuthError(localize('azure.tenantNotFound', "Specifed tenant with ID '{0}' not found.", tenantId), `Tenant ${tenantId} not found.`, undefined);
		}

		const cachedTokens = await this.getSavedToken(tenant, resource, account.key);

		// Let's check to see if we can just use the cached tokens to return to the user
		if (cachedTokens?.accessToken) {
			let expiry = Number(cachedTokens.expiresOn);
			if (Number.isNaN(expiry)) {
				Logger.log('Expiration time was not defined. This is expected on first launch');
				expiry = 0;
			}
			const currentTime = new Date().getTime() / 1000;

			let accessToken = cachedTokens.accessToken;
			const remainingTime = expiry - currentTime;
			const maxTolerance = 2 * 60; // two minutes

			if (remainingTime < maxTolerance) {
				const result = await this.refreshToken(tenant, resource, cachedTokens.refreshToken);
				accessToken = result.accessToken;
			}
			// Let's just return here.
			if (accessToken) {
				return {
					...accessToken,
					tokenType: 'Bearer'
				};
			}
		}

		// User didn't have any cached tokens, or the cached tokens weren't useful.
		// For most users we can use the refresh token from the general microsoft resource to an access token of basically any type of resource we want.
		const baseTokens = await this.getSavedToken(this.commonTenant, this.metadata.settings.microsoftResource, account.key);
		if (!baseTokens) {
			Logger.error('User had no base tokens for the basic resource registered. This should not happen and indicates something went wrong with the authentication cycle');
			const msg = localize('azure.noBaseToken', 'Something failed with the authentication, or your tokens have been deleted from the system. Please try adding your account to Azure Data Studio again.');
			account.isStale = true;
			throw new AzureAuthError(msg, 'No base token found', undefined);
		}
		// Let's try to convert the access token type, worst case we'll have to prompt the user to do an interactive authentication.
		const result = await this.refreshToken(tenant, resource, baseTokens.refreshToken);
		if (result.accessToken) {
			return {
				...result.accessToken,
				tokenType: 'Bearer'
			};
		}
		return undefined;
	}



	protected abstract async login(tenant: Tenant, resource: Resource): Promise<{ response: OAuthTokenResponse, authComplete: Deferred<void, Error> }>;

	/**
	 * Refreshes a token, if a refreshToken is passed in then we use that. If it is not passed in then we will prompt the user for consent.
	 * @param tenant
	 * @param resource
	 * @param refreshToken
	 */
	public async refreshToken(tenant: Tenant, resource: Resource, refreshToken: RefreshToken | undefined): Promise<OAuthTokenResponse> {
		if (refreshToken) {
			const postData: RefreshTokenPostData = {
				grant_type: 'refresh_token',
				client_id: this.clientId,
				refresh_token: refreshToken.token,
				tenant: tenant.id,
				resource: resource.endpoint
			};

			return this.getToken(tenant, resource, postData);
		}

		return this.handleInteractionRequired(tenant, resource);
	}

	public async getToken(tenant: Tenant, resource: Resource, postData: AuthorizationCodePostData | TokenPostData | RefreshTokenPostData): Promise<OAuthTokenResponse> {
		const tokenUrl = `${this.loginEndpointUrl}${tenant.id}/oauth2/token`;
		const response = await this.makePostRequest(tokenUrl, postData);

		if (response.data.error === 'interaction_required') {
			return this.handleInteractionRequired(tenant, resource);
		}

		if (response.data.error) {
			Logger.error('Response error!', response.data);
			throw new AzureAuthError(localize('azure.responseError', "Token retrival failed with an error. Open developer tools to view the error"), 'Token retrival failed', undefined);
		}

		const accessTokenString = response.data.access_token;
		const refreshTokenString = response.data.refresh_token;
		const expiresOnString = response.data.expires_on;

		return this.getTokenHelper(tenant, resource, accessTokenString, refreshTokenString, expiresOnString);
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

		await this.saveToken(tenant, resource, accountKey, result);

		return result;
	}



	//#region tenant calls
	public async getTenants(token: AccessToken): Promise<Tenant[]> {
		interface TenantResponse { // https://docs.microsoft.com/en-us/rest/api/resources/tenants/list
			id: string
			tenantId: string
			displayName?: string
			tenantCategory?: string
		}

		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2019-11-01');
		try {
			const tenantResponse = await this.makeGetRequest(tenantUri, token.token);
			Logger.pii('getTenants', tenantResponse.data);
			const tenants: Tenant[] = tenantResponse.data.value.map((tenantInfo: TenantResponse) => {
				return {
					id: tenantInfo.tenantId,
					displayName: tenantInfo.displayName ? tenantInfo.displayName : localize('azureWorkAccountDisplayName', "Work or school account"),
					userId: token.key,
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
			Logger.log(ex);
			throw new Error('Error retrieving tenant information');
		}
	}

	//#endregion

	//#region token management
	private async saveToken(tenant: Tenant, resource: Resource, accountKey: azdata.AccountKey, { accessToken, refreshToken, expiresOn }: OAuthTokenResponse) {
		const msg = localize('azure.cacheErrorAdd', "Error when adding your account to the cache.");
		if (!tenant.id || !resource.id) {
			Logger.pii('Tenant ID or resource ID was undefined', tenant, resource);
			throw new AzureAuthError(msg, 'Adding account to cache failed', undefined);
		}
		try {
			await this.tokenCache.saveCredential(`${accountKey.accountId}_access_${resource.id}_${tenant.id}`, JSON.stringify(accessToken));
			await this.tokenCache.saveCredential(`${accountKey.accountId}_refresh_${resource.id}_${tenant.id}`, JSON.stringify(refreshToken));
			this.memdb.set(`${accountKey.accountId}_${tenant.id}_${resource.id}`, expiresOn);
		} catch (ex) {
			Logger.error(ex);
			throw new AzureAuthError(msg, 'Adding account to cache failed', ex);
		}
	}

	public async getSavedToken(tenant: Tenant, resource: Resource, accountKey: azdata.AccountKey): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> {
		const getMsg = localize('azure.cacheErrorGet', "Error when getting your account from the cache");
		const parseMsg = localize('azure.cacheErrorParse', "Error when parsing your account from the cache");

		if (!tenant.id || !resource.id) {
			Logger.pii('Tenant ID or resource ID was undefined', tenant, resource);
			throw new AzureAuthError(getMsg, 'Getting account from cache failed', undefined);
		}

		let accessTokenString: string;
		let refreshTokenString: string;
		let expiresOn: string;
		try {
			accessTokenString = await this.tokenCache.getCredential(`${accountKey.accountId}_access_${resource.id}_${tenant.id}`);
			refreshTokenString = await this.tokenCache.getCredential(`${accountKey.accountId}_refresh_${resource.id}_${tenant.id}`);
			expiresOn = this.memdb.get(`${accountKey.accountId}_${tenant.id}_${resource.id}`);
		} catch (ex) {
			Logger.error(ex);
			throw new AzureAuthError(getMsg, 'Getting account from cache failed', ex);
		}

		try {
			if (!accessTokenString) {
				return undefined;
			}
			const accessToken: AccessToken = JSON.parse(accessTokenString);
			let refreshToken: RefreshToken;
			if (refreshTokenString) {
				refreshToken = JSON.parse(refreshTokenString);
			}

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

	public async handleInteractionRequired(tenant: Tenant, resource: Resource): Promise<OAuthTokenResponse | undefined> {
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
		Logger.pii(url, postData, response.data);
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
		Logger.pii(url, response.data);
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
		const results = await this.tokenCache.findCredentials('');

		for (let { account } of results) {
			await this.tokenCache.clearCredential(account);
		}
	}

	public async clearCredentials(account: azdata.AccountKey): Promise<void> {
		try {
			return this.deleteAccountCache(account);
		} catch (ex) {
			const msg = localize('azure.cacheErrrorRemove', "Error when removing your account from the cache.");
			vscode.window.showErrorMessage(msg);
			Logger.error('Error when removing tokens.', ex);
		}
	}

	public async deleteAccountCache(account: azdata.AccountKey): Promise<void> {
		const results = await this.tokenCache.findCredentials(account.accountId);

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

export interface MultiTenantTokenResponse {
	[tenantId: string]: Token
}

export interface Token extends AccountKey {
	/**
	 * Access token
	 */
	token: string;

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
