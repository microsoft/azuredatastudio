/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AuthorizationCodePostData, AzureAuth, OAuthTokenResponse } from './azureAuth';
import { AzureAccountProviderMetadata, AzureAuthType, Resource, Tenant } from 'azurecore';
import { Deferred } from '../interfaces';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { SimpleTokenCache } from '../simpleTokenCache';
import { SimpleWebServer } from '../utils/simpleWebServer';
import { AzureAuthError } from './azureAuthError';
import { Logger } from '../../utils/Logger';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as http from 'http';
import * as qs from 'qs';
import { promises as fs } from 'fs';
import { PublicClientApplication, CryptoProvider, AuthorizationUrlRequest, AuthorizationCodeRequest, AuthenticationResult } from '@azure/msal-node';


const localize = nls.loadMessageBundle();

interface AuthCodeResponse {
	authCode: string;
	codeVerifier: string;
	redirectUri: string;
}

interface CryptoValues {
	nonce: string;
	challengeMethod: string;
	codeVerifier: string;
	codeChallenge: string;
}


export class AzureAuthCodeGrant extends AzureAuth {
	private static readonly USER_FRIENDLY_NAME: string = localize('azure.azureAuthCodeGrantName', 'Azure Auth Code Grant');
	private cryptoProvider: CryptoProvider;
	private pkceCodes: CryptoValues;

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext,
		uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
		clientApplication: PublicClientApplication
	) {
		super(metadata, tokenCache, context, clientApplication, uriEventEmitter, AzureAuthType.AuthCodeGrant, AzureAuthCodeGrant.USER_FRIENDLY_NAME);
		this.cryptoProvider = new CryptoProvider();
		this.pkceCodes = {
			nonce: '',
			challengeMethod: 'S256', // Use SHA256 Algorithm
			codeVerifier: '', // Generate a code verifier for the Auth Code Request first
			codeChallenge: '', // Generate a code challenge from the previously generated code verifier
		};
	}

	protected async login(tenant: Tenant, resource: Resource): Promise<{ response: OAuthTokenResponse | undefined, authComplete: Deferred<void, Error> }> {
		let authCompleteDeferred: Deferred<void, Error>;
		let authCompletePromise = new Promise<void>((resolve, reject) => authCompleteDeferred = { resolve, reject });
		let authResponse: AuthCodeResponse;

		if (vscode.env.uiKind === vscode.UIKind.Web) {
			authResponse = await this.loginWeb(tenant, resource);
		} else {
			authResponse = await this.loginDesktop(tenant, resource, authCompletePromise);
		}

		return {
			response: await this.getTokenWithAuthorizationCode(tenant, resource, authResponse),
			authComplete: authCompleteDeferred!
		};
	}

	protected async loginMsal(tenant: Tenant, resource: Resource): Promise<{ response: AuthenticationResult | null, authComplete: Deferred<void, Error> }> {
		let authCompleteDeferred: Deferred<void, Error>;
		let authCompletePromise = new Promise<void>((resolve, reject) => authCompleteDeferred = { resolve, reject });
		let authCodeRequest: AuthorizationCodeRequest;

		if (vscode.env.uiKind === vscode.UIKind.Web) {
			authCodeRequest = await this.loginWebMsal(tenant, resource);
		} else {
			authCodeRequest = await this.loginDesktopMsal(tenant, authCompletePromise);
		}

		let result = await this.clientApplication.acquireTokenByCode(authCodeRequest);
		if (!result) {
			Logger.error('Failed to acquireTokenByCode');
			throw Error('Failed to fetch token using auth code');
		} else {
			console.log(result);
			return {
				response: result,
				authComplete: authCompleteDeferred!
			};
		}
	}

	/**
	 * Requests an OAuthTokenResponse from Microsoft OAuth
	 *
	 * @param tenant
	 * @param resource
	 */
	private async getTokenWithAuthorizationCode(tenant: Tenant, resource: Resource, { authCode, redirectUri, codeVerifier }: AuthCodeResponse): Promise<OAuthTokenResponse | undefined> {
		const postData: AuthorizationCodePostData = {
			grant_type: 'authorization_code',
			code: authCode,
			client_id: this.clientId,
			code_verifier: codeVerifier,
			redirect_uri: redirectUri,
			resource: resource.endpoint
		};

		return this.getToken(tenant, resource, postData);
	}

	private async loginWebMsal(tenant: Tenant, resource: Resource): Promise<AuthorizationCodeRequest> {
		const callbackUri = await vscode.env.asExternalUri(vscode.Uri.parse(`${vscode.env.uriScheme}://microsoft.azurecore`));
		await this.createCryptoValuesMsal();
		const port = (callbackUri.authority.match(/:([0-9]*)$/) || [])[1] || (callbackUri.scheme === 'https' ? 443 : 80);
		const state = `${port},${encodeURIComponent(this.pkceCodes.nonce)},${encodeURIComponent(callbackUri.query)}`;

		try {
			let authUrlRequest: AuthorizationUrlRequest;
			authUrlRequest = {
				scopes: this.scopes,
				redirectUri: this.redirectUri,
				codeChallenge: this.pkceCodes.codeChallenge,
				codeChallengeMethod: this.pkceCodes.challengeMethod,
				prompt: 'select_account',
				state: state
			};
			let authCodeRequest: AuthorizationCodeRequest;
			authCodeRequest = {
				scopes: this.scopes,
				redirectUri: this.redirectUri,
				codeVerifier: this.pkceCodes.codeVerifier,
				code: ''
			};
			let authCodeUrl = await this.clientApplication.getAuthCodeUrl(authUrlRequest);
			await vscode.env.openExternal(vscode.Uri.parse(authCodeUrl));
			const authCode = await this.handleWebResponse(state);
			authCodeRequest.code = authCode;
			console.log(authCodeRequest);

			return authCodeRequest;
		} catch (e) {
			Logger.error('MSAL: Error requesting auth code', e);
			throw new AzureAuthError('error', 'Error requesting auth code', e);
		}
	}

	private async loginWeb(tenant: Tenant, resource: Resource): Promise<AuthCodeResponse> {
		const callbackUri = await vscode.env.asExternalUri(vscode.Uri.parse(`${vscode.env.uriScheme}://microsoft.azurecore`));
		const { nonce, codeVerifier, codeChallenge } = this.createCryptoValues();
		const port = (callbackUri.authority.match(/:([0-9]*)$/) || [])[1] || (callbackUri.scheme === 'https' ? 443 : 80);
		const state = `${port},${encodeURIComponent(nonce)},${encodeURIComponent(callbackUri.query)}`;

		const loginQuery = {
			response_type: 'code',
			response_mode: 'query',
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
			state,
			prompt: 'select_account',
			code_challenge_method: 'S256',
			code_challenge: codeChallenge,
			resource: resource.id
		};

		const signInUrl = `${this.loginEndpointUrl}${tenant.id}/oauth2/authorize?${qs.stringify(loginQuery)}`;
		await vscode.env.openExternal(vscode.Uri.parse(signInUrl));

		const authCode = await this.handleWebResponse(state);

		return {
			authCode,
			codeVerifier,
			redirectUri: this.redirectUri
		};
	}

	private async handleWebResponse(state: string): Promise<string> {
		let uriEventListener: vscode.Disposable;
		return new Promise((resolve: (value: any) => void, reject) => {
			uriEventListener = this.uriEventEmitter.event(async (uri: vscode.Uri) => {
				try {
					const query = this.parseQuery(uri);
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

	private parseQuery(uri: vscode.Uri): { [key: string]: string } {
		return uri.query.split('&').reduce((prev: any, current) => {
			const queryString = current.split('=');
			prev[queryString[0]] = queryString[1];
			return prev;
		}, {});
	}

	private async loginDesktopMsal(tenant: Tenant, authCompletePromise: Promise<void>): Promise<AuthorizationCodeRequest> {
		const server = new SimpleWebServer();
		let serverPort: string;

		try {
			serverPort = await server.startup();
		} catch (ex) {
			const msg = localize('azure.serverCouldNotStart', 'Server could not start. This could be a permissions error or an incompatibility on your system. You can try enabling device code authentication from settings.');
			throw new AzureAuthError(msg, 'Server could not start', ex);
		}
		await this.createCryptoValuesMsal();
		const state = `${serverPort},${this.pkceCodes.nonce}`;

		try {
			let authUrlRequest: AuthorizationUrlRequest;
			authUrlRequest = {
				scopes: this.scopes,
				redirectUri: `${this.redirectUri}:${serverPort}/redirect`,
				codeChallenge: this.pkceCodes.codeChallenge,
				codeChallengeMethod: this.pkceCodes.challengeMethod,
				prompt: 'select_account',
				authority: `https://login.microsoftonline.com/${this.commonTenant.id}`,
				state: state
			};
			let authCodeRequest: AuthorizationCodeRequest;
			authCodeRequest = {
				scopes: this.scopes,
				redirectUri: `${this.redirectUri}:${serverPort}/redirect`,
				codeVerifier: this.pkceCodes.codeVerifier,
				code: ''
			};
			let authCodeUrl = await this.clientApplication.getAuthCodeUrl(authUrlRequest);

			// TODO: listen for the auth code that gets returned
			// 1. set up the listener
			// 2. open the URL
			// 3. wait for login?

			console.log(authCodeUrl);

			await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${serverPort}/signin?nonce=${encodeURIComponent(this.pkceCodes.nonce)}`));
			const authCode = await this.addServerListeners(server, this.pkceCodes.nonce, authCodeUrl, authCompletePromise);

			// const authCode = await this.listenForAuthCode(authCodeUrl);
			authCodeRequest.code = authCode;
			console.log(authCodeRequest);

			return authCodeRequest;
		}

		catch (e) {
			Logger.error('MSAL: Error requesting auth code', e);
			throw new AzureAuthError('error', 'Error requesting auth code', e);
		}


	}

	private async loginDesktop(tenant: Tenant, resource: Resource, authCompletePromise: Promise<void>): Promise<AuthCodeResponse> {
		const server = new SimpleWebServer();
		let serverPort: string;

		try {
			serverPort = await server.startup();
		} catch (ex) {
			const msg = localize('azure.serverCouldNotStart', 'Server could not start. This could be a permissions error or an incompatibility on your system. You can try enabling device code authentication from settings.');
			throw new AzureAuthError(msg, 'Server could not start', ex);
		}
		const { nonce, codeVerifier, codeChallenge } = this.createCryptoValues();
		const state = `${serverPort},${encodeURIComponent(nonce)}`;
		const loginQuery = {
			response_type: 'code',
			response_mode: 'query',
			client_id: this.clientId,
			redirect_uri: `${this.redirectUri}:${serverPort}/redirect`,
			state,
			prompt: 'select_account',
			code_challenge_method: 'S256',
			code_challenge: codeChallenge,
			resource: resource.endpoint
		};
		const loginUrl = `${this.loginEndpointUrl}${tenant.id}/oauth2/authorize?${qs.stringify(loginQuery)}`;
		await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${serverPort}/signin?nonce=${encodeURIComponent(nonce)}`));
		const authCode = await this.addServerListeners(server, nonce, loginUrl, authCompletePromise);
		return {
			authCode,
			codeVerifier,
			redirectUri: `${this.redirectUri}:${serverPort}/redirect`
		};

	}

	private async addServerListeners(server: SimpleWebServer, nonce: string, loginUrl: string, authComplete: Promise<void>): Promise<string> {
		const mediaPath = path.join(this.context.extensionPath, 'media');

		// Utility function
		const sendFile = async (res: http.ServerResponse, filePath: string, contentType: string): Promise<void> => {
			let fileContents;
			try {
				fileContents = await fs.readFile(filePath);
			} catch (ex) {
				Logger.error(ex);
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
			sendFile(res, path.join(mediaPath, 'landing.css'), 'text/css; charset=utf-8').catch(Logger.error);
		});

		server.on('/SignIn.svg', (req, reqUrl, res) => {
			sendFile(res, path.join(mediaPath, 'SignIn.svg'), 'image/svg+xml').catch(Logger.error);
		});

		server.on('/signin', (req, reqUrl, res) => {
			let receivedNonce: string = reqUrl.query.nonce as string;
			receivedNonce = receivedNonce.replace(/ /g, '+');

			if (receivedNonce !== nonce) {
				res.writeHead(400, { 'content-type': 'text/html' });
				res.write(localize('azureAuth.nonceError', 'Authentication failed due to a nonce mismatch, please close Azure Data Studio and try again.'));
				res.end();
				Logger.error('nonce no match', receivedNonce, nonce);
				return;
			}
			res.writeHead(302, { Location: loginUrl });
			res.end();
		});

		return new Promise<string>((resolve, reject) => {
			server.on('/redirect', (req, reqUrl, res) => {
				const state = reqUrl.query.state as string ?? '';
				const split = state.split(',');
				if (split.length !== 2) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.stateError', 'Authentication failed due to a state mismatch, please close ADS and try again.'));
					res.end();
					reject(new Error('State mismatch'));
					return;
				}
				const port = split[0];
				res.writeHead(302, { Location: `http://127.0.0.1:${port}/callback${reqUrl.search}` });
				res.end();
			});

			server.on('/callback', (req, reqUrl, res) => {
				const state = reqUrl.query.state as string ?? '';
				const code = reqUrl.query.code as string ?? '';

				const stateSplit = state.split(',');
				if (stateSplit.length !== 2) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.stateError', 'Authentication failed due to a state mismatch, please close ADS and try again.'));
					res.end();
					reject(new Error('State mismatch'));
					return;
				}

				if (stateSplit[1] !== encodeURIComponent(nonce)) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.nonceError', 'Authentication failed due to a nonce mismatch, please close Azure Data Studio and try again.'));
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


	private createCryptoValues(): CryptoValues {
		const nonce = crypto.randomBytes(16).toString('base64');
		const codeVerifier = this.toBase64UrlEncoding(crypto.randomBytes(32).toString('base64'));
		const codeChallenge = this.toBase64UrlEncoding(crypto.createHash('sha256').update(codeVerifier).digest('base64'));
		const challengeMethod = '';

		return {
			nonce, challengeMethod, codeVerifier, codeChallenge
		};
	}

	private async createCryptoValuesMsal(): Promise<void> {
		this.pkceCodes.nonce = this.cryptoProvider.createNewGuid();
		const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();
		this.pkceCodes.codeVerifier = verifier;
		this.pkceCodes.codeChallenge = challenge;
	}
}
