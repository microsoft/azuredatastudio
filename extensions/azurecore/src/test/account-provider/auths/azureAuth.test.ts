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
import { Token, TokenClaims } from '../../../account-provider/auths/azureAuth';
import { Tenant, AzureAccount } from '../../../account-provider/interfaces';
import providerSettings from '../../../account-provider/providerSettings';


let azureAuthCodeGrant: TypeMoq.IMock<AzureAuthCodeGrant>;
// let azureDeviceCode: TypeMoq.IMock<AzureDeviceCode>;

const mockToken: Token = {
	key: 'someUniqueId',
	token: 'test_token',
	tokenType: 'Bearer'
};

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

const mockAccount = {
	isStale: true
} as AzureAccount;

describe('Azure Authentication', function () {
	beforeEach(function () {
		azureAuthCodeGrant = TypeMoq.Mock.ofType<AzureAuthCodeGrant>(AzureAuthCodeGrant, TypeMoq.MockBehavior.Loose, true, providerSettings[0].metadata);
		// azureDeviceCode = TypeMoq.Mock.ofType<AzureDeviceCode>();

		azureAuthCodeGrant.callBase = true;
		// authDeviceCode.callBase = true;
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
			const securityToken = await azureAuthCodeGrant.object.getAccountSecurityToken(mockAccount, TypeMoq.It.isAny(), TypeMoq.It.isAny());
			should(securityToken).be.undefined();
		});
	});

});
