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
import * as request from 'request';
import {
	AzureAccount,
	AzureAccountProviderMetadata,
	AzureAccountSecurityTokenCollection,
	AzureAccountSecurityToken,
	Tenant,
} from './interfaces';

import TokenCache from './tokenCache';
import { AddressInfo } from 'net';
import { AuthenticationContext, TokenResponse, ErrorResponse } from 'adal-node';
import { promisify } from 'util';
import * as events from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';

const localize = nls.loadMessageBundle();
const notInitalizedMessage = localize('accountProviderNotInitialized', "Account provider not initialized, cannot perform action");

export class AzureAccountProvider implements azdata.AccountProvider {
	private static AzureAccountAuthenticatedEvent: string = 'AzureAccountAuthenticated';
	private static WorkSchoolAccountType: string = 'work_school';
	private static MicrosoftAccountType: string = 'microsoft';
	private static AadCommonTenant: string = 'common';

	private static eventEmitter = new events.EventEmitter();
	private static redirectUrlAAD = 'https://vscode-redirect.azurewebsites.net/';
	private commonAuthorityUrl: string;
	private isInitialized: boolean = false;


	constructor(private metadata: AzureAccountProviderMetadata, private _tokenCache: TokenCache, private _context: vscode.ExtensionContext) {
		this.commonAuthorityUrl = url.resolve(this.metadata.settings.host, AzureAccountProvider.AadCommonTenant);
	}
	// interface method
	clearTokenCache(): Thenable<void> {
		return this._tokenCache.clear();
	}

