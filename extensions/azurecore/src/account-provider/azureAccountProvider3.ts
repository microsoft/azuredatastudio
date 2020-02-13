/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as nls from 'vscode-nls';
import axios from 'axios';
import * as qs from 'qs';
const atob = require('atob');
import * as url from 'url';

import {
	AzureAccountProviderMetadata,
	Tenant,
	AzureAccount
} from './interfaces';

import { SimpleWebServer } from './simpleWebServer';
import { SimpleTokenCache } from './simpleTokenCache';

const localize = nls.loadMessageBundle();
// const notInitalizedMessage = localize('accountProviderNotInitialized', "Account provider not initialized, cannot perform action");

interface Token {
	accessToken: string; // When unable to refresh due to network problems, the access token becomes undefined

	expiresIn: string; // How long access token is valid, in seconds
	refreshToken: string;

	accountName: string;
	scope: string;
	sessionId: string; // The account id + the scope

	displayName: string
	iss: string
}

export class AzureAccountProvider implements azdata.AccountProvider {
	private static WorkSchoolAccountType: string = 'work_school';
	private static MicrosoftAccountType: string = 'microsoft';

	private readonly loginEndpointUrl: string;
	private readonly commonTenant: string;
	private readonly redirectUri: string;
	private readonly scopes: string[];
	private readonly clientId: string;

