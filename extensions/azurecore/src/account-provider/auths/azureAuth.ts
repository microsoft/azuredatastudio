/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import axios, { AxiosResponse } from 'axios';
import * as qs from 'qs';
const atob = require('atob');
import * as url from 'url';

import {
	AzureAccountProviderMetadata,
	Tenant,
	AzureAccount,
	Resource,
	AzureAuthType
} from '../interfaces';

import { SimpleTokenCache } from '../simpleTokenCache';
const localize = nls.loadMessageBundle();

export interface AccountKey {
	/**
	 * Account Key
	 */
	key: string

	/**
	 * Resource ID
	 */
	resource: string
}

export interface AccessToken extends AccountKey {
	/**
	 * Access Token
	 */
	at: string;

}

export interface RefreshToken extends AccountKey {
	/**
	 * Refresh Token
	 */
	rt: string;
}

export interface Token extends AccessToken, RefreshToken {

}

export interface TokenClaims { // https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens
	aud: string;
	iss: string;
	iat: number;
	idp: string,
	nbf: number;
	exp: number;
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

export type TokenRefreshResponse = { accessToken: AccessToken, refreshToken: RefreshToken, tokenClaims: TokenClaims };

export abstract class AzureAuth {

	protected readonly WorkSchoolAccountType: string = 'work_school';
	protected readonly MicrosoftAccountType: string = 'microsoft';

	protected readonly loginEndpointUrl: string;
	protected readonly commonTenant: string;
	protected readonly redirectUri: string;
	protected readonly scopes: string[];
	protected readonly clientId: string;
	protected readonly resources: Resource[];


	constructor(
		protected readonly metadata: AzureAccountProviderMetadata,
		protected readonly _tokenCache: SimpleTokenCache,
		protected readonly _context: vscode.ExtensionContext,
		protected readonly authType: AzureAuthType,
		public readonly userFriendlyName: string
	) {
		this.loginEndpointUrl = this.metadata.settings.host;
		this.commonTenant = 'common';
		this.redirectUri = this.metadata.settings.redirectUri;
		this.clientId = this.metadata.settings.clientId;
		this.scopes = this.metadata.settings.scopes;

		this.resources = [this.metadata.settings.armResource];
	}

	public abstract async login(): Promise<AzureAccount | azdata.PromptFailedResult>;

	public abstract async autoOAuthCancelled(): Promise<void>;


	public async refreshAccess(account: azdata.Account): Promise<azdata.Account> {
		const refreshTokens: RefreshToken[] = [];
		for (const resource of this.resources) {
			const token = await this.getCachedToken(account.key, resource);
			if (!token) {
				account.isStale = true;
				return account;
			}
			refreshTokens.push({ rt: token.rt, key: token.key, resource: token.resource });
		}

		try {
			this.refreshAccessTokens(account, refreshTokens);
		} catch (ex) {
			if (ex.message) {
				vscode.window.showErrorMessage(ex.message);
			}
			console.log(ex);
		}
		return account;
	}


	public async getSecurityToken(account: azdata.AccountKey, azureResource: azdata.AzureResource): Promise<Token> {
		const resource = this.resources.find(s => s.azureResourceId === azureResource);
		if (!resource) {
			return undefined;
		}

		return this.getCachedToken(account, resource);
	}

	public async clearCredentials(account: azdata.AccountKey): Promise<void> {
		for (const resource of this.resources) {
			this.deleteCachedToken(account, resource);
		}
	}

	protected toBase64UrlEncoding(base64string: string) {
		return base64string.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); // Need to use base64url encoding
	}

	protected async makePostRequest(uri: string, postData: { [key: string]: string }) {
		const config = {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		};

		return axios.post(uri, qs.stringify(postData), config);
	}

	protected async makeGetRequest(token: AccessToken, uri: string): Promise<AxiosResponse<any>> {
		const config = {
			headers: {
				Authorization: `Bearer ${token.at}`,
				'Content-Type': 'application/json',
			},
		};

		return axios.get(uri, config);
	}

	protected async getTenants(token: AccessToken): Promise<Tenant[]> {
		interface TenantResponse { // https://docs.microsoft.com/en-us/rest/api/resources/tenants/list
			id: string
			tenantId: string
			displayName?: string
			tenantCategory?: string
		}

		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2019-11-01');
		try {
			const tenantResponse = await this.makeGetRequest(token, tenantUri);
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
			console.log(ex);
			throw new Error('Error retreiving tenant information');
		}
	}

	protected async getToken(postData: { [key: string]: string }, scope: string, resource: Resource): Promise<TokenRefreshResponse | undefined> {
		try {
			const tokenUrl = `${this.loginEndpointUrl}${this.commonTenant}/oauth2/v2.0/token`;

			const tokenResponse = await this.makePostRequest(tokenUrl, postData);
			const tokenClaims = this.getTokenClaims(tokenResponse.data.access_token);

			const accessToken: AccessToken = {
				at: tokenResponse.data.access_token,
				key: tokenClaims.email || tokenClaims.unique_name || tokenClaims.name,
				resource: resource.id,
			};

			const refreshToken: RefreshToken = {
				rt: tokenResponse.data.refresh_token,
				key: accessToken.key,
				resource: resource.id
			};

			return { accessToken, refreshToken, tokenClaims };

		} catch (err) {
			console.dir(err);
			const msg = localize('azure.noToken', "Retrieving the token failed.");
			throw new Error(msg);
		}
	}

