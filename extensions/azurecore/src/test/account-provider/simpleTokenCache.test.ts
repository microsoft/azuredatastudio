/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';

import { SimpleTokenCache } from '../../account-provider/simpleTokenCache';

describe('AccountProvider.TokenCache', function (): void {
	it('Can save and load credentials', async function (): Promise<void> {
		const tokenCacheKey = 'azureTokenCache-testkey';
		const tokenCachePassword = 'azureTokenCache-testpassword';
		const tokenCache = new SimpleTokenCache('testTokenService');

		const result = await tokenCache.saveCredential(tokenCacheKey, tokenCachePassword);
		should(result).true('TokenResponse not added correctly');

		const results = await tokenCache.getCredential(tokenCacheKey);
		should(results).equal(tokenCachePassword);
	});
	it('Can save and clear credentials', async function (): Promise<void> {
		const tokenCacheKey = 'azureTokenCache-testkey';
		const tokenCachePassword = 'azureTokenCache-testpassword';
		const tokenCache = new SimpleTokenCache('testTokenService');

		const addResult = await tokenCache.saveCredential(tokenCacheKey, tokenCachePassword);
		should(addResult).true('TokenResponse not added correctly');

		const clearResult = await tokenCache.clearCredential(tokenCacheKey);
		should(clearResult).true('TokenResponse not cleared correctly');

		const results = await tokenCache.getCredential(tokenCacheKey);
		should(results).equal(undefined);
	});
});