	constructor(private readonly metadata: AzureAccountProviderMetadata,
		private readonly _tokenCache: SimpleTokenCache,
		_context: vscode.ExtensionContext) {
		this.loginEndpointUrl = this.metadata.settings.host;
		this.commonTenant = 'common';
		this.redirectUri = this.metadata.settings.redirectUri;
		this.scopes = ['openid', 'email', 'profile', 'offline_access', 'https://management.azure.com/user_impersonation'];
		this.clientId = this.metadata.settings.clientId;
	}


	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._initialize(storedAccounts);
	}

	private async _initialize(storedAccounts: azdata.Account[]): Promise<azdata.Account[]> {

		for (let account of storedAccounts) {
			await this.refresh(account);
		}

		return storedAccounts;
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return this._tokenCache.getCredential(account.key.accountId);
	}

	prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._prompt();
	}

	private async _prompt(): Promise<azdata.Account | azdata.PromptFailedResult> {
		const server = new SimpleWebServer();
		const nonce = crypto.randomBytes(16).toString('base64');
		let serverPort: string;

		try {
			serverPort = await server.startup();
		} catch (err) {
			//TODO: formatted errors;
			console.log(err);
		}
		vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${serverPort}/signin?nonce=${encodeURIComponent(nonce)}`));

		// The login code to use
		let loginUrl: string;
		let codeVerifier: string;
		let scopes: string;
		{
			scopes = this.scopes.join(' ');
			codeVerifier = this.toBase64UrlEncoding(crypto.randomBytes(32).toString('base64'));
			const state = `${serverPort},${encodeURIComponent(nonce)}`;
			const codeChallenge = this.toBase64UrlEncoding(crypto.createHash('sha256').update(codeVerifier).digest('base64'));
			loginUrl = `${this.loginEndpointUrl}${this.commonTenant}/oauth2/v2.0/authorize?response_type=code&response_mode=query&client_id=${encodeURIComponent(this.clientId)}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes)}&prompt=select_account&code_challenge_method=S256&code_challenge=${codeChallenge}`;
		}

		console.log(loginUrl);
		const authenticatedCode = await this.addServerListeners(server, nonce, loginUrl);
		console.log(authenticatedCode);

		const token = await this.getTokenWithAuthCode(authenticatedCode, codeVerifier, scopes, this.redirectUri);
		if (!token) {
			//TODO errors
			throw Error('something');
		}

		const tenants = await this.getTenants(token);

		// Determine if this is a microsoft account
		let msa = token.iss === 'https://sts.windows.net/72f988bf-86f1-41af-91ab-2d7cd011db47/';

		let contextualDisplayName = msa
			? localize('microsoftAccountDisplayName', "Microsoft Account")
			: token.displayName;

		let accountType = msa
			? AzureAccountProvider.MicrosoftAccountType
			: AzureAccountProvider.WorkSchoolAccountType;

		const account = {
			key: {
				providerId: this.metadata.id,
				accountId: token.accountName
			},
			name: token.accountName,
			displayInfo: {
				accountType: accountType,
				userId: token.accountName,
				contextualDisplayName: contextualDisplayName,
				displayName: token.displayName
			},
			properties: {
				providerSettings: this.metadata,
				isMsAccount: msa,
				tenants,
			},
			isStale: false
		} as AzureAccount;

		this._tokenCache.addAccount(account.key.accountId, JSON.stringify(token));
		return account;
	}

	private async makeWebRequest(token: Token, uri: string): Promise<any> {
		const config = {
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				'Content-Type': 'application/json',
			},
		};

		const x = axios.get(uri, config);
		return x;
	}

	private async getTenants(token: Token): Promise<Tenant[]> {
		interface TenantResponse { // https://docs.microsoft.com/en-us/rest/api/resources/tenants/list
			id: string
			tenantId: string
			displayName?: string
			tenantCategory?: string
		}

		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2019-11-01');
		try {
			const tenantResponse = await this.makeWebRequest(token, tenantUri);
			const tenants: Tenant[] = tenantResponse.data.value.map((tenantInfo: TenantResponse) => {
				return {
					id: tenantInfo.tenantId,
					displayName: tenantInfo.displayName ? tenantInfo.displayName : localize('azureWorkAccountDisplayName', "Work or school account"),
					userId: token.accountName,
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
			//TODO cleaner errors
			console.log(ex);
			throw new Error('Error retreiving tenant information');
		}
	}

	private async getToken(postData: { [key: string]: string }, scope: string): Promise<Token | undefined> {
		const tokenUrl = `${this.loginEndpointUrl}${this.commonTenant}/oauth2/v2.0/token`;
		try {
			const config = {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			};

			const tokenResponse = await axios.post(tokenUrl, qs.stringify(postData), config);
			const tokenClaims = this.getTokenClaims(tokenResponse.data.access_token);

			console.log(tokenResponse);
			console.log(tokenClaims);
			const tokenResult: Token = {
				accessToken: tokenResponse.data.access_token,
				expiresIn: tokenResponse.data.expires_in,
				refreshToken: tokenResponse.data.refresh_token,
				scope: tokenResponse.data.scope,
				sessionId: `${tokenClaims.tid}/${(tokenClaims.oid || (tokenClaims.altsecid || '' + tokenClaims.ipd || ''))}/${scope}`,
				accountName: tokenClaims.email || tokenClaims.unique_name || tokenClaims.name,
				displayName: tokenClaims.name,
				iss: tokenClaims.iss
			};

			return tokenResult;

		} catch (err) {
			//TODO handle errors
			console.log(err);
		}

		return undefined;
	}

	private async refreshAccessToken(account: azdata.Account, token: Token): Promise<Token | undefined> {
		const postData = {
			grant_type: 'refresh_token',
			refresh_token: token.refreshToken,
			client_id: this.clientId,
			tenant: this.commonTenant,
			scope: this.scopes.join(' ')
		};

		return this.getToken(postData, postData.scope);
	}

	private async getTokenWithAuthCode(authCode: string, codeVerifier: string, scope: string, redirectUri: string): Promise<Token | undefined> {
		const postData = {
			grant_type: 'authorization_code',
			code: authCode,
			client_id: this.clientId,
			scope,
			code_verifier: codeVerifier,
			redirect_uri: redirectUri
		};

		return this.getToken(postData, postData.scope);
	}

	private getTokenClaims(accessToken: string) {
		try {
			const split = accessToken.split('.');
			return JSON.parse(atob(split[1]));
		} catch (ex) {
			throw new Error('Unable to read token claims');
		}
	}

	private toBase64UrlEncoding(base64string: string) {
		return base64string.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); // Need to use base64url encoding
	}

	private async addServerListeners(server: SimpleWebServer, nonce: string, loginUrl: string): Promise<string> {

		server.on('/signin', (req, reqUrl, res) => {
			let receivedNonce: string = reqUrl.query.nonce as string;
			receivedNonce = receivedNonce.replace(/ /g, '+');

			if (receivedNonce !== nonce) {
				//TODO: Formatted errors;
				console.log('nonce no match');
				return;
			}
			res.writeHead(302, { Location: loginUrl });
			res.end();
		});

		return new Promise<string>((resolve, reject) => {
			server.on('/callback', (req, reqUrl, res) => {
				//TODO handle rejects
				const state = reqUrl.query.state as string ?? '';
				const code = reqUrl.query.code as string ?? '';

				const stateSplit = state.split(',');
				if (stateSplit.length !== 2) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.stateError', "Authentication failed due to a state mismatch, please close ADS and try again."));
					res.end();
					return;
				}

				if (stateSplit[1] !== nonce) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close ADS and try again."));
					res.end();
					return;
				}

				resolve(code);
			});
		});
	}

	refresh(account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._refresh(account);
	}

	private async _refresh(account: azdata.Account): Promise<azdata.Account | azdata.PromptFailedResult> {
		const token = JSON.parse(await this.getSecurityToken(account, undefined) as string) as Token;

		const result = await this.refreshAccessToken(account, token);

		if (result) {
			this._tokenCache.addAccount(account.key.accountId, JSON.stringify(result));
		} else {
			account.isStale = true;
		}

		return account;
	}

	clear(accountKey: azdata.AccountKey): Thenable<void> {
		return this._clear(accountKey);
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		await this._tokenCache.clearCredential(accountKey.accountId);
	}

	autoOAuthCancelled(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}
