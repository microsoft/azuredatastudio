/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
// import * as azdata from 'azdata';
// import * as vscode from 'vscode';
// import * as sinon from 'sinon';
import 'mocha';
import { AzureAuthCodeGrant } from '../../../account-provider/auths/azureAuthCodeGrant';
// import { AzureDeviceCode } from '../../../account-provider/auths/azureDeviceCode';
import { Token, TokenClaims, AccessToken, RefreshToken, OAuthTokenResponse, TokenPostData } from '../../../account-provider/auths/azureAuth';
import { Tenant, AzureAccount } from '../../../account-provider/interfaces';
import providerSettings from '../../../account-provider/providerSettings';
import { AzureResource } from 'azdata';
import { AxiosResponse } from 'axios';


let azureAuthCodeGrant: TypeMoq.IMock<AzureAuthCodeGrant>;
// let azureDeviceCode: TypeMoq.IMock<AzureDeviceCode>;

const mockToken: Token = {
	key: 'someUniqueId',
	token: 'test_token',
	tokenType: 'Bearer'
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
			properties: {
				tenants: [mockTenant]
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

		azureAuthCodeGrant.setup(x => x.getTenants(mockToken)).returns((): Promise<Tenant[]> => {
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
			const securityToken = await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, TypeMoq.It.isAny(), TypeMoq.It.isAny());
			should(securityToken).be.undefined();
		});
		it('dont find correct resources', async function () {
			const securityToken = await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, TypeMoq.It.isAny(), -1);
			should(securityToken).be.undefined();
		});
		it('incorrect tenant', async function () {
			await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, 'invalid_tenant', AzureResource.MicrosoftResourceManagement).should.be.rejected();
		});

		it('token recieved for ossRdbmns resource', async function () {
			azureAuthCodeGrant.setup(x => x.getTenants(mockToken)).returns(() => {
				return Promise.resolve([
				mockTenant
			]);
			});
			azureAuthCodeGrant.setup(x => x.getTokenHelper(mockTenant, provider.settings.ossRdbmsResource, TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve({
					accessToken: mockAccessToken
				} as OAuthTokenResponse);
			});

			azureAuthCodeGrant.setup(x => x.refreshToken(mockTenant, provider.settings.ossRdbmsResource, mockRefreshToken)).returns((): Promise<OAuthTokenResponse> => {
				const mockToken: AccessToken = JSON.parse(JSON.stringify(mockAccessToken));
				delete (mockToken as any).invalidData;
				return Promise.resolve({
					accessToken: mockToken
				} as OAuthTokenResponse);
			});

			azureAuthCodeGrant.setup(x => x.getSavedToken(mockTenant, provider.settings.ossRdbmsResource, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
				return Promise.resolve({
					accessToken: mockAccessToken,
					refreshToken: mockRefreshToken,
					expiresOn: `${(new Date().getTime() / 1000) + (10 * 60)}`
				});
			});

			const securityToken = await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, mockTenant.id, AzureResource.OssRdbms);
			should(securityToken.token).be.equal(mockAccessToken.token, 'Token are not similar');

		});

		it('saved token exists and can be reused', async function () {
			delete (mockAccessToken as any).tokenType;
			azureAuthCodeGrant.setup(x => x.getSavedToken(mockTenant, provider.settings.microsoftResource, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
				return Promise.resolve({
					accessToken: mockAccessToken,
					refreshToken: mockRefreshToken,
					expiresOn: `${(new Date().getTime() / 1000) + (10 * 60)}`
				});
			});
			const securityToken = await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, mockTenant.id, AzureResource.MicrosoftResourceManagement);

			should(securityToken.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');
		});


		it('saved token had invalid expiration', async function () {
			delete (mockAccessToken as any).tokenType;
			(mockAccessToken as any).invalidData = 'this should not exist on response';
			azureAuthCodeGrant.setup(x => x.getSavedToken(mockTenant, provider.settings.microsoftResource, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
				return Promise.resolve({
					accessToken: mockAccessToken,
					refreshToken: mockRefreshToken,
					expiresOn: undefined
				});
			});
			azureAuthCodeGrant.setup(x => x.refreshToken(mockTenant, provider.settings.microsoftResource, mockRefreshToken)).returns((): Promise<OAuthTokenResponse> => {
				const mockToken: AccessToken = JSON.parse(JSON.stringify(mockAccessToken));
				delete (mockToken as any).invalidData;
				return Promise.resolve({
					accessToken: mockToken
				} as OAuthTokenResponse);
			});
			const securityToken = await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, mockTenant.id, AzureResource.MicrosoftResourceManagement);

			should((securityToken as any).invalidData).be.undefined(); // Ensure its a new one
			should(securityToken.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');

			azureAuthCodeGrant.verify(x => x.refreshToken(mockTenant, provider.settings.microsoftResource, mockRefreshToken), TypeMoq.Times.once());
		});

		describe('no saved token', function () {
			it('no base token', async function () {
				azureAuthCodeGrant.setup(x => x.getSavedToken(mockTenant, provider.settings.microsoftResource, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
					return Promise.resolve(undefined);
				});

				azureAuthCodeGrant.setup(x => x.getSavedToken(azureAuthCodeGrant.object.commonTenant, provider.settings.microsoftResource, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
					return Promise.resolve(undefined);
				});

				await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, mockTenant.id, AzureResource.MicrosoftResourceManagement).should.be.rejected();
			});

			it('base token exists', async function () {
				azureAuthCodeGrant.setup(x => x.getSavedToken(mockTenant, provider.settings.microsoftResource, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
					return Promise.resolve(undefined);
				});

				azureAuthCodeGrant.setup(x => x.getSavedToken(azureAuthCodeGrant.object.commonTenant, provider.settings.microsoftResource, mockAccount.key)).returns((): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken, expiresOn: string }> => {
					return Promise.resolve({
						accessToken: mockAccessToken,
						refreshToken: mockRefreshToken,
						expiresOn: ''
					});
				});
				delete (mockAccessToken as any).tokenType;

				azureAuthCodeGrant.setup(x => x.refreshToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
					return Promise.resolve({
						accessToken: mockAccessToken
					} as OAuthTokenResponse);
				});

				const securityToken: Token = await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, mockTenant.id, AzureResource.MicrosoftResourceManagement);
				should(securityToken.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');
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

			azureAuthCodeGrant.setup(x => x.handleInteractionRequired(mockTenant, provider.settings.microsoftResource)).returns(() => {
				return Promise.resolve({
					accessToken: mockAccessToken
				} as OAuthTokenResponse);
			});


			const result = await azureAuthCodeGrant.object.getToken(mockTenant, provider.settings.microsoftResource, {} as TokenPostData);

			azureAuthCodeGrant.verify(x => x.handleInteractionRequired(mockTenant, provider.settings.microsoftResource), TypeMoq.Times.once());

			should(result.accessToken).be.deepEqual(mockAccessToken);
		});

		it('unknown error should throw error', async function () {
			azureAuthCodeGrant.setup(x => x.makePostRequest(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve({
					data: {
						error: 'unknown error'
					}
				} as AxiosResponse<any>);
			});

			await azureAuthCodeGrant.object.getToken(mockTenant, provider.settings.microsoftResource, {} as TokenPostData).should.be.rejected();
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

			azureAuthCodeGrant.setup(x => x.getTokenHelper(mockTenant, provider.settings.microsoftResource, TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve({
					accessToken: mockAccessToken
				} as OAuthTokenResponse);
			});


			const result = await azureAuthCodeGrant.object.getToken(mockTenant, provider.settings.microsoftResource, {} as TokenPostData);

			azureAuthCodeGrant.verify(x => x.getTokenHelper(mockTenant, provider.settings.microsoftResource, TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());

			should(result.accessToken).be.deepEqual(mockAccessToken);
		});
	});

});
