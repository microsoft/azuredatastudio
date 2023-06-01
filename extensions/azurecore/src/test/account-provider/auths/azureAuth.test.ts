/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import 'mocha';
import { AzureAuthCodeGrant } from '../../../account-provider/auths/azureAuthCodeGrant';
import { Token, TokenClaims, AccessToken, RefreshToken, OAuthTokenResponse, TokenPostData } from '../../../account-provider/auths/azureAuth';
import { Tenant, AzureAccount } from 'azurecore';
import providerSettings from '../../../account-provider/providerSettings';
import { AzureResource } from 'azdata';
import { AxiosResponse } from 'axios';
import { AuthenticationResult } from '@azure/msal-common';

let azureAuthCodeGrant: TypeMoq.IMock<AzureAuthCodeGrant>;
// let azureDeviceCode: TypeMoq.IMock<AzureDeviceCode>;

const mockToken: Token = {
	key: 'someUniqueId',
	token: 'test_token',
	tokenType: 'Bearer',
	expiresOn: new Date().getTime() / 1000 + (60 * 60) // 1 hour from now.
};
let mockAccessToken: AccessToken;
let mockRefreshToken: RefreshToken;

const mockClaims = {
	name: 'Name',
	email: 'example@example.com',
	sub: 'someUniqueId'
} as TokenClaims;

const mockTenant: Tenant = {
	displayName: 'Tenant Name',
	id: 'tenantID',
	tenantCategory: 'Home',
	userId: 'test_user'
};

let mockAccount: AzureAccount;

const provider = providerSettings[0].metadata;

