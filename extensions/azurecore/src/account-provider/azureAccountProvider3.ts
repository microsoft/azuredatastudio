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
import { promises as fs } from 'fs';
import * as path from 'path';
import * as http from 'http';

import {
	AzureAccountProviderMetadata,
	Tenant,
	AzureAccount
} from './interfaces';

import { SimpleWebServer } from './simpleWebServer';
import { SimpleTokenCache } from './simpleTokenCache';

const localize = nls.loadMessageBundle();
// const notInitalizedMessage = localize('accountProviderNotInitialized', "Account provider not initialized, cannot perform action");

interface AccountKey {
	/**
	 * Account Key
	 */
	key: string
}
interface AccessToken extends AccountKey {
	/**
	 * Access Token
	 */
	at: string;

}

interface RefreshToken extends AccountKey {
	/**
	 * Refresh Token
	 */
	rt: string;
}

interface Token extends AccessToken, RefreshToken {

}

interface TokenClaims { // https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens
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

type TokenRefreshResponse = { accessToken: AccessToken, refreshToken: RefreshToken, tokenClaims: TokenClaims };

export class AzureAccountProvider implements azdata.AccountProvider {
	private static WorkSchoolAccountType: string = 'work_school';
	private static MicrosoftAccountType: string = 'microsoft';

	private readonly loginEndpointUrl: string;
	private readonly commonTenant: string;
	private readonly redirectUri: string;
	private readonly scopes: string[];
	private readonly clientId: string;

	private server: SimpleWebServer;

	constructor(private readonly metadata: AzureAccountProviderMetadata,
		private readonly _tokenCache: SimpleTokenCache,
		private readonly _context: vscode.ExtensionContext) {
		this.loginEndpointUrl = this.metadata.settings.host;
		this.commonTenant = 'common';
		this.redirectUri = this.metadata.settings.redirectUri;
		this.clientId = this.metadata.settings.clientId;
		this.scopes = this.metadata.settings.scopes;
	}


	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._initialize(storedAccounts);
	}

	private async _initialize(storedAccounts: azdata.Account[]): Promise<azdata.Account[]> {

		for (let account of storedAccounts) {
			await this._refreshToken(account);
		}

		return storedAccounts;
	}

	private async _refreshToken(account: azdata.Account): Promise<azdata.Account | azdata.PromptFailedResult> {
		const token = await this.getSecurityToken(account, undefined) as Token;
		if (!token || !token.at || !token.rt) {
			account.isStale = true;
			return account;
		}

		const result = await this.refreshAccessToken(account, token);

		if (result && result.accessToken && result.refreshToken) {
			await this._tokenCache.addAccount(`${account.key.accountId}_access`, JSON.stringify(result.accessToken));
			await this._tokenCache.addAccount(`${account.key.accountId}_refresh`, JSON.stringify(result.refreshToken));
		} else {
			account.isStale = true;
		}

		return account;
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return this._getSecurityToken(account, resource);
	}

	private async _getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<Token> {
		const accessToken: AccessToken = JSON.parse(await this._tokenCache.getCredential(`${account.key.accountId}_access`));
		const refreshToken: RefreshToken = JSON.parse(await this._tokenCache.getCredential(`${account.key.accountId}_refresh`));

		return {
			at: accessToken.at,
			rt: refreshToken.rt,
			key: accessToken.key
		};
	}

	prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._prompt();
	}

	private async _prompt(): Promise<azdata.Account | azdata.PromptFailedResult> {
		this.server = new SimpleWebServer();
		const nonce = crypto.randomBytes(16).toString('base64');
		let serverPort: string;

		try {
			serverPort = await this.server.startup();
		} catch (err) {
			const msg = localize('azure.serverCouldNotStart', 'Server could not start. This could be a permissions error or an incompatibility on your system.');
			vscode.window.showErrorMessage(msg);
			console.dir(err);
			return { canceled: false } as azdata.PromptFailedResult;
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
		const authenticatedCode = await this.addServerListeners(this.server, nonce, loginUrl);
		console.log(authenticatedCode);

		const { accessToken, refreshToken, tokenClaims } = await this.getTokenWithAuthCode(authenticatedCode, codeVerifier, scopes, this.redirectUri);
		if (!accessToken) {
			throw Error('Failure when retreiving tokens');
		}

		const tenants = await this.getTenants(accessToken);

		// Determine if this is a microsoft account
		let msa = tokenClaims.iss === 'https://sts.windows.net/72f988bf-86f1-41af-91ab-2d7cd011db47/';

		let contextualDisplayName = msa
			? localize('microsoftAccountDisplayName', "Microsoft Account")
			: tokenClaims.name;

		let accountType = msa
			? AzureAccountProvider.MicrosoftAccountType
			: AzureAccountProvider.WorkSchoolAccountType;

		const account = {
			key: {
				providerId: this.metadata.id,
				accountId: accessToken.key
			},
			name: accessToken.key,
			displayInfo: {
				accountType: accountType,
				userId: accessToken.key,
				contextualDisplayName: contextualDisplayName,
				displayName: tokenClaims.name
			},
			properties: {
				providerSettings: this.metadata,
				isMsAccount: msa,
				tenants,
			},
			isStale: false
		} as AzureAccount;
		try {
			await this._tokenCache.addAccount(`${account.key.accountId}_access`, JSON.stringify(accessToken));
			await this._tokenCache.addAccount(`${account.key.accountId}_refresh`, JSON.stringify(refreshToken));
		} catch (ex) {
			console.dir(ex);
			vscode.window.showErrorMessage(localize('azure.keytarIssue', "There was an issue with your local security module. If you're using Linux, you may need libsecret for this to work."));
			return { canceled: false } as azdata.PromptFailedResult;
		}

		await this.server.shutdown();
		return account;
	}

	private async makeWebRequest(token: AccessToken, uri: string): Promise<any> {
		const config = {
			headers: {
				Authorization: `Bearer ${token.at}`,
				'Content-Type': 'application/json',
			},
		};

		const x = axios.get(uri, config);
		return x;
	}

	private async getTenants(token: AccessToken): Promise<Tenant[]> {
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

	private async getToken(postData: { [key: string]: string }, scope: string): Promise<TokenRefreshResponse | undefined> {
		const tokenUrl = `${this.loginEndpointUrl}${this.commonTenant}/oauth2/v2.0/token`;
		try {
			const config = {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			};

			const tokenResponse = await axios.post(tokenUrl, qs.stringify(postData), config);
			const tokenClaims = this.getTokenClaims(tokenResponse.data.access_token);

			const accessToken: AccessToken = {
				at: tokenResponse.data.access_token,
				key: tokenClaims.email || tokenClaims.unique_name || tokenClaims.name,
			};

			const refreshToken: RefreshToken = {
				rt: tokenResponse.data.refresh_token,
				key: accessToken.key,
			};

			return { accessToken, refreshToken, tokenClaims };

		} catch (err) {
			const msg = localize('azure.noToken', "Retrieving the token failed.");
			vscode.window.showErrorMessage(msg);
			console.dir(err);
			throw err;
		}

		return undefined;
	}

	private async refreshAccessToken(account: azdata.Account, token: RefreshToken): Promise<TokenRefreshResponse | undefined> {
		const postData = {
			grant_type: 'refresh_token',
			refresh_token: token.rt,
			client_id: this.clientId,
			tenant: this.commonTenant,
			scope: this.scopes.join(' ')
		};

		return this.getToken(postData, postData.scope);
	}

	private async getTokenWithAuthCode(authCode: string, codeVerifier: string, scope: string, redirectUri: string): Promise<TokenRefreshResponse | undefined> {
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

	private getTokenClaims(accessToken: string): TokenClaims | undefined {
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
		const mediaPath = path.join(this._context.extensionPath, 'media');

		// Utility function
		const sendFile = async (res: http.ServerResponse, filePath: string, contentType: string): Promise<void> => {
			let fileContents;
			try {
				fileContents = await fs.readFile(filePath);
			} catch (ex) {
				console.error(ex);
				res.writeHead(200);
				res.end();
				return;
			}

			res.writeHead(200, {
				'Content-Length': fileContents.length,
				'Content-Type': contentType
			});

			res.end(fileContents);
		};

		server.on('/landing.css', (req, reqUrl, res) => {
			sendFile(res, path.join(mediaPath, 'landing.css'), 'text/css; charset=utf-8').catch(console.error);
		});

		server.on('/signin', (req, reqUrl, res) => {
			let receivedNonce: string = reqUrl.query.nonce as string;
			receivedNonce = receivedNonce.replace(/ /g, '+');

			if (receivedNonce !== nonce) {
				res.writeHead(400, { 'content-type': 'text/html' });
				res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close ADS and try again."));
				res.end();
				console.error('nonce no match');
				return;
			}
			res.writeHead(302, { Location: loginUrl });
			res.end();
		});

		return new Promise<string>((resolve, reject) => {
			server.on('/callback', (req, reqUrl, res) => {
				const state = reqUrl.query.state as string ?? '';
				const code = reqUrl.query.code as string ?? '';

				const stateSplit = state.split(',');
				if (stateSplit.length !== 2) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.stateError', "Authentication failed due to a state mismatch, please close ADS and try again."));
					res.end();
					reject(new Error('State mismatch'));
					return;
				}

				if (stateSplit[1] !== nonce) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close ADS and try again."));
					res.end();
					reject(new Error('Nonce mismatch'));
					return;
				}

				sendFile(res, path.join(mediaPath, 'landing.html'), 'text/html; charset=utf-8').catch(console.error);
				resolve(code);
			});
		});
	}

	refresh(account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this.prompt();
	}

	clear(accountKey: azdata.AccountKey): Thenable<void> {
		return this._clear(accountKey);
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		await this._tokenCache.clearCredential(`${accountKey.accountId}_access`);
		await this._tokenCache.clearCredential(`${accountKey.accountId}_refresh`);
	}

	autoOAuthCancelled(): Thenable<void> {
		return this._authOAuthCancelled();
	}

	private async _authOAuthCancelled(): Promise<void> {
		await this.server?.shutdown();
		this.server = undefined;
	}
}
