/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as nls from 'vscode-nls';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as qs from 'qs';

import {
	AzureAuth,
	AccessToken,
	RefreshToken,
	TokenClaims,
	TokenRefreshResponse,
} from './azureAuth';

import {
	AzureAccountProviderMetadata,
	AzureAuthType,
	Deferred
} from '../interfaces';

import { SimpleWebServer } from '../utils/simpleWebServer';
import { SimpleTokenCache } from '../simpleTokenCache';
const localize = nls.loadMessageBundle();

function parseQuery(uri: vscode.Uri) {
	return uri.query.split('&').reduce((prev: any, current) => {
		const queryString = current.split('=');
		prev[queryString[0]] = queryString[1];
		return prev;
	}, {});
}

interface AuthCodeResponse {
	authCode: string,
	codeVerifier: string
}

export class AzureAuthCodeGrant extends AzureAuth {
	private static readonly USER_FRIENDLY_NAME: string = localize('azure.azureAuthCodeGrantName', "Azure Auth Code Grant");
	private server: SimpleWebServer;

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext,
		uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
	) {
		super(metadata, tokenCache, context, uriEventEmitter, AzureAuthType.AuthCodeGrant, AzureAuthCodeGrant.USER_FRIENDLY_NAME);
	}

	public async autoOAuthCancelled(): Promise<void> {
		return this.server.shutdown();
	}

	public async loginWithLocalServer(authCompletePromise: Promise<void>): Promise<AuthCodeResponse | undefined> {
		this.server = new SimpleWebServer();
		const nonce = crypto.randomBytes(16).toString('base64');
		let serverPort: string;

		try {
			serverPort = await this.server.startup();
		} catch (err) {
			const msg = localize('azure.serverCouldNotStart', 'Server could not start. This could be a permissions error or an incompatibility on your system. You can try enabling device code authentication from settings.');
			vscode.window.showErrorMessage(msg);
			console.dir(err);
			return undefined;
		}

		// The login code to use
		let loginUrl: string;
		let codeVerifier: string;
		{
			codeVerifier = this.toBase64UrlEncoding(crypto.randomBytes(32).toString('base64'));
			const state = `${serverPort},${encodeURIComponent(nonce)}`;
			const codeChallenge = this.toBase64UrlEncoding(crypto.createHash('sha256').update(codeVerifier).digest('base64'));
			const loginQuery = {
				response_type: 'code',
				response_mode: 'query',
				client_id: this.clientId,
				redirect_uri: this.redirectUri,
				state,
				prompt: 'select_account',
				code_challenge_method: 'S256',
				code_challenge: codeChallenge,
				resource: this.metadata.settings.signInResourceId
			};
			loginUrl = `${this.loginEndpointUrl}${this.commonTenant}/oauth2/authorize?${qs.stringify(loginQuery)}`;
		}

		await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${serverPort}/signin?nonce=${encodeURIComponent(nonce)}`));

		const authCode = await this.addServerListeners(this.server, nonce, loginUrl, authCompletePromise);

		return {
			authCode,
			codeVerifier
		};
	}

	public async loginWithoutLocalServer(): Promise<AuthCodeResponse | undefined> {
		const callbackUri = await vscode.env.asExternalUri(vscode.Uri.parse(`${vscode.env.uriScheme}://microsoft.azurecore`));
		const nonce = crypto.randomBytes(16).toString('base64');
		const port = (callbackUri.authority.match(/:([0-9]*)$/) || [])[1] || (callbackUri.scheme === 'https' ? 443 : 80);
		const state = `${port},${encodeURIComponent(nonce)},${encodeURIComponent(callbackUri.query)}`;

		const codeVerifier = this.toBase64UrlEncoding(crypto.randomBytes(32).toString('base64'));
		const codeChallenge = this.toBase64UrlEncoding(crypto.createHash('sha256').update(codeVerifier).digest('base64'));

		const loginQuery = {
			response_type: 'code',
			response_mode: 'query',
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
			state,
			prompt: 'select_account',
			code_challenge_method: 'S256',
			code_challenge: codeChallenge,
			resource: this.metadata.settings.signInResourceId
		};

		const signInUrl = `${this.loginEndpointUrl}${this.commonTenant}/oauth2/authorize?${qs.stringify(loginQuery)}`;
		await vscode.env.openExternal(vscode.Uri.parse(signInUrl));

		const authCode = await this.handleCodeResponse(state);

		return {
			authCode,
			codeVerifier
		};
	}

	public async handleCodeResponse(state: string): Promise<string> {
		let uriEventListener: vscode.Disposable;
		return new Promise((resolve: (value: any) => void, reject) => {
			uriEventListener = this.uriEventEmitter.event(async (uri: vscode.Uri) => {
				try {
					const query = parseQuery(uri);
					const code = query.code;
					if (query.state !== state && decodeURIComponent(query.state) !== state) {
						reject(new Error('State mismatch'));
						return;
					}
					resolve(code);
				} catch (err) {
					reject(err);
				}
			});
		}).finally(() => {
			uriEventListener.dispose();
		});
	}

	public async login(): Promise<azdata.Account | azdata.PromptFailedResult> {

		let authCompleteDeferred: Deferred<void>;
		let authCompletePromise = new Promise<void>((resolve, reject) => authCompleteDeferred = { resolve, reject });

		let authResponse: AuthCodeResponse;
		if (vscode.env.uiKind === vscode.UIKind.Web) {
			authResponse = await this.loginWithoutLocalServer();
		} else {
			authResponse = await this.loginWithLocalServer(authCompletePromise);
		}

		let tokenClaims: TokenClaims;
		let accessToken: AccessToken;
		let refreshToken: RefreshToken;

		try {
			const { accessToken: at, refreshToken: rt, tokenClaims: tc } = await this.getTokenWithAuthCode(authResponse.authCode, authResponse.codeVerifier, this.redirectUri);
			tokenClaims = tc;
			accessToken = at;
			refreshToken = rt;
		} catch (ex) {
			if (ex.msg) {
				vscode.window.showErrorMessage(ex.msg);
			}
			console.log(ex);
		}

		if (!accessToken) {
			const msg = localize('azure.tokenFail', "Failure when retreiving tokens.");
			authCompleteDeferred.reject(new Error(msg));
			throw Error('Failure when retreiving tokens');
		}

		const tenants = await this.getTenants(accessToken);

		try {
			await this.setCachedToken({ accountId: accessToken.key, providerId: this.metadata.id }, accessToken, refreshToken);
		} catch (ex) {
			console.log(ex);
			if (ex.msg) {
				vscode.window.showErrorMessage(ex.msg);
				authCompleteDeferred.reject(ex);
			} else {
				authCompleteDeferred.reject(new Error('There was an issue when storing the cache.'));
			}

			return { canceled: false } as azdata.PromptFailedResult;
		}

		const account = this.createAccount(tokenClaims, accessToken.key, tenants);

		const subscriptions = await this.getSubscriptions(account);
		account.properties.subscriptions = subscriptions;

		authCompleteDeferred.resolve();
		return account;
	}

	private async addServerListeners(server: SimpleWebServer, nonce: string, loginUrl: string, authComplete: Promise<void>): Promise<string> {
		const mediaPath = path.join(this.context.extensionPath, 'media');

		// Utility function
		const sendFile = async (res: http.ServerResponse, filePath: string, contentType: string): Promise<void> => {
			let fileContents;
			try {
				fileContents = await fs.readFile(filePath);
			} catch (ex) {
				console.error(ex);
				res.writeHead(400);
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

		server.on('/SignIn.svg', (req, reqUrl, res) => {
			sendFile(res, path.join(mediaPath, 'SignIn.svg'), 'image/svg+xml').catch(console.error);
		});

		server.on('/signin', (req, reqUrl, res) => {
			let receivedNonce: string = reqUrl.query.nonce as string;
			receivedNonce = receivedNonce.replace(/ /g, '+');

			if (receivedNonce !== nonce) {
				res.writeHead(400, { 'content-type': 'text/html' });
				res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close Azure Data Studio and try again."));
				res.end();
				console.error('nonce no match', receivedNonce, nonce);
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

				if (stateSplit[1] !== encodeURIComponent(nonce)) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close Azure Data Studio and try again."));
					res.end();
					reject(new Error('Nonce mismatch'));
					return;
				}

				resolve(code);

				authComplete.then(() => {
					sendFile(res, path.join(mediaPath, 'landing.html'), 'text/html; charset=utf-8').catch(console.error);
				}, (ex: Error) => {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(ex.message);
					res.end();
				});
			});
		});
	}

	private async getTokenWithAuthCode(authCode: string, codeVerifier: string, redirectUri: string): Promise<TokenRefreshResponse | undefined> {
		const postData = {
			grant_type: 'authorization_code',
			code: authCode,
			client_id: this.clientId,
			code_verifier: codeVerifier,
			redirect_uri: redirectUri,
			resource: this.metadata.settings.signInResourceId
		};

		return this.getToken(postData);
	}

	public dispose() {
		this.server?.shutdown().catch(console.error);
	}
}
