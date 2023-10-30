/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import 'mocha';
import { AzureAuthCodeGrant } from '../../../account-provider/auths/azureAuthCodeGrant';
import { Token, TokenClaims, AccessToken, RefreshToken } from '../../../account-provider/auths/azureAuth';
import { Tenant, AzureAccount } from 'azurecore';
import providerSettings from '../../../account-provider/providerSettings';
import { AzureResource } from 'azdata';
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

	describe('getAccountSecurityToken', function () {
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
					idTokenClaims: mockClaims,
					fromCache: false,
					tokenType: 'Bearer',
					correlationId: 'test',
					accessToken: mockAccessToken.token,
					refreshToken: mockRefreshToken.token,
					expiresOn: new Date(Date.now())
				});
			});
			const securityToken = await azureAuthCodeGrant.object.getToken(mockAccount.key.accountId, AzureResource.MicrosoftResourceManagement, mockTenant.id) as AuthenticationResult;

			should(securityToken?.tokenType).be.equal('Bearer', 'tokenType should be bearer on a successful getSecurityToken from cache');
		});
	});

});
