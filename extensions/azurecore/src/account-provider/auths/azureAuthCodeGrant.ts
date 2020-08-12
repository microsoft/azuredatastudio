/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AuthorizationCodePostData, AzureAuth, OAuthTokenResponse } from './azureAuth';
import { AzureAccountProviderMetadata, AzureAuthType, Deferred, Resource, Tenant } from '../interfaces';
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

const localize = nls.loadMessageBundle();

interface AuthCodeResponse {
	authCode: string;
	codeVerifier: string;
	redirectUri: string;
}

interface CryptoValues {
	nonce: string;
	codeVerifier: string;
	codeChallenge: string;
}


export class AzureAuthCodeGrant extends AzureAuth {
	private static readonly USER_FRIENDLY_NAME: string = localize('azure.azureAuthCodeGrantName', 'Azure Auth Code Grant');
	private server: SimpleWebServer;

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext,
		uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
	) {
		super(metadata, tokenCache, context, uriEventEmitter, AzureAuthType.AuthCodeGrant, AzureAuthCodeGrant.USER_FRIENDLY_NAME);
	}


	protected async login(tenant: Tenant, resource: Resource): Promise<{ response: OAuthTokenResponse, authComplete: Deferred<void, Error> }> {
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
			authComplete: authCompleteDeferred
		};
	}

	/**
	 * Requests an OAuthTokenResponse from Microsoft OAuth
	 *
	 * @param tenant
	 * @param resource
	 * @param authCode
	 * @param redirectUri
	 * @param codeVerifier
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

		const signInUrl = `${this.loginEndpointUrl}${tenant}/oauth2/authorize?${qs.stringify(loginQuery)}`;
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

	private async loginDesktop(tenant: Tenant, resource: Resource, authCompletePromise: Promise<void>): Promise<AuthCodeResponse> {
		this.server = new SimpleWebServer();
		let serverPort: string;

		try {
			serverPort = await this.server.startup();
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
			redirect_uri: this.redirectUri,
			state,
			prompt: 'select_account',
			code_challenge_method: 'S256',
			code_challenge: codeChallenge,
			resource: resource.endpoint
		};
		const loginUrl = `${this.loginEndpointUrl}${tenant.id}/oauth2/authorize?${qs.stringify(loginQuery)}`;
		await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${serverPort}/signin?nonce=${encodeURIComponent(nonce)}`));
		const authCode = await this.addServerListeners(this.server, nonce, loginUrl, authCompletePromise);
		return {
			authCode,
			codeVerifier,
			redirectUri: this.redirectUri
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

		return {
			nonce, codeVerifier, codeChallenge
		};
	}
}
