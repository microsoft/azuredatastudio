/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as adal from 'adal-node';
import * as data from 'data';
import * as request from 'request';
import * as nls from 'vscode-nls';
import {
	Arguments,
	AzureAccount,
	AzureAccountProviderMetadata,
	AzureAccountSecurityTokenCollection,
	Tenant
} from './interfaces';

const localize = nls.loadMessageBundle();

export class AzureAccountProvider implements data.AccountProvider {
	private static WorkSchoolAccountLogo: data.AccountContextualLogo = {
		light: AzureAccountProvider.loadIcon('work_school_account.svg'),
		dark: AzureAccountProvider.loadIcon('work_school_account_inverse.svg')
	};
	private static MicrosoftAccountLogo: data.AccountContextualLogo = {
		light: AzureAccountProvider.loadIcon('microsoft_account.svg'),
		dark: AzureAccountProvider.loadIcon('microsoft_account.svg')
	};

	private _args: Arguments;
	private _isInitialized: boolean;
	private _tokenCache: adal.TokenCache;

	public metadata: AzureAccountProviderMetadata;

	constructor(metadata: AzureAccountProviderMetadata, tokenCache: adal.TokenCache) {
		this.metadata = metadata;
		this._args = {
			host: metadata.settings.host,
			clientId: metadata.settings.clientId
		};
		this._isInitialized = false;
		this._tokenCache = tokenCache;
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public clear(accountKey: data.AccountKey): Thenable<void> {
		throw new Error('Not implemented');
	}

	public clearTokenCache(): Thenable<void> {
		return this._tokenCache.clear();
	}

	public getSecurityToken(account: AzureAccount): Thenable<AzureAccountSecurityTokenCollection> {
		let self = this;
		return this.doIfInitialized(() => self.getAccessTokens(account));
	}

	public initialize(restoredAccounts: data.Account[]): Thenable<data.Account[]> {
		let self = this;

		return new Promise<data.Account[]>(resolve => {
			// Rehydrate the accounts
			restoredAccounts.forEach((account) => {
				// Set the icon for the account
				account.displayInfo.contextualLogo = account.properties.isMsAccount
					? AzureAccountProvider.MicrosoftAccountLogo
					: AzureAccountProvider.WorkSchoolAccountLogo;

				// TODO: Set stale status based on whether we can authenticate or not
			});

			self._isInitialized = true;

			resolve(restoredAccounts);
		});
	}

	public prompt(): Thenable<AzureAccount> {
		let self = this;
		return this.doIfInitialized(() => self.signIn());
	}

	public refresh(account: AzureAccount): Thenable<AzureAccount> {
		let self = this;
		return this.doIfInitialized(() => self.signIn(account.properties.isMsAccount, account.key.accountId));
	}

	// PRIVATE METHODS /////////////////////////////////////////////////////
	private static loadIcon(iconName: string) {
		let filePath = path.join(__dirname, 'media', iconName);
		try {
			return 'image/svg+xml,' + fs.readFileSync(filePath);
		} catch(e) {
			return '';
		}
	}

	private authenticate(tenantId: string, msa: boolean, userId: string, silent: boolean): Thenable<adal.TokenResponse> {
		let authorityUrl = `${this.metadata.settings.host}/${tenantId}`;
		// TODO: Rewrite using urijs
		let authorizeUrl = `${authorityUrl}/oauth2/authorize`
			+ `?client_id=${this.metadata.settings.clientId}`                                     // Specify the client ID
			+ `&response_type=code`                                                               // Request the authorization code grant flow
			+ (userId ? (msa ? '&domain_hint=live.com' : '&msafed=0') : '')                       // Optimize prompt given existing MSA or org ID
			+ ((!userId && !silent) ? '&prompt=login' : '')                                       // Require login if not silent
			+ (userId ? `&login_hint=${encodeURIComponent(userId)}` : '')                         // Show login hint if we have an existing user ID
			+ (this.metadata.settings.siteId ? `&site_id=${this.metadata.settings.siteId}` : '')  // Site ID to use as brand on the prompt
			+ '&display=popup'                                                                    // Causes a popup version of the UI to be shown
			+ `&resource=${encodeURIComponent(this.metadata.settings.signInResourceId)}`          // Specify the resource for which an access token should be retrieved
			+ `&redirect_uri=${encodeURIComponent(this.metadata.settings.redirectUri)}`;          // TODO: add locale parameter like in VSAccountProvider.TryAppendLocalParameter

		// Get the authorization code. If this is the initial authentication (the user is unknown),
		// do not silently prompt. If this is a subsequent authentication for an additional tenant,
		// the browser cookie cache will be used to authenticate without prompting, so run the
		// browser silently.
		return data.accounts.performOAuthAuthorization(authorizeUrl, silent)
			.then((code: string) => {
				return new Promise((resolve, reject) => {
					let context = new adal.AuthenticationContext(authorityUrl, null, this._tokenCache);
					context.acquireTokenWithAuthorizationCode(
						code,
						this.metadata.settings.redirectUri,
						this.metadata.settings.signInResourceId,
						this.metadata.settings.clientId,
						null,
						(error, response) => {
							if (error) {
								reject(error);
							} else {
								resolve(<adal.TokenResponse> response);
							}
						}
					);
				});
			});
	}

	private doIfInitialized<T>(op: () => Thenable<T>): Thenable<T> {
		return this._isInitialized
			? op()
			: Promise.reject(localize('accountProviderNotInitialized', 'Account provider not initialized, cannot perform action'));
	}

	private getAccessTokens(account: AzureAccount): Thenable<AzureAccountSecurityTokenCollection> {
		let self = this;

		// TODO: Could we add some better typing here?
		let accessTokenPromises: Thenable<void>[] = [];
		let tokenCollection: AzureAccountSecurityTokenCollection = {};
		for (let tenant of account.properties.tenants) {
			let promise = new Promise<void>((resolve, reject) => {
				// TODO: use urijs to generate this URI
				let authorityUrl = `${self.metadata.settings.host}/${tenant.id}`;
				let context = new adal.AuthenticationContext(authorityUrl, null, self._tokenCache);

				// TODO: This is where we should mark the account as stale
				context.acquireToken(
					self.metadata.settings.armResource.id,
					tenant.userId,
					self.metadata.settings.clientId,
					(error: adal.ErrorResponse, response: adal.SuccessResponse) => {
						// Handle errors first
						if (error) {
							reject(error);
							return;
						}

						// Generate a token object and add it to the collection
						tokenCollection[tenant.id] = {
							expiresOn: response.expiresOn,
							resource: response.resource,
							token: response.accessToken,
							tokenType: response.tokenType
						};
						resolve();
					}
				);
			});
			accessTokenPromises.push(promise);
		}

		// Wait until all the tokens have been acquired then return the collection
		return Promise.all(accessTokenPromises)
			.then(() => tokenCollection);
	}

	private getTenantDisplayName(msa: boolean, tenantId: string, userId: string): Thenable<string> {
		let self = this;
		if(msa) {
			return Promise.resolve(localize('microsoftAccountDisplayName', 'Microsoft Account'));
		}

		return new Promise<string>((resolve, reject) => {
			// Get an access token to the AAD graph resource
			// TODO: Use urijs to generate this URI
			let authorityUrl = `${self.metadata.settings.host}/${tenantId}`;
			let context = new adal.AuthenticationContext(authorityUrl, null, self._tokenCache);
			context.acquireToken(self.metadata.settings.graphResource.id, userId, self.metadata.settings.clientId, (error, response) => {
				if (error) {
					reject(error);
					return;
				}

				request.get(
					`${self.metadata.settings.graphResource.endpoint}/${tenantId}/tenantDetails?api-version=2013-04-05`,
					{
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${(<adal.TokenResponse>response).accessToken}`
						},
						json: true
					},
					(graphError, graphResponse, body: {error: any; value: any[];}) => {
						if (graphError || body['odata.error']) {
							reject(graphError || body['odata.error']);
						} else if (body.value.length && body.value[0].displayName) {
							resolve(body.value[0].displayName);
						} else {
							resolve(localize('azureWorkAccountDisplayName', 'Work or school account'));
						}
					}
				);
			});
		});
	}

	private getTenants(msa: boolean, userId: string, tenantIds: string[], homeTenant: string): Thenable<Tenant[]> {
		let self = this;

		// Lookup each tenant ID that was provided
		let getTenantPromises: Thenable<Tenant>[] = [];
		for (let tenantId of tenantIds) {
			let promise = this.authenticate(tenantId, msa, userId, false)
				.then((response) => self.getTenantDisplayName(msa, response.tenantId, response.userId))
				.then((displayName) => {
					return <Tenant>{
						displayName: displayName,
						id: tenantId,
						userId: userId
					};
				});
			getTenantPromises.push(promise);
		}

		return Promise.all(getTenantPromises)
			.then((tenants) => {
				// Resort the tenants to make sure that the 'home' tenant is the first in the list
				let homeTenantIndex = tenants.findIndex((tenant) => tenant.id === homeTenant);
				if (homeTenantIndex >= 0) {
					let homeTenant = tenants.splice(homeTenantIndex, 1);
					tenants.unshift(homeTenant[0]);
				}
				return tenants;
			});
	}

	private getTenantIds(userId: string): Thenable<string[]> {
		return new Promise((resolve, reject) => {
			// Get an access token to the ARM resource
			// TODO: Build this URL with urijs
			let authorityUrl = `${this.metadata.settings.host}/common`;
			let context = new adal.AuthenticationContext(authorityUrl, null, this._tokenCache);
			context.acquireToken(this.metadata.settings.armResource.id, userId, this.metadata.settings.clientId, (error, response) => {
				if (error) {
					reject(error);
					return;
				}

				if (!!this.metadata.settings.adTenants && this.metadata.settings.adTenants.length > 0) {
					resolve(this.metadata.settings.adTenants);
				} else {
					request.get(
						`${this.metadata.settings.armResource.endpoint}/tenants?api-version=2015-01-01`,
						{
							headers: {
								'Content-Type': 'application/json',
								'Authorization': `Bearer ${(<adal.TokenResponse>response).accessToken}`
							},
							json: true
						},
						(armError, armResponse, body: {error: any; value: any[];}) => {
							if (armError || body.error) {
								reject(armError || body.error);
							} else {
								resolve(body.value.map(item => <string>item.tenantId));
							}
						}
					);
				}
			});
		});
	}

	private signIn(msa?: boolean, userId?: string): Thenable<AzureAccount> {
		let self = this;

		// Initial authentication is via the common/discovery tenant
		return this.authenticate('common', msa, userId, false)
			.then((response: adal.TokenResponse) => {
				let identityProvider = response.identityProvider;
				if (identityProvider) {
					identityProvider = identityProvider.toLowerCase();
				}

				// Determine if this is a microsoft account
				msa = identityProvider && (
					identityProvider.indexOf('live.com') !== -1 ||
					identityProvider.indexOf('live-int.com') !== -1 ||
					identityProvider.indexOf('f8cdef31-a31e-4b4a-93e4-5f571e91255a') !== -1 ||
					identityProvider.indexOf('ea8a4392-515e-481f-879e-6571ff2a8a36') !== -1);

				// Get the user information
				userId = response.userId;
				let displayName = (response.givenName && response.familyName)
					? `${response.givenName} ${response.familyName}`
					: userId;

				// Get all the additional tenants
				return this.getTenantIds(userId)
					.then(tenantIds => self.getTenants(msa, userId, tenantIds, response.tenantId))
					.then(tenants => {
						return <AzureAccount>{
							key: {
								providerId: self.metadata.id,
								accountId: userId
							},
							name: userId,
							displayInfo: {
								contextualLogo:	msa
									? AzureAccountProvider.MicrosoftAccountLogo
									: AzureAccountProvider.WorkSchoolAccountLogo,
								contextualDisplayName: tenants[0].displayName,
								displayName: displayName
							},
							properties: {
								isMsAccount: msa,
								tenants: tenants
							},
							isStale: false
						};
					});
			});
	}
}

// ADAL MONKEY PATCH ///////////////////////////////////////////////////////
// Monkey patch the ADAL TokenRequest class to fix the fact that when you request a token from an
// authorization code, it doesn't update the cache
import * as TokenRequest from 'adal-node/lib/token-request';
let getTokenWithAuthorizationCodeOriginal = TokenRequest.prototype.getTokenWithAuthorizationCode;
TokenRequest.prototype.getTokenWithAuthorizationCode = function (
	authorizationCode: string,
	clientSecret: string,
	callback: adal.AcquireTokenCallback
) {
	this._cacheDriver = this._createCacheDriver();
	getTokenWithAuthorizationCodeOriginal.call(this, authorizationCode, clientSecret, (error: Error, response: adal.ErrorResponse|adal.TokenResponse) => {
		if (error) {
			callback(error, response);
		} else {
			this._userId = (<adal.TokenResponse> response).userId;
			this._cacheDriver.add(response, () => callback(null, response));
		}
	});
};