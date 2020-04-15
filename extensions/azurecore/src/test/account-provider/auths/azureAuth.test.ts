/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import 'mocha';

import { PromptFailedResult, AccountKey } from 'azdata';
import { AzureAuth, AccessToken, RefreshToken, TokenClaims } from '../../../account-provider/auths/azureAuth';
import { AzureAccount, AzureAuthType } from '../../../account-provider/interfaces';
import providerSettings from '../../../account-provider/providerSettings';
import { SimpleTokenCache } from '../../../account-provider/simpleTokenCache';
import { CredentialsTestProvider } from '../../stubs/credentialsTestProvider';

class BasicAzureAuth extends AzureAuth {
	public login(): Promise<AzureAccount | PromptFailedResult> {
		throw new Error('Method not implemented.');
	}
	public autoOAuthCancelled(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}

let baseAuth: AzureAuth;

const accountKey: AccountKey = {
	accountId: 'SomeAccountKey',
	providerId: 'providerId',
};

const accessToken: AccessToken = {
	key: accountKey.accountId,
	token: '123'
};

const refreshToken: RefreshToken = {
	key: accountKey.accountId,
	token: '321'
};

const resourceId = 'resource';
const tenantId = 'tenant';

// These tests don't work on Linux systems because gnome-keyring doesn't like running on headless machines.
describe('AccountProvider.AzureAuth', function (): void {
	beforeEach(async function (): Promise<void> {
		const tokenCache = new SimpleTokenCache('testTokenService', os.tmpdir(), true, new CredentialsTestProvider());
		await tokenCache.init();
		baseAuth = new BasicAzureAuth(providerSettings[0].metadata, tokenCache, undefined, undefined, AzureAuthType.AuthCodeGrant, 'Auth Code Grant');
	});

	it('Basic token set and get', async function (): Promise<void> {
		await baseAuth.setCachedToken(accountKey, accessToken, refreshToken);
		const result = await baseAuth.getCachedToken(accountKey);

		should(JSON.stringify(result.accessToken)).be.equal(JSON.stringify(accessToken));
		should(JSON.stringify(result.refreshToken)).be.equal(JSON.stringify(refreshToken));
	});

	it('Token set and get with tenant and resource id', async function (): Promise<void> {
		await baseAuth.setCachedToken(accountKey, accessToken, refreshToken, resourceId, tenantId);
		let result = await baseAuth.getCachedToken(accountKey, resourceId, tenantId);

		should(JSON.stringify(result.accessToken)).be.equal(JSON.stringify(accessToken));
		should(JSON.stringify(result.refreshToken)).be.equal(JSON.stringify(refreshToken));

		await baseAuth.clearCredentials(accountKey);
		result = await baseAuth.getCachedToken(accountKey, resourceId, tenantId);
		should(result).be.undefined();
	});

	it('Token set with resource ID and get without tenant and resource id', async function (): Promise<void> {
		await baseAuth.setCachedToken(accountKey, accessToken, refreshToken, resourceId, tenantId);
		const result = await baseAuth.getCachedToken(accountKey);

		should(JSON.stringify(result)).be.undefined();
		should(JSON.stringify(result)).be.undefined();
	});

	it('Create an account object', async function (): Promise<void> {
		const tokenClaims = {
			idp: 'live.com',
			name: 'TestAccount',
		} as TokenClaims;

		const account = baseAuth.createAccount(tokenClaims, 'someKey', undefined);

		should(account.properties.azureAuthType).be.equal(AzureAuthType.AuthCodeGrant);
		should(account.key.accountId).be.equal('someKey');
		should(account.properties.isMsAccount).be.equal(true);
	});
});
