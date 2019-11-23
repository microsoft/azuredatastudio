/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import * as crypto from 'crypto';
import * as nls from 'vscode-nls';
import {
	AzureAccount,
	AzureAccountProviderMetadata,
} from './interfaces';

import TokenCache from './tokenCache';
import { AddressInfo } from 'net';
import { AuthenticationContext, TokenResponse } from 'adal-node';
import { promisify } from 'util';
const localize = nls.loadMessageBundle();

export class AzureAccountProvider implements azdata.AccountProvider, vscode.UriHandler {
	private static WorkSchoolAccountType: string = 'work_school';
	private static MicrosoftAccountType: string = 'microsoft';
	constructor(private metadata: AzureAccountProviderMetadata, private tokenCache: TokenCache) {
		console.log(this.metadata, this.tokenCache);

		vscode.window.registerUriHandler(this);
	}

	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._initialize(storedAccounts);
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return this._getSecurityToken(account, resource);
	}
	prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._prompt();
	}
	refresh(account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._refresh(account);
	}
	clear(accountKey: azdata.AccountKey): Thenable<void> {
		return this._clear(accountKey);
	}
	autoOAuthCancelled(): Thenable<void> {
		return this._autoOAuthCancelled();
	}

	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		console.log(uri);
	}

	private async _initialize(storedAccounts: azdata.Account[]): Promise<azdata.Account[]> {
		return storedAccounts;
	}

	private async _getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<{}> {
		throw new Error('Method not implemented.');
	}

	private async _prompt(): Promise<azdata.Account | azdata.PromptFailedResult> {
		const pathMappings = new Map<string, (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => void>();

		// const redirectUri = await vscode.env.createAppUri({
		// 	payload: { path: 'authenticated' }
		// });
		const redirectUrlAAD = 'https://vscode-redirect.azurewebsites.net/';
		const nonce = crypto.randomBytes(16).toString('base64');

		const server = this.createAuthServer(pathMappings);

		const port = await this.listenToServer(server);

		const authUrl = this.createAuthUrl(
			this.metadata.settings.host,
			redirectUrlAAD,
			this.metadata.settings.clientId,
			this.metadata.settings.signInResourceId,
			'common',
			`${port},${encodeURIComponent(nonce)}`
		);
		this.addServerPaths(pathMappings, nonce, authUrl);

		console.log(`http://localhost:${port}/signin?nonce=${encodeURIComponent(nonce)}`);

		vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}/signin?nonce=${encodeURIComponent(nonce)}`));

		throw new Error('Method not implemented.');
	}

	private addServerPaths(
		pathMappings: Map<string, (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => void>,
		nonce: string,
		authUrl: string) {

		const initialSignIn = ((req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => {
			const receivedNonce = (reqUrl.query.nonce as string || '').replace(/ /g, '+');
			if (receivedNonce !== nonce) {
				// TODO handle broken nonce situation
				return;
			}
			res.writeHead(302, { Location: authUrl });
			res.end();
		});

		const callback = ((req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => {
			const state = reqUrl.query.state as string ?? '';
			const code = reqUrl.query.code as string ?? '';

			const stateSplit = state.split(',');
			if (stateSplit.length !== 2) {
				// TODO handle broken state.
				return;
			}

			if (stateSplit[1] !== nonce) {
				// TODO handle broken nonce situation
				return;
			}

			res.writeHead(200, 'success, you may close this page');
			res.end();

			this.handleAuthentication(code, authUrl).catch((e: any) => console.error(e));
		});

		pathMappings.set('/signin', initialSignIn);
		pathMappings.set('/callback', callback);
	}

	private async _refresh(account: azdata.Account): Promise<azdata.Account | azdata.PromptFailedResult> {
		throw new Error('Method not implemented.');
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		throw new Error('Method not implemented.');
	}

	private async _autoOAuthCancelled(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	private async handleAuthentication(code: string, redirectUrl: string): Promise<AzureAccount> {
		const token = await this.getTokenWithAuthCode(code, redirectUrl);

		console.log(token);
		let identityProvider = token.identityProvider;
		if (identityProvider) {
			identityProvider = identityProvider.toLowerCase();
		}

		// Determine if this is a microsoft account
		let msa = identityProvider && (
			identityProvider.indexOf('live.com') !== -1 ||
			identityProvider.indexOf('live-int.com') !== -1 ||
			identityProvider.indexOf('f8cdef31-a31e-4b4a-93e4-5f571e91255a') !== -1 ||
			identityProvider.indexOf('ea8a4392-515e-481f-879e-6571ff2a8a36') !== -1);

		// Calculate the display name for the user
		let displayName = (token.givenName && token.familyName)
			? `${token.givenName} ${token.familyName}`
			: token.userId;

		// Calculate the home tenant display name to use for the contextual display name
		let contextualDisplayName = msa
			? localize('microsoftAccountDisplayName', "Microsoft Account")
			: ''; // TODO tenants

		let accountType = msa
			? AzureAccountProvider.MicrosoftAccountType
			: AzureAccountProvider.WorkSchoolAccountType;
		return {
			key: {
				providerId: this.metadata.id,
				accountId: token.userId
			},
			name: token.userId,
			displayInfo: {
				accountType: accountType,
				userId: token.userId,
				contextualDisplayName: contextualDisplayName,
				displayName: displayName
			},
			properties: {
				isMsAccount: msa,
				tenants: []
			},
			isStale: false
		} as AzureAccount;
	}

	private async getTokenWithAuthCode(code: string, redirectUrl: string): Promise<TokenResponse> {
		const context = new AuthenticationContext(`${this.metadata.settings.host}common`);
		const acquireToken = promisify(context.acquireTokenWithAuthorizationCode);
		let token = await acquireToken(code, redirectUrl, this.metadata.settings.signInResourceId, this.metadata.settings.clientId, undefined);
		if (token.error) {
			throw new Error(`${token.error} - ${token.errorDescription}`);
		}
		token = token as TokenResponse;

		return token;
	}

	private createAuthUrl(baseHost: string, redirectUri: string, clientId: string, resource: string, tenant: string, nonce: string): string {
		// TODO do this properly.
		return `${baseHost}${tenant}/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${nonce}&resource=${resource}`;
	}

	private createAuthServer(pathMappings: Map<string, (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => void>) {
		const server = http.createServer((req, res) => {
			// Parse URL and the query string
			const reqUrl = url.parse(req.url, true);

			const method = pathMappings.get(reqUrl.pathname);
			if (method) {
				method(req, res, reqUrl);
			} else {
				console.error('undefined request ', reqUrl);
			}
		});

		return server;
	}

	/**
	 * Actually starts listening for the server - returns the port the server is listening on
	 * @param server http.Server
	 */
	private async listenToServer(server: http.Server): Promise<number> {
		let portTimer: NodeJS.Timer;
		const cancelPortTimer = (() => {
			clearTimeout(portTimer);
		});

		const port = new Promise<number>((resolve, reject) => {
			// If no port for 5 seconds, reject it.
			portTimer = setTimeout(() => {
				reject(new Error('Timeout waiting for port'));
			}, 5000);

			server.on('listening', () => {
				const address = server.address() as AddressInfo;
				if (address!.port === undefined) {
					reject(new Error('Port was not defined'));
				}
				resolve(address.port);
			});
			server.on('error', err => {
				reject(err);
			});
			server.on('close', () => {
				reject(new Error('Closed'));
			});
			server.listen(0, '127.0.0.1');
		});

		const portValue = await port;
		cancelPortTimer();

		return portValue;
	}
}
