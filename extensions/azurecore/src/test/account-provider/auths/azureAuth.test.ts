/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import 'mocha';
import { AzureAuthCodeGrant } from '../../../account-provider/auths/azureAuthCodeGrant';
import { Token, TokenClaims, AccessToken, RefreshToken } from '../../../account-provider/auths/azureAuth';
import { Tenant, AzureAccount } from 'azurecore';
import providerSettings from '../../../account-provider/providerSettings';
import { AzureResource } from 'azdata';
import { AxiosResponse } from 'axios';
import { AuthenticationResult } from '@azure/msal-common';
import { AccountInfo, Configuration, PublicClientApplication } from '@azure/msal-node';

let azureAuthCodeGrant: TypeMoq.IMock<AzureAuthCodeGrant>;
let clientApplication: TypeMoq.IMock<PublicClientApplication>;
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

let mockAccountInfo: AccountInfo;

let mockAzureAccount: AzureAccount;

const provider = providerSettings[0].metadata;
const msalConfiguration: Configuration = {
	auth: {
		clientId: provider.settings.clientId,
		authority: 'https://login.windows.net/common'
	}
};

describe('Azure Authentication', function () {
	beforeEach(function () {
		azureAuthCodeGrant = TypeMoq.Mock.ofType<AzureAuthCodeGrant>(AzureAuthCodeGrant, TypeMoq.MockBehavior.Loose, true, provider);
		clientApplication = TypeMoq.Mock.ofType<PublicClientApplication>(PublicClientApplication, TypeMoq.MockBehavior.Loose, true, msalConfiguration);

		azureAuthCodeGrant.callBase = true;
		clientApplication.callBase = true;

		mockAzureAccount = {
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


		mockAccountInfo = {
			homeAccountId: 'test',
			environment: 'test',
			tenantId: 'test',
			username: 'test',
			localAccountId: 'test'
		}


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
		azureAuthCodeGrant.setup(x => x.getAccountFromMsalCache(mockAccountInfo.homeAccountId)).returns(() => {
			return Promise.resolve(mockAccountInfo);
		});

		it('incorrect tenant', async function () {
			await azureAuthCodeGrant.object.getToken(mockAzureAccount.key.accountId, AzureResource.MicrosoftResourceManagement, 'invalid_tenant').should.be.rejected();
		});

		it('token recieved for ossRdbmns resource', async function () {
			azureAuthCodeGrant.setup(x => x.getTenants(mockToken.token)).returns(() => {
				return Promise.resolve([
					mockTenant
				]);
			});

			azureAuthCodeGrant.setup(x => x.getAccountFromMsalCache(mockAccountInfo.homeAccountId)).returns(() => {
				return Promise.resolve(mockAccountInfo);
			});

			const securityToken = await azureAuthCodeGrant.object.getToken(mockAccountInfo.homeAccountId, AzureResource.OssRdbms, mockTenant.id) as AuthenticationResult;
			should(securityToken?.accessToken).be.equal(mockAccessToken.token, 'Token are not similar');

		});

		it('saved token exists and can be reused', async function () {
			delete (mockAccessToken as any).tokenType;
			azureAuthCodeGrant.setup(x => x.getToken(mockAccountInfo.homeAccountId, AzureResource.MicrosoftResourceManagement, mockTenant.id)).returns((): Promise<AuthenticationResult> => {
				return Promise.resolve({
					authority: 'test',
					uniqueId: 'test',
					tenantId: 'test',
					scopes: ['test'],
					account: null,
					idToken: 'test',
					idTokenClaims: mockClaims,
					fromCache: false,
					tokenType: 'Bearer',
					correlationId: 'test',
					accessToken: mockAccessToken.token,
					refreshToken: mockRefreshToken.token,
					expiresOn: new Date(Date.now())
				});
			});
			const securityToken = await azureAuthCodeGrant.object.getToken(mockAzureAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id) as AuthenticationResult;

			should(securityToken?.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');
		});
	});

	describe('getToken', function () {

		azureAuthCodeGrant.setup(x => x.getAccountFromMsalCache(mockAccountInfo.homeAccountId)).returns(() => {
			return Promise.resolve(mockAccountInfo);
		});

		it('calls handle interaction required', async function () {
			clientApplication.setup(x => x.acquireTokenSilent(TypeMoq.It.isAny())).returns(() => {
				return Promise.resolve(
					null
				);
			});

			azureAuthCodeGrant.setup(x => x.handleInteractionRequired(mockTenant, provider.settings.microsoftResource!)).returns(() => {
				return Promise.resolve({
					authority: 'test',
					uniqueId: 'test',
					tenantId: 'test',
					scopes: ['test'],
					account: null,
					idToken: 'test',
					idTokenClaims: mockClaims,
					fromCache: false,
					tokenType: 'Bearer',
					correlationId: 'test',
					accessToken: mockAccessToken.token,
					refreshToken: mockRefreshToken.token,
					expiresOn: new Date(Date.now())
				} as AuthenticationResult);
			});


			const result = await azureAuthCodeGrant.object.getToken(mockAzureAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id) as AuthenticationResult;

			azureAuthCodeGrant.verify(x => x.handleInteractionRequired(mockTenant, provider.settings.microsoftResource!), TypeMoq.Times.once());

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

			await azureAuthCodeGrant.object.getToken(mockAzureAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id).should.be.rejected();
		});

	});

});