describe('Azure Authentication', function () {
	beforeEach(function () {
		azureAuthCodeGrant = TypeMoq.Mock.ofType<AzureAuthCodeGrant>(AzureAuthCodeGrant, TypeMoq.MockBehavior.Loose, true, provider);
		// azureDeviceCode = TypeMoq.Mock.ofType<AzureDeviceCode>();

		azureAuthCodeGrant.callBase = true;
		// authDeviceCode.callBase = true;

		mockAccount = {
			isStale: false,
			displayInfo: {
				contextualDisplayName: 'test',
				accountType: 'test',
				displayName: 'test',
				userId: 'test'
			},
			key: {
				providerId: 'test',
				accountId: 'test'
			},
			properties: {
				owningTenant: mockTenant,
				tenants: [mockTenant],
				providerSettings: provider,
				isMsAccount: true
			}
		} as AzureAccount;

		mockAccessToken = {
			...mockToken
		};
		mockRefreshToken = {
			...mockToken
		};
	});

	it('accountHydration should yield a valid account', async function () {

		azureAuthCodeGrant.setup(x => x.getTenants(mockToken.token)).returns((): Promise<Tenant[]> => {
			return Promise.resolve([
				mockTenant
			]);
		});

		const response = await azureAuthCodeGrant.object.hydrateAccount(mockToken, mockClaims);
		should(response.displayInfo.displayName).be.equal(`${mockClaims.name} - ${mockClaims.email}`, 'Account name should match');
		should(response.displayInfo.userId).be.equal(mockClaims.sub, 'Account ID should match');
		should(response.properties.tenants).be.deepEqual([mockTenant], 'Tenants should match');
	});

	describe('getAccountSecurityToken', function () {
		it('should be undefined on stale account', async function () {
			mockAccount.isStale = true;
			const securityToken = await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, TypeMoq.It.isAny(), TypeMoq.It.isAny());
			should(securityToken).be.undefined();
		});
		it('dont find correct resources', async function () {
			const securityToken = await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, -1, TypeMoq.It.isAny());
			should(securityToken).be.undefined();
		});
		it('incorrect tenant', async function () {
			await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, AzureResource.MicrosoftResourceManagement, 'invalid_tenant').should.be.rejected();
		});

		it('token recieved for ossRdbmns resource', async function () {
			azureAuthCodeGrant.setup(x => x.getTenants(mockToken.token)).returns(() => {
				return Promise.resolve([
					mockTenant
				]);
			});

			const securityToken = await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, AzureResource.OssRdbms, mockTenant.id) as AuthenticationResult;
			should(securityToken?.accessToken).be.equal(mockAccessToken.token, 'Token are not similar');

		});

		it('saved token exists and can be reused', async function () {
			delete (mockAccessToken as any).tokenType;
			azureAuthCodeGrant.setup(x => x.getToken(mockAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id)).returns((): Promise<AuthenticationResult> => {
				return Promise.resolve({
					authority: 'test',
					uniqueId: 'test',
					tenantId: 'test',
					scopes: ['test'],
					account: null,
					idToken: 'test',
					idTokenClaims: null,
					fromCache: false,
					tokenType: 'Bearer',
					correlationId: 'test',
					accessToken: mockAccessToken.token,
					refreshToken: mockRefreshToken.token,
					expiresOn: `${(new Date().getTime() / 1000) + (10 * 60)}`
				});
			});
			const securityToken = await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id);

			should(securityToken?.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');
		});


		it('saved token had invalid expiration', async function () {
			delete (mockAccessToken as any).tokenType;
			(mockAccessToken as any).invalidData = 'this should not exist on response';
			azureAuthCodeGrant.setup(x => x.getSavedTokenAdal(mockTenant, provider.settings.microsoftResource!, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
				return Promise.resolve({
					accessToken: mockAccessToken,
					refreshToken: mockRefreshToken,
					expiresOn: 'invalid'
				});
			});
			azureAuthCodeGrant.setup(x => x.refreshTokenAdal(mockTenant, provider.settings.microsoftResource!, mockRefreshToken)).returns((): Promise<OAuthTokenResponse> => {
				const mockToken: AccessToken = JSON.parse(JSON.stringify(mockAccessToken)) as AccessToken;
				delete (mockToken as any).invalidData;
				return Promise.resolve({
					accessToken: mockToken
				} as OAuthTokenResponse);
			});
			const securityToken = await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id);

			should((securityToken as any).invalidData).be.undefined(); // Ensure its a new one
			should(securityToken?.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');

			azureAuthCodeGrant.verify(x => x.refreshTokenAdal(mockTenant, provider.settings.microsoftResource!, mockRefreshToken), TypeMoq.Times.once());
		});

		describe('no saved token', function () {
			it('no base token', async function () {
				azureAuthCodeGrant.setup(x => x.getSavedTokenAdal(mockTenant, provider.settings.microsoftResource!, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string } | undefined> => {
					return Promise.resolve(undefined);
				});

				azureAuthCodeGrant.setup(x => x.getSavedTokenAdal(azureAuthCodeGrant.object.commonTenant, provider.settings.microsoftResource!, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string } | undefined> => {
					return Promise.resolve(undefined);
				});

				await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id).should.be.rejected();
			});

			it('base token exists', async function () {
				azureAuthCodeGrant.setup(x => x.getSavedTokenAdal(mockTenant, provider.settings.microsoftResource!, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string } | undefined> => {
					return Promise.resolve(undefined);
				});

				azureAuthCodeGrant.setup(x => x.getSavedTokenAdal(azureAuthCodeGrant.object.commonTenant, provider.settings.microsoftResource!, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
					return Promise.resolve({
						accessToken: mockAccessToken,
						refreshToken: mockRefreshToken,
						expiresOn: ''
					});
				});
				delete (mockAccessToken as any).tokenType;

				azureAuthCodeGrant.setup(x => x.refreshTokenAdal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
					return Promise.resolve({
						accessToken: mockAccessToken
					} as OAuthTokenResponse);
				});

				const securityToken = await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id,);
				should(securityToken?.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');
			});
		});

	});

	describe('getToken', function () {

		it('calls handle interaction required', async function () {
			azureAuthCodeGrant.setup(x => x.makePostRequest(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve({
					data: {
						error: 'interaction_required'
					}
				} as AxiosResponse<any>);
			});

			azureAuthCodeGrant.setup(x => x.handleInteractionRequiredAdal(mockTenant, provider.settings.microsoftResource!)).returns(() => {
				return Promise.resolve({
					accessToken: mockAccessToken
				} as OAuthTokenResponse);
			});


			// const result = await azureAuthCodeGrant.object.getTokenAdal(mockTenant, provider.settings.microsoftResource!, {} as TokenPostData);

			azureAuthCodeGrant.verify(x => x.handleInteractionRequiredAdal(mockTenant, provider.settings.microsoftResource!), TypeMoq.Times.once());

			should(result?.accessToken).be.deepEqual(mockAccessToken);
		});

		it('unknown error should throw error', async function () {
			azureAuthCodeGrant.setup(x => x.makePostRequest(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve({
					data: {
						error: 'unknown error'
					}
				} as AxiosResponse<any>);
			});

			await azureAuthCodeGrant.object.getTokenAdal(mockTenant, provider.settings.microsoftResource!, {} as TokenPostData).should.be.rejected();
		});

		it('calls getTokenHelper', async function () {
			azureAuthCodeGrant.setup(x => x.makePostRequest(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve({
					data: {
						access_token: mockAccessToken.token,
						refresh_token: mockRefreshToken.token,
						expires_on: `0`
					}
				} as AxiosResponse<any>);
			});

			azureAuthCodeGrant.setup(x => x.getTokenHelperAdal(mockTenant, provider.settings.microsoftResource!, TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve({
					accessToken: mockAccessToken
				} as OAuthTokenResponse);
			});


			// const result = await azureAuthCodeGrant.object.getTokenAdal(mockTenant, provider.settings.microsoftResource!, {} as TokenPostData);

			azureAuthCodeGrant.verify(x => x.getTokenHelperAdal(mockTenant, provider.settings.microsoftResource!, TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());

			should(result?.accessToken).be.deepEqual(mockAccessToken);
		});
	});

});
