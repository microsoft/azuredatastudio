/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as adal from 'adal-node';
import * as path from 'path';
import 'mocha';

import CredentialServiceTokenCache from '../../account-provider/tokenCache';
import { CredentialsTestProvider } from '../stubs/credentialsTestProvider';

describe('AccountProvider.TokenCache', function (): void {
	it('Can save and load tokens', async function (): Promise<void> {
		const tokenResponse: adal.TokenResponse = {
			tokenType: 'testTokenType',
			expiresIn: 0,
			expiresOn: new Date(),
			resource: 'testResource',
			accessToken: 'testAccessToken'
		};

		const tokenCacheKey = 'azureTokenCache-testkey';
		const tokenCachePath = path.join(os.tmpdir(), tokenCacheKey);
		const credentialProvider = new CredentialsTestProvider();
		credentialProvider.saveCredential(tokenCacheKey, undefined);
		const tokenCache = new CredentialServiceTokenCache(credentialProvider, tokenCacheKey, tokenCachePath);
		const addResult = await tokenCache.addThenable([tokenResponse]);
		should(addResult).true('TokenResponse not added correctly');

		const results = await tokenCache.findThenable({ tokenType: 'testTokenType' });
		should(results).deepEqual([tokenResponse]);
	});
});
