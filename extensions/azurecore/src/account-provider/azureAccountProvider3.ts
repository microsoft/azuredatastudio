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
	AzureAccountProviderMetadata, Tenant,
} from './interfaces';

import TokenCache from './tokenCache';
import { SimpleWebServer } from './simpleWebServer';

const localize = nls.loadMessageBundle();
// const notInitalizedMessage = localize('accountProviderNotInitialized', "Account provider not initialized, cannot perform action");

interface Token {
	accessToken: string; // When unable to refresh due to network problems, the access token becomes undefined

	expiresIn: string; // How long access token is valid, in seconds
	refreshToken: string;

	accountName: string;
	scope: string;
	sessionId: string; // The account id + the scope
}

export class AzureAccountProvider implements azdata.AccountProvider {
	private readonly loginEndpointUrl: string;
	private readonly commonTenant: string;
	private readonly redirectUri: string;
	private readonly scopes: string[];
	private readonly clientId: string;

	constructor(private metadata: AzureAccountProviderMetadata,
		_tokenCache: TokenCache,
		_context: vscode.ExtensionContext) {
		this.loginEndpointUrl = this.metadata.settings.host;
		this.commonTenant = 'common';
		this.redirectUri = this.metadata.settings.redirectUri;
		this.scopes = ['openid', 'email', 'profile', 'offline_access', 'https://management.azure.com/user_impersonation'];
		this.clientId = this.metadata.settings.clientId;
	}


	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		throw new Error('Method not implemented.');
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		throw new Error('Method not implemented.');
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

		const tenants = this.getTenants(token);
		console.log(token);
		console.log(tenants);
		return undefined;
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
		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2019-11-01');

		console.log(tenantUri);
		try {
			const x = await this.makeWebRequest(token, tenantUri);
			console.log(x);
		} catch (ex) {
			console.log(ex);
		}

		return undefined;
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
				accountName: tokenClaims.email || tokenClaims.unique_name || tokenClaims.name
			};

			return tokenResult;

		} catch (err) {
			//TODO handle errors
			console.log(err);
		}

		return undefined;
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
		throw new Error('Method not implemented.');
	}

	clear(accountKey: azdata.AccountKey): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	autoOAuthCancelled(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}