	// interface method
	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._initialize(storedAccounts);
	}

	private async _initialize(storedAccounts: azdata.Account[]): Promise<azdata.Account[]> {
		for (let account of storedAccounts) {
			try {
				await this.getAccessTokens(account, azdata.AzureResource.ResourceManagement);
			} catch (e) {
				console.error(`Refreshing account ${account.displayInfo} failed - ${e}`);
				account.isStale = true;
				azdata.accounts.accountUpdated(account);
			}
		}
		this.isInitialized = true;
		return storedAccounts;
	}

	private async getToken(userId: string, tenantId: string, resourceId: string): Promise<TokenResponse> {
		let authorityUrl = url.resolve(this.metadata.settings.host, tenantId);
		const context = new AuthenticationContext(authorityUrl, null, this._tokenCache);

		const acquireToken = promisify(context.acquireToken).bind(context);

		let response: (TokenResponse | ErrorResponse) = await acquireToken(resourceId, userId, this.metadata.settings.clientId);
		if (response.error) {
			throw new Error(`Response contained error ${response}`);
		}

		response = response as TokenResponse;

		context.cache.add([response], (err, result) => {
			if (err || !result) {
				const msg = localize('azure.tokenCacheFail', "Unexpected error adding token to cache: {0}", err.message);
				vscode.window.showErrorMessage(msg);
				console.log(err);
			}
		});

		return response;
	}

	private async getAccessTokens(account: azdata.Account, resource: azdata.AzureResource): Promise<AzureAccountSecurityTokenCollection> {
		const resourceIdMap = new Map<azdata.AzureResource, string>([
			[azdata.AzureResource.ResourceManagement, this.metadata.settings.armResource.id],
			[azdata.AzureResource.Sql, this.metadata.settings.sqlResource.id],
			[azdata.AzureResource.OssRdbms, this.metadata.settings.ossRdbmsResource.id],
			[azdata.AzureResource.AzureKeyVault, this.metadata.settings.azureKeyVaultResource.id]
		]);
		const tenantRefreshPromises: Promise<{ tenantId: any, securityToken: AzureAccountSecurityToken }>[] = [];
		const tokenCollection: AzureAccountSecurityTokenCollection = {};

		for (let tenant of account.properties.tenants) {
			const promise = new Promise<{ tenantId: any, securityToken: AzureAccountSecurityToken }>(async (resolve, reject) => {
				try {
					let response = await this.getToken(tenant.userId, tenant.id, resourceIdMap.get(resource));

					resolve({
						tenantId: tenant.id,
						securityToken: {
							expiresOn: response.expiresOn,
							resource: response.resource,
							token: response.accessToken,
							tokenType: response.tokenType
						} as AzureAccountSecurityToken,
					});
				} catch (ex) {
					reject(ex);
				}

			});
			tenantRefreshPromises.push(promise);
		}

		const refreshedTenants = await Promise.all(tenantRefreshPromises);
		refreshedTenants.forEach((refreshed) => {
			tokenCollection[refreshed.tenantId] = refreshed.securityToken;
		});

		return tokenCollection;
	}

	// interface method
	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return this._getSecurityToken(account, resource);
	}

	private async _getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<{}> {
		return this.getAccessTokens(account, resource);
	}

	// interface method
	prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._prompt();
	}


	private async _prompt(): Promise<azdata.Account | azdata.PromptFailedResult> {
		if (this.isInitialized === false) {
			vscode.window.showInformationMessage(notInitalizedMessage);
			return { canceled: false };
		}
		const pathMappings = new Map<string, (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => void>();

		const nonce = crypto.randomBytes(16).toString('base64');

		const server = this.createAuthServer(pathMappings);

		const port = await this.listenToServer(server);
		try {
			const authUrl = this.createAuthUrl(
				this.metadata.settings.host,
				AzureAccountProvider.redirectUrlAAD,
				this.metadata.settings.clientId,
				this.metadata.settings.signInResourceId,
				AzureAccountProvider.AadCommonTenant,
				`${port},${encodeURIComponent(nonce)}`
			);

			this.addServerPaths(pathMappings, nonce, authUrl);

			const accountAuthenticatedPromise = new Promise<AzureAccount>((resolve, reject) => {
				AzureAccountProvider.eventEmitter.on(AzureAccountProvider.AzureAccountAuthenticatedEvent, ({ account, error }) => {
					if (error) {
						return reject(error);
					}
					return resolve(account);
				});
			});

			const urlToOpen = `http://localhost:${port}/signin?nonce=${encodeURIComponent(nonce)}`;

			vscode.env.openExternal(vscode.Uri.parse(urlToOpen));

			const account = await accountAuthenticatedPromise;

			return account;
		} finally {
			server.close();
		}
	}

	private addServerPaths(
		pathMappings: Map<string, (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => void>,
		nonce: string,
		authUrl: string) {

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

		const initialSignIn = (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => {
			const receivedNonce = (reqUrl.query.nonce as string || '').replace(/ /g, '+');
			if (receivedNonce !== nonce) {
				res.writeHead(400, { 'content-type': 'text/html' });
				res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close ADS and try again."));
				res.end();
				return;
			}
			res.writeHead(302, { Location: authUrl });
			res.end();
		};

		const authCallback = (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => {
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


			sendFile(res, path.join(mediaPath, 'landing.html'), 'text/html; charset=utf-8').catch(console.error);
			this.handleAuthentication(code).catch((e) => console.error(e));
		};

		const css = (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => {
			sendFile(res, path.join(mediaPath, 'landing.css'), 'text/css; charset=utf-8').catch(console.error);
		};

		const svg = (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => {
			sendFile(res, path.join(mediaPath, 'SignIn.svg'), 'image/svg+xml').catch(console.error);
		};

		pathMappings.set('/signin', initialSignIn);
		pathMappings.set('/callback', authCallback);
		pathMappings.set('/landing.css', css);
		pathMappings.set('/SignIn.svg', svg);
	}

	private async makeWebRequest(accessToken: TokenResponse, uri: string): Promise<any> {
		const params = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${accessToken.accessToken}`
			},
			json: true
		};

		return new Promise((resolve, reject) => {
			request.get(uri, params, (error: any, response: request.Response, body: any) => {
				const err = error ?? body.error;
				if (err) {
					return reject(err);
				}
				return resolve(body.value);
			});
		});
	}

	private async getTenants(userId: string, homeTenant?: string): Promise<Tenant[]> {
		const armToken = await this.getToken(userId, AzureAccountProvider.AadCommonTenant, this.metadata.settings.armResource.id);
		const tenantUri = url.resolve(this.metadata.settings.armResource.endpoint, 'tenants?api-version=2015-01-01');
		const armWebResponse: any[] = await this.makeWebRequest(armToken, tenantUri);

		const promises = armWebResponse.map(async (value: { tenantId: string }) => {
			let graphToken: TokenResponse;

			try {
				graphToken = await this.getToken(userId, value.tenantId, this.metadata.settings.graphResource.id);
			} catch (ex) {
				const msg = localize('azure.authFail', "Your authentication to the tenant {0} failed: {1}", value.tenantId, ex);
				vscode.window.showErrorMessage(msg);
				console.log(msg);
				return undefined;
			}

			let tenantDetailsUri = url.resolve(this.metadata.settings.graphResource.endpoint, value.tenantId + '/');
			tenantDetailsUri = url.resolve(tenantDetailsUri, 'tenantDetails?api-version=2013-04-05');
			const tenantDetails: any[] = await this.makeWebRequest(graphToken, tenantDetailsUri);

			return {
				id: value.tenantId,
				userId: userId,
				displayName: tenantDetails.length > 0 && tenantDetails[0].displayName
					? tenantDetails[0].displayName
					: localize('azureWorkAccountDisplayName', "Work or school account")
			} as Tenant;
		});

		let tenants = await Promise.all(promises);

		tenants = tenants.filter(t => t !== undefined);
		if (tenants.length === 0) {
			const msg = localize('azure.noTenants', "Failed to add account. No Azure tenants.");
			vscode.window.showErrorMessage(msg);
			throw new Error(msg);
		}

		if (homeTenant) {
			const homeTenantIndex = tenants.findIndex(tenant => tenant.id === homeTenant);
			if (homeTenantIndex >= 0) {
				const homeTenant = tenants.splice(homeTenantIndex, 1);
				tenants.unshift(homeTenant[0]);
			}
		}
		return tenants;
	}

	/**
	 * Authenticates an azure account and then emits an event
	 * @param code Code from authenticating
	 */
	private async handleAuthentication(code: string): Promise<void> {
		let token: TokenResponse;
		token = await this.getTokenWithAuthCode(code, AzureAccountProvider.redirectUrlAAD);
		const tenants = await this.getTenants(token.userId, token.tenantId);
		let identityProvider = token.identityProvider;
		if (identityProvider) {
			identityProvider = identityProvider.toLowerCase();
		}

		// Determine if this is a microsoft account
		let msa = identityProvider && (
			identityProvider.indexOf('live.com') !== -1 || // lgtm [js/incomplete-url-substring-sanitization]
			identityProvider.indexOf('live-int.com') !== -1 || // lgtm [js/incomplete-url-substring-sanitization]
			identityProvider.indexOf('f8cdef31-a31e-4b4a-93e4-5f571e91255a') !== -1 ||
			identityProvider.indexOf('ea8a4392-515e-481f-879e-6571ff2a8a36') !== -1);

		// Calculate the display name for the user
		let displayName = (token.givenName && token.familyName)
			? `${token.givenName} ${token.familyName}`
			: token.userId;

		// Calculate the home tenant display name to use for the contextual display name
		let contextualDisplayName = msa
			? localize('microsoftAccountDisplayName', "Microsoft Account")
			: tenants[0].displayName;

		let accountType = msa
			? AzureAccountProvider.MicrosoftAccountType
			: AzureAccountProvider.WorkSchoolAccountType;

		const account = {
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
				providerSettings: this.metadata,
				isMsAccount: msa,
				tenants,
			},
			isStale: false
		} as AzureAccount;

		AzureAccountProvider.eventEmitter.emit(AzureAccountProvider.AzureAccountAuthenticatedEvent, { account });
	}

	private async getTokenWithAuthCode(code: string, redirectUrl: string): Promise<TokenResponse> {
		const context = new AuthenticationContext(this.commonAuthorityUrl, null, this._tokenCache);
		const acquireToken = promisify(context.acquireTokenWithAuthorizationCode).bind(context);

		let token = await acquireToken(code, redirectUrl, this.metadata.settings.signInResourceId, this.metadata.settings.clientId, undefined);
		if (token.error) {
			throw new Error(`${token.error} - ${token.errorDescription}`);
		}
		token = token as TokenResponse;
		token._clientId = this.metadata.settings.clientId;
		token._authority = this.commonAuthorityUrl;
		token.isMRRT = true;

		context.cache.add([token], (err, result) => {
			console.log(err, result);
		});

		return token;
	}

	private createAuthUrl(baseHost: string, redirectUri: string, clientId: string, resource: string, tenant: string, nonce: string): string {
		return `${baseHost}${encodeURIComponent(tenant)}/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}&resource=${encodeURIComponent(resource)}&prompt=select_account`;
	}

	private createAuthServer(pathMappings: Map<string, (req: http.IncomingMessage, res: http.ServerResponse, reqUrl: url.UrlWithParsedQuery) => void>) {
		const server = http.createServer((req, res) => {
			// Parse URL and the query string
			const reqUrl = url.parse(req.url, true);

			const method = pathMappings.get(reqUrl.pathname);
			if (method) {
				method(req, res, reqUrl);
			} else {
				console.log('undefined request ', reqUrl.pathname, req);
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

	// interface method
	refresh(account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._refresh(account);
	}

	private async _refresh(account: azdata.Account): Promise<azdata.Account | azdata.PromptFailedResult> {
		return this.prompt();
	}

	// interface method
	clear(accountKey: azdata.AccountKey): Thenable<void> {
		return this._clear(accountKey);
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		// Put together a query to look up any tokens associated with the account key
		let query = { userId: accountKey.accountId } as TokenResponse;

		// 1) Look up the tokens associated with the query
		// 2) Remove them
		let results = await this._tokenCache.findThenable(query);
		this._tokenCache.removeThenable(results);
	}

	// interface method
	autoOAuthCancelled(): Thenable<void> {
		return this._autoOAuthCancelled();
	}

	private async _autoOAuthCancelled(): Promise<void> {
		// I don't think we need this?
		throw new Error('Method not implemented.');
	}
}