	protected getTokenClaims(accessToken: string): TokenClaims | undefined {
		try {
			const split = accessToken.split('.');
			return JSON.parse(atob(split[1]));
		} catch (ex) {
			throw new Error('Unable to read token claims');
		}
	}

	protected async refreshAccessTokens(account: azdata.Account, tokens: RefreshToken[]): Promise<void> {
		for (let resource of this.resources) {
			const properToken = tokens.find(t => t.resource === resource.id);
			if (!properToken) {
				account.isStale = true;
				return;
			}

			this.refreshAccessToken(account.key, properToken, resource);
		}
	}

	private async refreshAccessToken(account: azdata.AccountKey, token: RefreshToken, resource: Resource): Promise<void> {
		const scopes = [...this.metadata.settings.scopes, resource.scopes];
		const postData = {
			grant_type: 'refresh_token',
			refresh_token: token.rt,
			client_id: this.clientId,
			tenant: this.commonTenant,
			scope: scopes.join(' ')
		};

		const { accessToken, refreshToken } = await this.getToken(postData, postData.scope, resource);

		if (!accessToken || !refreshToken) {
			console.log('Access or refresh token were undefined');
			const msg = localize('azure.refreshTokenError', "Error when refreshing your account.");
			throw new Error(msg);
		}

		return this.setCachedToken(account, resource, { at: accessToken.at, rt: refreshToken.rt, resource: accessToken.resource, key: accessToken.key });
	}


	protected async setCachedToken(account: azdata.AccountKey, resource: Resource, token: Token): Promise<void> {
		const msg = localize('azure.cacheErrorAdd', "Error when adding your account to the cache.");

		if (!token || !token.at || !token.rt || !token.resource || !token.key) {
			throw new Error(msg);
		}

		const accessToken: AccessToken = {
			key: token.key,
			at: token.at,
			resource: token.resource
		};

		const refreshToken: RefreshToken = {
			key: token.key,
			rt: token.rt,
			resource: token.resource
		};

		try {
			await this._tokenCache.addAccount(`${account.accountId}_${resource.id}_access`, JSON.stringify(accessToken));
			await this._tokenCache.addAccount(`${account.accountId}_${resource.id}_refresh`, JSON.stringify(refreshToken));
		} catch (ex) {
			console.error('Error when storing tokens.', ex);
			throw new Error(msg);
		}
	}

	protected async getCachedToken(account: azdata.AccountKey, resource: Resource): Promise<Token> {
		const accessToken: AccessToken = JSON.parse(await this._tokenCache.getCredential(`${account.accountId}_${resource.id}_access`));
		const refreshToken: RefreshToken = JSON.parse(await this._tokenCache.getCredential(`${account.accountId}_${resource.id}_refresh`));
		if (!accessToken || !refreshToken) {
			return undefined;
		}

		if (!refreshToken.rt) {
			return undefined;
		}

		if (!accessToken.at || !accessToken.key || !accessToken.resource) {
			return undefined;
		}

		return { key: accessToken.key, resource: accessToken.resource, at: accessToken.at, rt: refreshToken.rt } as Token;
	}

	protected async deleteCachedToken(account: azdata.AccountKey, resource: Resource): Promise<void> {
		try {
			await this._tokenCache.clearCredential(`${account.accountId}_${resource.id}_access`);
			await this._tokenCache.clearCredential(`${account.accountId}_${resource.id}_refresh`);
		} catch (ex) {
			const msg = localize('azure.cacheErrrorRemove', "Error when removing your account from the cache.");
			console.error('Error when removing tokens.', ex);
			throw new Error(msg);
		}
	}

	protected createAccount(tokenClaims: TokenClaims, key: string, tenants: Tenant[]): AzureAccount {
		// Determine if this is a microsoft account
		let msa = tokenClaims.iss === 'https://sts.windows.net/72f988bf-86f1-41af-91ab-2d7cd011db47/';

		let contextualDisplayName = msa
			? localize('microsoftAccountDisplayName', "Microsoft Account")
			: tokenClaims.name;

		let accountType = msa
			? this.MicrosoftAccountType
			: this.WorkSchoolAccountType;

		const account = {
			key: {
				providerId: this.metadata.id,
				accountId: key
			},
			name: key,
			displayInfo: {
				accountType: accountType,
				userId: key,
				contextualDisplayName: contextualDisplayName,
				displayName: tokenClaims.name
			},
			properties: {
				providerSettings: this.metadata,
				isMsAccount: msa,
				tenants,
				azureAuthType: this.authType
			},
			isStale: false
		} as AzureAccount;

		return account;
	}
}
