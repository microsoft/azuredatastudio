/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAuth } from './azureAuth';
import { AzureAccountProviderMetadata, AzureAuthType, Resource, Tenant } from 'azurecore';
import { Deferred } from '../interfaces';
import * as vscode from 'vscode';
import { SimpleWebServer } from '../utils/simpleWebServer';
import { AzureAuthError } from './azureAuthError';
import { Logger } from '../../utils/Logger';
import * as Constants from '../../constants';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as http from 'http';
import { promises as fs } from 'fs';
import { PublicClientApplication, CryptoProvider, AuthorizationUrlRequest, AuthorizationCodeRequest, AuthenticationResult } from '@azure/msal-node';
import { MsalCachePluginProvider } from '../utils/msalCachePlugin';

const localize = nls.loadMessageBundle();

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
		msalCacheProvider: MsalCachePluginProvider,
		context: vscode.ExtensionContext,
		uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
		clientApplication: PublicClientApplication
	) {
		super(metadata, msalCacheProvider, context, clientApplication, uriEventEmitter, AzureAuthType.AuthCodeGrant, AzureAuthCodeGrant.USER_FRIENDLY_NAME);
		this.cryptoProvider = new CryptoProvider();
		this.pkceCodes = {
			nonce: '',
			challengeMethod: Constants.S256_CODE_CHALLENGE_METHOD, // Use SHA256 as the challenge method
			codeVerifier: '', // Generate a code verifier for the Auth Code Request first
			codeChallenge: '', // Generate a code challenge from the previously generated code verifier
		};
	}

	protected async login(tenant: Tenant, resource: Resource): Promise<{ response: AuthenticationResult | null, authComplete: Deferred<void, Error> }> {
		let authCompleteDeferred: Deferred<void, Error>;
		let authCompletePromise = new Promise<void>((resolve, reject) => authCompleteDeferred = { resolve, reject });
		let authCodeRequest: AuthorizationCodeRequest;

		if (vscode.env.uiKind === vscode.UIKind.Web) {
			authCodeRequest = await this.loginWeb(tenant, resource);
		} else {
			authCodeRequest = await this.loginDesktopMsal(tenant, resource, authCompletePromise);
		}

		let result = await this.clientApplication.acquireTokenByCode(authCodeRequest);
		if (!result) {
			Logger.error('Failed to acquireTokenByCode');
			Logger.error(`Auth Code Request: ${JSON.stringify(authCodeRequest)}`)
			throw Error('Failed to fetch token using auth code');
		} else {
			return {
				response: result,
				authComplete: authCompleteDeferred!
			};
		}
	}

	private async loginWeb(tenant: Tenant, resource: Resource): Promise<AuthorizationCodeRequest> {
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
				prompt: Constants.SELECT_ACCOUNT,
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

			return authCodeRequest;
		} catch (e) {
			let errorMessage = localize('azureAuthCodeGrant.getAuthCodeUrlError', 'An error occurred in MSAL library when requesting auth code URL. For more detailed information on error, please check \'Azure Accounts\' output pane. \n\n');
			Logger.error(errorMessage);
			throw new AzureAuthError(errorMessage + e.message, e.message, e);
		}
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

	private async loginDesktopMsal(tenant: Tenant, resource: Resource, authCompletePromise: Promise<void>): Promise<AuthorizationCodeRequest> {
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
				prompt: Constants.SELECT_ACCOUNT,
				authority: `${this.loginEndpointUrl}${tenant.id}`,
				state: state
			};
			let authCodeRequest: AuthorizationCodeRequest;
			authCodeRequest = {
				scopes: this.scopes,
				redirectUri: `${this.redirectUri}:${serverPort}/redirect`,
				codeVerifier: this.pkceCodes.codeVerifier,
				authority: `${this.loginEndpointUrl}${tenant.id}`,
				code: ''
			};
			let authCodeUrl = await this.clientApplication.getAuthCodeUrl(authUrlRequest);

			await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${serverPort}/signin?nonce=${encodeURIComponent(this.pkceCodes.nonce)}`));
			const authCode = await this.addServerListeners(server, this.pkceCodes.nonce, authCodeUrl, authCompletePromise);

			authCodeRequest.code = authCode;
			return authCodeRequest;
		}
		catch (e) {
			let errorMessage = localize('azureAuthCodeGrant.getAuthCodeUrlError', 'An error occurred in MSAL library when requesting auth code URL. For more detailed information on error, please check \'Azure Accounts\' output pane. \n\n');
			Logger.error(errorMessage);
			throw new AzureAuthError(errorMessage + e.message, e.message, e);
		}
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

	private async createCryptoValuesMsal(): Promise<void> {
		this.pkceCodes.nonce = this.cryptoProvider.createNewGuid();
		const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();
		this.pkceCodes.codeVerifier = verifier;
		this.pkceCodes.codeChallenge = challenge;
	}
}
